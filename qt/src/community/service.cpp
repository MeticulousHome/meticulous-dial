#include "service.h"

#include "crypto.h"
#include "storage.h"

#include <QDateTime>
#include <QDir>
#include <QFile>

#include <algorithm>
#include <limits>
#include <unistd.h>

namespace community {

namespace {
const QByteArray kJson = QByteArrayLiteral("application/json");
const QByteArray kControlBody = QByteArrayLiteral("{\"contractVersion\":1}");

QString debugOptional(const std::optional<qint64> &value)
{
    return value ? QStringLiteral("Some(%1)").arg(*value) : QStringLiteral("None");
}

void removeFile(const QString &path)
{
    ::unlink(QFile::encodeName(path).constData());
}

// Url::parse plus the scheme check of CommunityUploadService::new.
QString checkBase(const QString &text, QUrl *url, const char *invalid, const char *unsupported)
{
    *url = QUrl(text, QUrl::StrictMode);
    if (!url->isValid() || url->scheme().isEmpty())
        return QString::fromLatin1(invalid);
    const QString scheme = url->scheme();
    if (scheme != QLatin1String("https") && scheme != QLatin1String("http"))
        return QString::fromLatin1(unsupported);
    if (url->host().isEmpty())
        return QString::fromLatin1(invalid);   // special schemes need a host
    return QString();
}
}   // namespace

std::optional<JsonValue> parseControlResponse(const HttpResponse &response)
{
    if (response.contentLength && *response.contentLength > kMaxControlResponseBytes)
        return std::nullopt;   // response_too_large
    if (response.bodyFailed)
        return std::nullopt;   // response_read_failed
    if (response.bodyCut || response.body.size() > kMaxControlResponseBytes)
        return std::nullopt;   // response_too_large
    return parseJson(response.body);
}

std::unique_ptr<UploadService> UploadService::create(const Config &config, QString *error)
{
    const QString root = config.root;
    const QString queueDir = root + QStringLiteral("/queue");
    const std::function<qint64()> clock =
        config.clock ? config.clock : std::function<qint64()>([] { return QDateTime::currentSecsSinceEpoch(); });
    if (!storage::createPrivateDir(root) || !storage::createPrivateDir(queueDir)) {
        *error = QString::fromLatin1(kStorageUnavailable);
        return nullptr;
    }
    const QString statePath = root + QStringLiteral("/state.json");
    auto persistent = storage::loadOrCreateState(statePath, clock());
    if (!persistent || !storage::removeOrphanedQueueFiles(queueDir, persistent->queue)) {
        *error = QString::fromLatin1(kStorageUnavailable);
        return nullptr;
    }
    QUrl communityBase;
    QUrl machineBase;
    QString invalid = checkBase(config.communityBase, &communityBase, "Invalid COMMUNITY_API_BASE",
                                "Unsupported Community API scheme");
    if (invalid.isEmpty())
        invalid = checkBase(config.machineBase, &machineBase, "Invalid MACHINE_API_BASE", "Unsupported machine API scheme");
    if (!invalid.isEmpty()) {
        *error = invalid;
        return nullptr;
    }
    return std::unique_ptr<UploadService>(
        new UploadService(root, communityBase, machineBase, clock, std::move(*persistent)));
}

UploadService::UploadService(const QString &root, const QUrl &communityBase, const QUrl &machineBase,
                             std::function<qint64()> clock, PersistentState persistent)
    : m_statePath(root + QStringLiteral("/state.json")), m_queueDir(root + QStringLiteral("/queue")),
      m_communityBase(communityBase), m_machineBase(machineBase), m_clock(std::move(clock)),
      m_persistent(std::move(persistent))
{
    m_status = statusOf(m_persistent);
}

QString UploadService::diagnosticsPath() const
{
    return QFileInfo(m_statePath).path() + QStringLiteral("/diagnostics.json");
}

qint64 UploadService::now() const
{
    return m_clock();
}

UploadStatus UploadService::status() const
{
    QMutexLocker locker(&m_statusMutex);
    return m_status;
}

void UploadService::publishStatusLocked()
{
    const UploadStatus status = statusOf(m_persistent);
    QMutexLocker locker(&m_statusMutex);
    m_status = status;
}

PersistentState UploadService::persistentSnapshot() const
{
    QMutexLocker locker(&m_mutex);
    return m_persistent;
}

VolatileState UploadService::volatileSnapshot() const
{
    QMutexLocker locker(&m_mutex);
    return m_volatile;
}

void UploadService::setPersistentForTests(const PersistentState &state)
{
    QMutexLocker locker(&m_mutex);
    m_persistent = state;
    publishStatusLocked();
}

QString UploadService::mutatePersistent(const std::function<QString(PersistentState &)> &mutate)
{
    QMutexLocker locker(&m_mutex);
    PersistentState next = m_persistent;
    const QString error = mutate(next);
    if (!error.isEmpty())
        return error;
    if (!storage::persistState(m_statePath, next))
        return QString::fromLatin1(kStorageUnavailable);
    m_persistent = std::move(next);
    publishStatusLocked();
    return QString();
}

bool UploadService::mutatePersistentFailure(const std::function<QString(PersistentState &)> &mutate,
                                            RequestFailure *failure)
{
    if (mutatePersistent(mutate).isEmpty())
        return true;
    *failure = temporary(QStringLiteral("state_persist_failed"));
    return false;
}

// --- commands -----------------------------------------------------------------------------------

QString UploadService::requestHistoryScan()
{
    // Rust sets history_scan_not_before = 0 under the state lock; the flag does the same at the next
    // tick without making the GUI thread wait for a state.json write in progress.
    m_scanRequested.store(true);
    return QString();
}

std::optional<Enrollment> UploadService::beginEnrollment(const std::optional<QString> &machineSerial, QString *error)
{
    std::optional<QString> serial;
    if (machineSerial) {
        // .trim().chars().take(128): 128 Unicode scalar values.
        const QString trimmed = machineSerial->trimmed();
        QString taken;
        int chars = 0;
        for (int i = 0; i < trimmed.size() && chars < 128; ++chars) {
            const bool pair = trimmed[i].isHighSurrogate() && i + 1 < trimmed.size() && trimmed[i + 1].isLowSurrogate();
            taken.append(trimmed.mid(i, pair ? 2 : 1));
            i += pair ? 2 : 1;
        }
        if (!taken.isEmpty())
            serial = taken;
    }
    const qint64 issuedAt = now();
    EnrollmentState enrollment;
    enrollment.challenge = crypto::base64UrlEncode(crypto::randomBytes(32));
    enrollment.issuedAt = issuedAt;
    enrollment.machineSerial = serial;

    QString installationId;
    QString publicKey;
    const QString failed = mutatePersistent([&](PersistentState &state) -> QString {
        if (state.keyId)
            return QStringLiteral("Community backup is already connected");
        state.enrollment = enrollment;
        state.lastError.reset();
        installationId = state.installationId;
        publicKey = state.publicKey;
        return QString();
    });
    if (!failed.isEmpty()) {
        *error = failed;
        return std::nullopt;
    }
    const QByteArray payload = enrollmentPayload(installationId, enrollment, publicKey);
    return Enrollment{enrollmentQrUrl(m_communityBase, payload), issuedAt + kEnrollmentTtlSeconds};
}

QString UploadService::setPaused(bool paused)
{
    return mutatePersistent([&](PersistentState &state) -> QString {
        if (!state.keyId)
            return QStringLiteral("Community backup is not connected");
        state.paused = paused;
        state.lastError.reset();
        return QString();
    });
}

QString UploadService::disconnect(HttpClient &http)
{
    bool connected = false;
    {
        QMutexLocker locker(&m_mutex);
        connected = m_persistent.keyId.has_value();
    }
    if (connected) {
        RequestFailure failure;
        if (!revokeCurrent(http, &failure)) {
            recordRetry(failure.category, failure.retryAfterSeconds.value_or(5));
            return QStringLiteral("Could not disconnect from Community. Check the internet connection and try again.");
        }
    }
    return factoryResetLocal();
}

QString UploadService::factoryResetLocal()
{
    QStringList queueFiles;
    const QString failed = mutatePersistent([&](PersistentState &state) -> QString {
        QStringList files;
        for (const QueuedShot &item : state.queue)
            files.append(item.bodyFile);
        auto fresh = freshState();
        if (!fresh)
            return QString::fromLatin1(kStorageUnavailable);
        state = std::move(*fresh);
        queueFiles = files;
        return QString();
    });
    if (!failed.isEmpty())
        return failed;
    for (const QString &file : queueFiles)
        removeFile(m_queueDir + QLatin1Char('/') + file);
    QMutexLocker locker(&m_mutex);
    m_volatile = VolatileState();
    return QString();
}

// --- worker -------------------------------------------------------------------------------------

std::optional<RequestFailure> UploadService::workerTick(HttpClient &http)
{
    expireLocalEnrollment();
    std::optional<EnrollmentState> enrollment;
    bool hasKey = false;
    bool paused = false;
    {
        QMutexLocker locker(&m_mutex);
        enrollment = m_persistent.enrollment;
        hasKey = m_persistent.keyId.has_value();
        paused = m_persistent.paused;
    }
    RequestFailure failure;
    if (!hasKey) {
        if (enrollment && !tryExchange(http, &failure))
            return failure;
        return std::nullopt;
    }
    if (paused)
        return std::nullopt;

    // Drain one durable item first so a full queue can always make progress.
    if (!uploadNextShot(http, &failure))
        return failure;
    if (historyScanIsDue()) {
        bool espressoComplete = false;
        bool pourOverComplete = false;
        if (!observeNewShots(http, HistoryKind::Espresso, &espressoComplete, &failure))
            return failure;
        if (!observeNewShots(http, HistoryKind::PourOver, &pourOverComplete, &failure))
            return failure;
        scheduleNextHistoryScan(espressoComplete && pourOverComplete ? kHistoryPollSeconds : 5);
    }
    return std::nullopt;
}

void UploadService::expireLocalEnrollment()
{
    bool expired = false;
    {
        QMutexLocker locker(&m_mutex);
        expired = m_persistent.enrollment && enrollmentExchangeExpired(m_persistent.enrollment->issuedAt, now()) &&
                  !m_persistent.keyId;
    }
    if (expired) {
        mutatePersistent([](PersistentState &state) -> QString {
            state.enrollment.reset();
            state.lastError = QStringLiteral("pairing_code_expired");
            return QString();
        });
    }
}

QUrl UploadService::communityUrl(const char *path) const
{
    return urlWithPath(m_communityBase, QString::fromLatin1(path));
}

bool UploadService::tryExchange(HttpClient &http, RequestFailure *failure)
{
    QString installationId;
    QString privateSeed;
    EnrollmentState enrollment;
    qint64 timestamp = 0;
    {
        QMutexLocker locker(&m_mutex);
        if (!m_persistent.enrollment) {
            *failure = temporary(QStringLiteral("enrollment_missing"));
            return false;
        }
        installationId = m_persistent.installationId;
        privateSeed = m_persistent.privateSeed;
        enrollment = *m_persistent.enrollment;
        timestamp = now() + m_volatile.clockOffsetSeconds;
    }
    const QByteArray body = exchangeBody(installationId, enrollment.challenge);
    HttpRequest request;
    request.method = "POST";
    request.url = communityUrl(kExchangePath);
    request.headers.append({"Content-Type", kJson});
    if (!enrollmentHeaders(installationId, privateSeed, timestamp, QString::fromLatin1(kExchangePath), body,
                           &request.headers, failure))
        return false;
    request.body = body;
    request.hasBody = true;
    request.maxBodyBytes = kMaxControlResponseBytes;
    const HttpResponse response = http.send(request);
    if (!response.received) {
        *failure = temporary(QStringLiteral("exchange_network"));
        return false;
    }
    updateServerClock(response);
    if (response.status == 202) {
        std::optional<qint64> retryAfter;
        if (const auto header = response.header("retry-after"))
            retryAfter = parseI64(*header);
        scheduleWorkerAfter(retryAfter.value_or(2));
        return true;
    }
    if (!response.isSuccess()) {
        const RequestFailure rejected = responseFailure(response, QStringLiteral("exchange_failed"));
        if (rejected.permanent) {
            const bool persisted = mutatePersistentFailure(
                [&](PersistentState &state) -> QString {
                    state.enrollment.reset();
                    state.lastError = rejected.category;
                    state.lastRetryAt.reset();
                    return QString();
                },
                failure);
            if (!persisted)
                return false;
        }
        *failure = rejected;
        return false;
    }
    const auto parsed = parseControlResponse(response);
    const auto exchanged = parsed ? parseExchangeResponse(*parsed) : std::nullopt;
    if (!exchanged) {
        *failure = temporary(QStringLiteral("exchange_response_invalid"));
        return false;
    }
    const bool persisted = mutatePersistentFailure(
        [&](PersistentState &state) -> QString {
            state.authorizationId = exchanged->authorizationId;
            state.keyId = exchanged->keyId;
            state.keyVersion = exchanged->keyVersion;
            state.enrollment.reset();
            state.paused = false;
            state.historyBaselined = false;
            state.historyCursor.reset();
            state.pourOverHistoryBaselined = false;
            state.pourOverHistoryCursor.reset();
            state.lastError.reset();
            return QString();
        },
        failure);
    if (!persisted)
        return false;
    QMutexLocker locker(&m_mutex);
    m_volatile.accessToken = exchanged->accessToken;
    m_volatile.accessTokenExpiresAt = now() + kAccessTokenLifetimeSeconds;
    return true;
}

bool UploadService::observeNewShots(HttpClient &http, HistoryKind kind, bool *complete, RequestFailure *failure)
{
    const bool espresso = kind == HistoryKind::Espresso;
    bool baselined = false;
    std::optional<QString> cursor;
    {
        QMutexLocker locker(&m_mutex);
        baselined = espresso ? m_persistent.historyBaselined : m_persistent.pourOverHistoryBaselined;
        cursor = espresso ? m_persistent.historyCursor : m_persistent.pourOverHistoryCursor;
    }
    if (!baselined) {
        const auto latest = fetchLastHistoryPath(http, kind, failure);
        if (!latest)
            return false;
        const bool persisted = mutatePersistentFailure(
            [&](PersistentState &state) -> QString {
                if (espresso) {
                    state.historyBaselined = true;
                    state.historyCursor = *latest;
                } else {
                    state.pourOverHistoryBaselined = true;
                    state.pourOverHistoryCursor = *latest;
                }
                return QString();
            },
            failure);
        if (!persisted)
            return false;
        *complete = true;
        return true;
    }

    const auto paths = fetchHistoryPaths(http, kind, cursor, failure);
    if (!paths)
        return false;
    const bool pageComplete = paths->size() < 200;
    for (const QString &path : *paths) {
        std::optional<QString> currentCursor;
        {
            QMutexLocker locker(&m_mutex);
            currentCursor = espresso ? m_persistent.historyCursor : m_persistent.pourOverHistoryCursor;
        }
        if (currentCursor && !utf8Less(*currentCursor, path))
            continue;   // cursor >= path
        RequestFailure queueFailure;
        if (queueHistoryPath(http, kind, path, &queueFailure))
            continue;
        if (queueFailure.category == QLatin1String("queue_capacity_reached")) {
            *complete = false;
            return true;
        }
        if (queueFailure.permanent) {
            if (!skipHistoryPath(kind, path, queueFailure.category, failure))
                return false;
            continue;
        }
        *failure = queueFailure;
        return false;
    }
    *complete = pageComplete;
    return true;
}

std::optional<std::optional<QString>> UploadService::fetchLastHistoryPath(HttpClient &http, HistoryKind kind,
                                                                          RequestFailure *failure)
{
    const bool espresso = kind == HistoryKind::Espresso;
    const QString unavailable =
        espresso ? QStringLiteral("machine_history_unavailable") : QStringLiteral("machine_pour_over_history_unavailable");
    const QString invalid =
        espresso ? QStringLiteral("machine_history_invalid") : QStringLiteral("machine_pour_over_history_invalid");
    HttpRequest request;
    request.url = urlWithPath(m_machineBase, espresso ? QStringLiteral("/api/v1/history/last")
                                                      : QStringLiteral("/api/v1/history/pour-over/last"));
    request.maxBodyBytes = kMaxControlResponseBytes;
    const HttpResponse response = http.send(request);
    if (!response.received) {
        *failure = temporary(unavailable);
        return std::nullopt;
    }
    if (response.status == 404 || response.status == 204)
        return std::optional<QString>();
    if (!response.isSuccess()) {
        *failure = temporary(unavailable);
        return std::nullopt;
    }
    const auto parsed = parseControlResponse(response);
    if (!parsed) {
        *failure = temporary(invalid);
        return std::nullopt;
    }
    const auto file = (*parsed)[QStringLiteral("file")].asString();
    if (!file)
        return std::optional<QString>();
    const auto normalized = normalizeHistoryPath(*file);
    if (!normalized) {
        *failure = permanent(QStringLiteral("history_path_invalid"));
        return std::nullopt;
    }
    return std::optional<QString>(*normalized);
}

std::optional<QStringList> UploadService::fetchHistoryPaths(HttpClient &http, HistoryKind kind,
                                                            const std::optional<QString> &after, RequestFailure *failure)
{
    const bool espresso = kind == HistoryKind::Espresso;
    const QString unavailable =
        espresso ? QStringLiteral("machine_history_unavailable") : QStringLiteral("machine_pour_over_history_unavailable");
    const QString invalid =
        espresso ? QStringLiteral("machine_history_invalid") : QStringLiteral("machine_pour_over_history_invalid");
    HttpRequest request;
    request.url = m_machineBase;
    request.target = machineHistoryListTarget(espresso ? QStringLiteral("/api/v1/history/upload-index")
                                                       : QStringLiteral("/api/v1/history/pour-over"),
                                              !espresso, after);
    request.maxBodyBytes = kMaxControlResponseBytes;
    const HttpResponse response = http.send(request);
    if (!response.received || !response.isSuccess()) {
        *failure = temporary(unavailable);
        return std::nullopt;
    }
    const auto parsed = parseControlResponse(response);
    const auto entries = parsed ? parseHistoryResponse(*parsed) : std::nullopt;
    if (!entries) {
        *failure = temporary(invalid);
        return std::nullopt;
    }
    QStringList paths;
    for (const QString &entry : *entries) {
        const auto normalized = normalizeHistoryPath(entry);
        if (!normalized) {
            *failure = permanent(QStringLiteral("history_path_invalid"));
            return std::nullopt;
        }
        paths.append(*normalized);
    }
    std::sort(paths.begin(), paths.end(), utf8Less);
    paths.erase(std::unique(paths.begin(), paths.end()), paths.end());
    return paths;
}

bool UploadService::queueHistoryPath(HttpClient &http, HistoryKind kind, const QString &historyPath,
                                     RequestFailure *failure)
{
    if (!ensureQueueCapacity(0, failure))
        return false;
    const auto target = machineHistoryFileTarget(kind, historyPath);
    if (!target) {
        *failure = permanent(QStringLiteral("history_path_invalid"));
        return false;
    }
    HttpRequest request;
    request.url = m_machineBase;
    request.target = *target;
    request.maxBodyBytes = kMaxShotBodyBytes;
    const HttpResponse response = http.send(request);
    if (!response.received || !response.isSuccess()) {
        *failure = temporary(QStringLiteral("shot_file_pending"));
        return false;
    }
    if (response.contentLength.value_or(0) > kMaxShotBodyBytes) {
        *failure = permanent(QStringLiteral("shot_file_too_large"));
        return false;
    }
    if (response.bodyFailed) {
        *failure = temporary(QStringLiteral("shot_file_pending"));
        return false;
    }
    if (response.bodyCut || response.body.size() > kMaxShotBodyBytes) {
        *failure = permanent(QStringLiteral("shot_file_too_large"));
        return false;
    }
    QString sourceShotId;
    {
        const auto parsed = parseJson(response.body);
        if (!parsed) {
            *failure = temporary(QStringLiteral("shot_file_pending"));
            return false;
        }
        if (!validateHistoryRecord(*parsed, kind, &sourceShotId, failure))
            return false;
    }
    const QByteArray body = wrapShotBody(response.body);
    if (body.size() > kMaxShotBodyBytes) {
        *failure = permanent(QStringLiteral("shot_file_too_large"));
        return false;
    }
    if (!ensureQueueCapacity(quint64(body.size()), failure))
        return false;

    const QString id = crypto::newUuid();
    const QString bodyFile = id + QStringLiteral(".json");
    const QString bodyPath = m_queueDir + QLatin1Char('/') + bodyFile;
    if (!storage::writePrivateFileAtomic(bodyPath, body)) {
        *failure = temporary(QStringLiteral("queue_write_failed"));
        return false;
    }
    QueuedShot queued;
    queued.id = id;
    queued.sourceShotId = sourceShotId;
    queued.historyPath = historyPath;
    queued.historyKind = kind;
    queued.bodyFile = bodyFile;
    queued.attemptCount = 0;
    queued.nextAttemptAt = now();
    const bool persisted = mutatePersistentFailure(
        [&](PersistentState &state) -> QString {
            state.queue.append(queued);
            if (kind == HistoryKind::Espresso)
                state.historyCursor = historyPath;
            else
                state.pourOverHistoryCursor = historyPath;
            state.lastError.reset();
            return QString();
        },
        failure);
    if (!persisted) {
        removeFile(bodyPath);
        return false;
    }
    qInfo("[CommunityUpload] queued kind=%s history_path=%s source_id=%s", historyKindDebug(kind),
          qUtf8Printable(historyPath), qUtf8Printable(sourceShotId));
    return true;
}

bool UploadService::ensureQueueCapacity(quint64 additionalBytes, RequestFailure *failure)
{
    int count = 0;
    QStringList bodyFiles;
    {
        QMutexLocker locker(&m_mutex);
        count = m_persistent.queue.size();
        if (count >= kMaxQueueItems) {
            *failure = temporary(QStringLiteral("queue_capacity_reached"));
            return false;
        }
        for (const QueuedShot &item : m_persistent.queue)
            bodyFiles.append(item.bodyFile);
    }
    quint64 currentBytes = 0;
    for (const QString &file : bodyFiles) {
        const quint64 size = storage::fileSize(m_queueDir + QLatin1Char('/') + file);
        currentBytes = size > std::numeric_limits<quint64>::max() - currentBytes ? std::numeric_limits<quint64>::max()
                                                                                 : currentBytes + size;
    }
    if (!queueCapacityAllows(count, currentBytes, additionalBytes)) {
        *failure = temporary(QStringLiteral("queue_capacity_reached"));
        return false;
    }
    return true;
}

bool UploadService::uploadNextShot(HttpClient &http, RequestFailure *failure)
{
    std::optional<QueuedShot> queued;
    {
        QMutexLocker locker(&m_mutex);
        queued = nextDueQueueItem(m_persistent.queue, now());
    }
    if (!queued)
        return true;
    const QString bodyPath = m_queueDir + QLatin1Char('/') + queued->bodyFile;
    QByteArray body;
    {
        QFile file(bodyPath);
        bool read = file.open(QIODevice::ReadOnly);
        if (read) {
            body = file.readAll();
            read = file.error() == QFileDevice::NoError;
        }
        if (!read) {
            if (!dropQueueItem(queued->id, QStringLiteral("queued_body_missing"), failure))
                return false;
            *failure = permanent(QStringLiteral("queued_body_missing"));
            return false;
        }
    }
    if (body.size() > kMaxShotBodyBytes) {
        if (!dropQueueItem(queued->id, QStringLiteral("queued_body_too_large"), failure))
            return false;
        removeFile(bodyPath);
        *failure = permanent(QStringLiteral("queued_body_too_large"));
        return false;
    }
    const auto token = ensureAccessToken(http, failure);
    if (!token)
        return false;
    QString installationId;
    QString keyId;
    quint32 keyVersion = 0;
    QString privateSeed;
    qint64 timestamp = 0;
    {
        QMutexLocker locker(&m_mutex);
        if (!m_persistent.keyId || !m_persistent.keyVersion) {
            *failure = permanent(QStringLiteral("key_missing"));
            return false;
        }
        installationId = m_persistent.installationId;
        keyId = *m_persistent.keyId;
        keyVersion = *m_persistent.keyVersion;
        privateSeed = m_persistent.privateSeed;
        timestamp = now() + m_volatile.clockOffsetSeconds;
    }
    HttpRequest request;
    request.method = "POST";
    request.url = communityUrl(kShotPath);
    request.headers.append({"Content-Type", kJson});
    request.headers.append({"Authorization", QByteArrayLiteral("Bearer ") + token->toUtf8()});
    if (!signedHeaders(keyId, keyVersion, privateSeed, timestamp, QStringLiteral("POST"), QString::fromLatin1(kShotPath),
                       body, &request.headers, failure))
        return false;
    request.headers.append({"x-meticulous-idempotency-key", idempotencyKey(installationId, queued->sourceShotId).toLatin1()});
    request.body = body;
    request.hasBody = true;
    request.maxBodyBytes = kMaxControlResponseBytes;
    const HttpResponse response = http.send(request);
    if (!response.received) {
        *failure = temporary(QStringLiteral("upload_network"));
        return false;
    }
    updateServerClock(response);
    if (response.isSuccess()) {
        if (!completeQueueItem(queued->id, bodyPath, failure))
            return false;
        qInfo("[CommunityUpload] upload_succeeded kind=%s history_path=%s source_id=%s",
              historyKindDebug(queued->historyKind), qUtf8Printable(queued->historyPath),
              qUtf8Printable(queued->sourceShotId));
        return true;
    }
    const RequestFailure rejected =
        reclassifyUploadFailure(responseFailure(response, QStringLiteral("upload_failed")), queued->historyKind);
    if (rejected.category == QLatin1String("invalid_access") || rejected.category == QLatin1String("expired_request")) {
        QMutexLocker locker(&m_mutex);
        m_volatile.accessToken.reset();
        m_volatile.accessTokenExpiresAt = 0;
    }
    if (authorizationIsRetired(rejected.category)) {
        if (!retireLocalAuthorization(rejected.category, failure))
            return false;
        *failure = rejected;
        return false;
    }
    if (rejected.permanent) {
        if (!discardRejectedQueueItem(*queued, rejected, failure))
            return false;
        *failure = rejected;
        return false;
    }
    if (!deferQueueItem(*queued, rejected, failure))
        return false;
    qWarning("[CommunityUpload] upload_deferred kind=%s history_path=%s category=%s retry_after_seconds=%s",
             historyKindDebug(queued->historyKind), qUtf8Printable(queued->historyPath), qUtf8Printable(rejected.category),
             qUtf8Printable(debugOptional(rejected.retryAfterSeconds)));
    if (rejected.category == QLatin1String("community_pour_over_not_ready")) {
        // This item has its own slow retry. Keep servicing later records instead of applying a
        // worker-wide backoff.
        return true;
    }
    *failure = rejected;
    return false;
}

std::optional<QString> UploadService::ensureAccessToken(HttpClient &http, RequestFailure *failure)
{
    QString keyId;
    quint32 keyVersion = 0;
    QString privateSeed;
    qint64 timestamp = 0;
    {
        QMutexLocker locker(&m_mutex);
        if (m_volatile.accessTokenExpiresAt > now() + 20 && m_volatile.accessToken)
            return m_volatile.accessToken;
        if (!m_persistent.keyId || !m_persistent.keyVersion) {
            *failure = permanent(QStringLiteral("key_missing"));
            return std::nullopt;
        }
        keyId = *m_persistent.keyId;
        keyVersion = *m_persistent.keyVersion;
        privateSeed = m_persistent.privateSeed;
        timestamp = now() + m_volatile.clockOffsetSeconds;
    }
    HttpRequest request;
    request.method = "POST";
    request.url = communityUrl(kTokenPath);
    request.headers.append({"Content-Type", kJson});
    if (!signedHeaders(keyId, keyVersion, privateSeed, timestamp, QStringLiteral("POST"), QString::fromLatin1(kTokenPath),
                       kControlBody, &request.headers, failure))
        return std::nullopt;
    request.body = kControlBody;
    request.hasBody = true;
    request.maxBodyBytes = kMaxControlResponseBytes;
    const HttpResponse response = http.send(request);
    if (!response.received) {
        *failure = temporary(QStringLiteral("token_network"));
        return std::nullopt;
    }
    updateServerClock(response);
    if (!response.isSuccess()) {
        const RequestFailure rejected = responseFailure(response, QStringLiteral("token_failed"));
        if (authorizationIsRetired(rejected.category) && !retireLocalAuthorization(rejected.category, failure))
            return std::nullopt;
        *failure = rejected;
        return std::nullopt;
    }
    const auto parsed = parseControlResponse(response);
    const auto token = parsed ? parseTokenResponse(*parsed) : std::nullopt;
    if (!token) {
        *failure = temporary(QStringLiteral("token_response_invalid"));
        return std::nullopt;
    }
    QMutexLocker locker(&m_mutex);
    m_volatile.accessToken = *token;
    m_volatile.accessTokenExpiresAt = now() + kAccessTokenLifetimeSeconds;
    return token;
}

bool UploadService::revokeCurrent(HttpClient &http, RequestFailure *failure)
{
    const auto token = ensureAccessToken(http, failure);
    if (!token)
        return false;
    QString keyId;
    quint32 keyVersion = 0;
    QString privateSeed;
    qint64 timestamp = 0;
    {
        QMutexLocker locker(&m_mutex);
        if (!m_persistent.keyId || !m_persistent.keyVersion) {
            *failure = permanent(QStringLiteral("key_missing"));
            return false;
        }
        keyId = *m_persistent.keyId;
        keyVersion = *m_persistent.keyVersion;
        privateSeed = m_persistent.privateSeed;
        timestamp = now() + m_volatile.clockOffsetSeconds;
    }
    HttpRequest request;
    request.method = "DELETE";
    request.url = communityUrl(kRevokePath);
    request.headers.append({"Content-Type", kJson});
    request.headers.append({"Authorization", QByteArrayLiteral("Bearer ") + token->toUtf8()});
    if (!signedHeaders(keyId, keyVersion, privateSeed, timestamp, QStringLiteral("DELETE"),
                       QString::fromLatin1(kRevokePath), kControlBody, &request.headers, failure))
        return false;
    request.body = kControlBody;
    request.hasBody = true;
    request.maxBodyBytes = kMaxControlResponseBytes;
    const HttpResponse response = http.send(request);
    if (!response.received) {
        *failure = temporary(QStringLiteral("disconnect_network"));
        return false;
    }
    updateServerClock(response);
    if (!response.isSuccess()) {
        const RequestFailure rejected = responseFailure(response, QStringLiteral("disconnect_failed"));
        if (authorizationIsRetired(rejected.category))
            return true;
        *failure = rejected;
        return false;
    }
    return true;
}

bool UploadService::completeQueueItem(const QString &id, const QString &bodyPath, RequestFailure *failure)
{
    const bool persisted = mutatePersistentFailure(
        [&](PersistentState &state) -> QString {
            state.queue.erase(std::remove_if(state.queue.begin(), state.queue.end(),
                                             [&](const QueuedShot &item) { return item.id == id; }),
                              state.queue.end());
            state.lastSuccessAt = now();
            state.lastError.reset();
            state.lastRetryAt.reset();
            return QString();
        },
        failure);
    if (!persisted)
        return false;
    diagnostics::recovered();
    removeFile(bodyPath);
    return true;
}

bool UploadService::deferQueueItem(const QueuedShot &queued, const RequestFailure &failure, RequestFailure *error)
{
    diagnostics::failure(failure.category, failure.status, failure.retryAfterSeconds, std::nullopt);
    return mutatePersistentFailure(
        [&](PersistentState &state) -> QString {
            scheduleQueueRetry(state, queued.id, failure, now());
            return QString();
        },
        error);
}

bool UploadService::discardRejectedQueueItem(const QueuedShot &queued, const RequestFailure &failure,
                                             RequestFailure *error)
{
    // A permanently rejected record can never leave the bounded queue on its own; parking it would keep
    // a slot until uploads wedge, so drop the record and its body. The category stays in the status.
    if (!dropQueueItem(queued.id, failure.category, error))
        return false;
    removeFile(m_queueDir + QLatin1Char('/') + queued.bodyFile);
    qWarning("[CommunityUpload] upload_rejected_permanently kind=%s history_path=%s source_id=%s category=%s",
             historyKindDebug(queued.historyKind), qUtf8Printable(queued.historyPath), qUtf8Printable(queued.sourceShotId),
             qUtf8Printable(failure.category));
    return true;
}

bool UploadService::skipHistoryPath(HistoryKind kind, const QString &historyPath, const QString &category,
                                    RequestFailure *failure)
{
    qWarning("[CommunityUpload] history_rejected kind=%s history_path=%s category=%s", historyKindDebug(kind),
             qUtf8Printable(historyPath), qUtf8Printable(category));
    return mutatePersistentFailure(
        [&](PersistentState &state) -> QString {
            if (kind == HistoryKind::Espresso)
                state.historyCursor = historyPath;
            else
                state.pourOverHistoryCursor = historyPath;
            state.lastError = safeCategory(category);
            state.lastRetryAt.reset();
            return QString();
        },
        failure);
}

bool UploadService::dropQueueItem(const QString &id, const QString &category, RequestFailure *failure)
{
    return mutatePersistentFailure(
        [&](PersistentState &state) -> QString {
            state.queue.erase(std::remove_if(state.queue.begin(), state.queue.end(),
                                             [&](const QueuedShot &item) { return item.id == id; }),
                              state.queue.end());
            state.lastError = safeCategory(category);
            state.lastRetryAt.reset();
            return QString();
        },
        failure);
}

bool UploadService::retireLocalAuthorization(const QString &category, RequestFailure *failure)
{
    const bool persisted = mutatePersistentFailure(
        [&](PersistentState &state) -> QString {
            if (!rotateIdentityPreservingQueue(state))
                return QString::fromLatin1(kStorageUnavailable);
            state.authorizationId.reset();
            state.keyId.reset();
            state.keyVersion.reset();
            state.enrollment.reset();
            state.paused = false;
            state.lastError = safeCategory(category);
            state.lastRetryAt.reset();
            return QString();
        },
        failure);
    if (!persisted)
        return false;
    QMutexLocker locker(&m_mutex);
    m_volatile.accessToken.reset();
    m_volatile.accessTokenExpiresAt = 0;
    return true;
}

bool UploadService::workerIsReady() const
{
    QMutexLocker locker(&m_mutex);
    return m_volatile.workerNotBefore <= now();
}

bool UploadService::historyScanIsDue()
{
    QMutexLocker locker(&m_mutex);
    if (m_scanRequested.exchange(false))
        m_volatile.historyScanNotBefore = 0;
    return m_volatile.historyScanNotBefore <= now();
}

void UploadService::scheduleNextHistoryScan(qint64 delaySeconds)
{
    QMutexLocker locker(&m_mutex);
    m_volatile.historyScanNotBefore = now() + std::max<qint64>(delaySeconds, 1);
}

void UploadService::scheduleWorkerAfter(qint64 delaySeconds)
{
    QMutexLocker locker(&m_mutex);
    m_volatile.workerNotBefore = now() + std::max<qint64>(delaySeconds, 1);
}

void UploadService::clearWorkerFailureCount()
{
    QMutexLocker locker(&m_mutex);
    m_volatile.workerFailureCount = 0;
}

void UploadService::recordWorkerFailure(const RequestFailure &failure)
{
    diagnostics::failure(failure.category, failure.status, failure.retryAfterSeconds, std::nullopt);
    qint64 delay = 0;
    {
        QMutexLocker locker(&m_mutex);
        if (m_volatile.workerFailureCount < std::numeric_limits<quint32>::max())
            m_volatile.workerFailureCount += 1;
        const qint64 backoff = std::min<qint64>(qint64(1) << std::min<quint32>(m_volatile.workerFailureCount, 5), 30);
        delay = std::max<qint64>(failure.retryAfterSeconds.value_or(backoff), 1);
        m_volatile.workerNotBefore = now() + delay;
    }
    recordRetry(failure.category, delay);
}

void UploadService::recordRetry(const QString &category, qint64 delaySeconds)
{
    mutatePersistent([&](PersistentState &state) -> QString {
        state.lastError = safeCategory(category);
        state.lastRetryAt = now() + std::max<qint64>(delaySeconds, 1);
        return QString();
    });
}

void UploadService::updateServerClock(const HttpResponse &response)
{
    const auto header = response.header("x-meticulous-server-time");
    const auto serverTime = header ? parseI64(*header) : std::nullopt;
    if (!serverTime)
        return;
    QMutexLocker locker(&m_mutex);
    m_volatile.clockOffsetSeconds = *serverTime - now();
}

RequestFailure UploadService::responseFailure(const HttpResponse &response, const QString &fallback)
{
    std::optional<QString> requestId;
    if (const auto correlation = response.header("x-correlation-id"))
        requestId = QString::fromLatin1(*correlation);
    else if (const auto id = response.header("x-request-id"))
        requestId = QString::fromLatin1(*id);
    std::optional<qint64> retryAfter;
    if (const auto header = response.header("retry-after"))
        retryAfter = parseI64(*header);
    QString category = fallback;
    if (const auto parsed = parseControlResponse(response)) {
        if (const auto error = parseErrorResponse(*parsed))
            category = safeCategory(*error);
    }
    const quint16 status = quint16(response.status);
    diagnostics::failure(category, status, retryAfter, requestId);
    return RequestFailure{category, retryAfter, failureIsPermanent(status, category), status};
}

}   // namespace community
