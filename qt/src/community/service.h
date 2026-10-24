#pragma once

// CommunityUploadService of src-tauri/src/community_upload.rs: enrollment, the token, the durable shot
// queue and its upload, the history scan of the machine, disconnect and the local factory reset.
//
// Thread-safe like the Rust Inner: one mutex guards the persistent and the volatile state; network and
// disk work happen outside it (except state.json writes, which persist a mutation before it is
// applied). The network steps block the calling thread, so they run on the uploader's worker thread or
// a command thread, never on the GUI thread. status() reads a copy kept under a separate lock, so the
// GUI never waits for a state.json write.

#include "diagnostics.h"
#include "http.h"
#include "model.h"

#include <QMutex>
#include <QString>
#include <QUrl>

#include <atomic>
#include <functional>
#include <memory>
#include <optional>

namespace community {

class UploadService
{
public:
    struct Config {
        QString root;   // <CONFIG_PATH>/community-upload
        QString communityBase = QString::fromLatin1(kDefaultCommunityBase);   // COMMUNITY_API_BASE
        QString machineBase = QString::fromLatin1(kDefaultMachineBase);       // MACHINE_API_BASE
        std::function<qint64()> clock;   // unix seconds; the system clock when empty
    };

    // CommunityUploadService::new: creates the directories, loads (or creates) state.json, removes
    // orphaned queue bodies and checks the base URLs. nullptr with the error otherwise.
    static std::unique_ptr<UploadService> create(const Config &config, QString *error);

    QString statePath() const { return m_statePath; }
    QString queueDir() const { return m_queueDir; }
    QString diagnosticsPath() const;
    qint64 now() const;

    // --- the commands (lib.rs) -----------------------------------------------------------------
    UploadStatus status() const;
    QString requestHistoryScan();
    std::optional<Enrollment> beginEnrollment(const std::optional<QString> &machineSerial, QString *error);
    QString setPaused(bool paused);
    QString disconnect(HttpClient &http);   // network: off the GUI thread
    QString factoryResetLocal();

    // --- the worker loop (CommunityUploadService::start) ---------------------------------------
    bool workerIsReady() const;
    // One tick; nullopt when it succeeded.
    std::optional<RequestFailure> workerTick(HttpClient &http);
    void clearWorkerFailureCount();
    void recordWorkerFailure(const RequestFailure &failure);

    // --- the steps, public for the unit tests ---------------------------------------------------
    void expireLocalEnrollment();
    bool tryExchange(HttpClient &http, RequestFailure *failure);
    bool observeNewShots(HttpClient &http, HistoryKind kind, bool *complete, RequestFailure *failure);
    bool queueHistoryPath(HttpClient &http, HistoryKind kind, const QString &historyPath, RequestFailure *failure);
    bool ensureQueueCapacity(quint64 additionalBytes, RequestFailure *failure);
    bool uploadNextShot(HttpClient &http, RequestFailure *failure);
    std::optional<QString> ensureAccessToken(HttpClient &http, RequestFailure *failure);
    bool revokeCurrent(HttpClient &http, RequestFailure *failure);
    bool completeQueueItem(const QString &id, const QString &bodyPath, RequestFailure *failure);
    bool historyScanIsDue();
    void scheduleNextHistoryScan(qint64 delaySeconds);
    void scheduleWorkerAfter(qint64 delaySeconds);

    PersistentState persistentSnapshot() const;
    VolatileState volatileSnapshot() const;
    // For the tests: replace the state without writing it.
    void setPersistentForTests(const PersistentState &state);

private:
    UploadService(const QString &root, const QUrl &communityBase, const QUrl &machineBase,
                  std::function<qint64()> clock, PersistentState persistent);

    // mutate_persistent: mutate a copy, persist it, then apply it. The mutation returns "" or an error.
    QString mutatePersistent(const std::function<QString(PersistentState &)> &mutate);
    // mutate_persistent_failure: the same with a temporary state_persist_failed failure.
    bool mutatePersistentFailure(const std::function<QString(PersistentState &)> &mutate, RequestFailure *failure);
    void publishStatusLocked();

    std::optional<std::optional<QString>> fetchLastHistoryPath(HttpClient &http, HistoryKind kind,
                                                                RequestFailure *failure);
    std::optional<QStringList> fetchHistoryPaths(HttpClient &http, HistoryKind kind, const std::optional<QString> &after,
                                                 RequestFailure *failure);
    bool skipHistoryPath(HistoryKind kind, const QString &historyPath, const QString &category, RequestFailure *failure);
    bool dropQueueItem(const QString &id, const QString &category, RequestFailure *failure);
    bool deferQueueItem(const QueuedShot &queued, const RequestFailure &failure, RequestFailure *error);
    bool discardRejectedQueueItem(const QueuedShot &queued, const RequestFailure &failure, RequestFailure *error);
    bool retireLocalAuthorization(const QString &category, RequestFailure *failure);
    void recordRetry(const QString &category, qint64 delaySeconds);
    void updateServerClock(const HttpResponse &response);
    RequestFailure responseFailure(const HttpResponse &response, const QString &fallback);
    QUrl communityUrl(const char *path) const;

    const QString m_statePath;
    const QString m_queueDir;
    const QUrl m_communityBase;
    const QUrl m_machineBase;
    const std::function<qint64()> m_clock;

    mutable QMutex m_mutex;
    PersistentState m_persistent;
    VolatileState m_volatile;

    mutable QMutex m_statusMutex;
    UploadStatus m_status;
    std::atomic<bool> m_scanRequested{false};
};

// read_bounded_response + serde_json::from_slice for control responses (256 KiB).
std::optional<JsonValue> parseControlResponse(const HttpResponse &response);

}   // namespace community
