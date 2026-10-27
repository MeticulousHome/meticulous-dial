#pragma once

// The Community uploader of the Tauri Dial (community_upload.rs and the commands of
// its lib.rs that drive it), exposed to QML as the `Community` singleton of Dial.Native.
//
// The uploader keeps the same files as the Tauri Dial (<CONFIG_PATH>/community-upload: state.json,
// queue/<uuid>.json, diagnostics.json) and speaks the same protocol, so either Dial can take over the
// other's enrollment and queue. Its worker thread ticks every 500 ms like the Rust thread: it finishes
// a pending enrollment, uploads the queue and scans the machine's history. Commands run on a command
// thread; the GUI thread only reads a status copy.
//
//   status                QVariantMap, camelCase: state ("not_connected" | "connected" | "upload_paused"
//                         | "unavailable"), connected, paused, pendingCount, lastSuccessAt, lastError,
//                         lastRetryAt, enrollmentExpiresAt (absent values are null). Refreshed every second,
//                         after each worker tick that changed it and after every call.
//   beginEnrollment(serial)    -> enrollmentResult({qrUrl, expiresAt}) or enrollmentResult({error})
//   setUploadPaused(paused)    -> operationFinished("setUploadPaused", error)   ("" = ok)
//   disconnect()               -> operationFinished("disconnect", error)        (revokes on the server)
//   factoryResetLocal()        "" or the error (synchronous: the factory reset waits for it)
//   scanHistory()              "" or the error (asks for a history scan at the next tick)

#include <QObject>
#include <QThreadPool>
#include <QTimer>
#include <QUrl>
#include <QVariantMap>

#include <atomic>
#include <functional>
#include <memory>

namespace community {
class UploadService;
struct UploadStatus;
}
class CommunityWorker;

class Community : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QVariantMap status READ status NOTIFY statusChanged)

public:
    // defaultMachineBase: the backend the uploader reads the history from when MACHINE_API_BASE is not
    // set (the Dial's --api URL; http://localhost:8080 on the machine).
    explicit Community(const QUrl &defaultMachineBase, QObject *parent = nullptr);
    ~Community() override;

    QVariantMap status() const { return m_status; }

    Q_INVOKABLE void beginEnrollment(const QString &machineSerial);
    Q_INVOKABLE void setUploadPaused(bool paused);
    Q_INVOKABLE void disconnect();
    Q_INVOKABLE QString factoryResetLocal();
    Q_INVOKABLE QString scanHistory();

    // Where the uploader keeps its files: $CONFIG_PATH, else /meticulous-user/config, else (a development
    // machine without /meticulous-user) <temp>/meticulous-dial-config, plus /community-upload.
    static QString storageRoot();

signals:
    void statusChanged();
    void enrollmentResult(const QVariantMap &result);
    void operationFinished(const QString &op, const QString &error);

private:
    void refreshStatus();
    void runCommand(std::function<void()> task);
    void stop();
    static void stopAtExit();

    std::unique_ptr<community::UploadService> m_service;
    QString m_unavailableError;
    QVariantMap m_status;
    std::unique_ptr<community::UploadStatus> m_lastStatus;
    QTimer m_refreshTimer;
    std::unique_ptr<QThreadPool> m_commands;
    std::atomic<bool> m_stop{false};
    CommunityWorker *m_worker = nullptr;
};
