#include "diagnostics.h"

#include "crypto.h"
#include "storage.h"

#include <QDateTime>
#include <QMutex>

namespace community::diagnostics {

static const char *const kCategories[] = {
    "upload_network",
    "token_network",
    "exchange_network",
    "disconnect_network",
    "machine_history_unavailable",
    "machine_pour_over_history_unavailable",
    "machine_history_invalid",
    "machine_history_too_large",
    "machine_history_incomplete",
    "machine_pour_over_history_invalid",
    "machine_pour_over_history_too_large",
    "machine_pour_over_history_incomplete",
    "response_read_failed",
    "response_too_large",
    "state_unavailable",
    "state_persist_failed",
    "queue_write_failed",
    "queue_capacity_reached",
    "queued_body_missing",
    "queued_body_too_large",
    "shot_file_pending",
    "shot_file_too_large",
    "shot_data_invalid",
    "shot_id_invalid",
    "history_path_invalid",
    "key_missing",
    "private_key_invalid",
    "header_invalid",
    "enrollment_missing",
    "pairing_code_expired",
    "invalid_exchange_body",
    "invalid_json",
    "invalid_payload",
    "expired_request",
    "replayed_request",
    "retired_or_revoked_access",
    "idempotency_payload_mismatch",
    "community_pour_over_not_ready",
    "pour_over_replay_scheduled",
    "pour_over_samples_invalid",
    "pour_over_duration_invalid",
    "pour_over_mode_invalid",
    "pour_over_pours_invalid",
    "pour_over_schema_invalid",
    "pour_over_targets_invalid",
    "pour_over_type_invalid",
    "upload_failed",
    "token_failed",
    "exchange_failed",
    "rate_limited",
    "other_error",
};

QString category(const QString &value)
{
    for (const char *known : kCategories) {
        if (value == QLatin1String(known))
            return value;
    }
    return QStringLiteral("other_error");
}

bool Events::failure(const JsonValue &event, qint64 now)
{
    // A request UUID changes on every retry; it must not defeat suppression.
    const bool same = m_last && (*m_last)[QStringLiteral("category")] == event[QStringLiteral("category")] &&
                      (*m_last)[QStringLiteral("httpStatus")] == event[QStringLiteral("httpStatus")];
    const bool shouldEmit = !same || now - m_lastEmitted >= 300;
    if (!same || event[QStringLiteral("requestId")].isString())
        m_last = event;
    if (shouldEmit)
        m_lastEmitted = now;
    return shouldEmit;
}

bool Events::takeLast()
{
    const bool had = m_last.has_value();
    m_last.reset();
    return had;
}

namespace {
QMutex &eventsMutex()
{
    static QMutex mutex;
    return mutex;
}
Events &events()
{
    static Events instance;
    return instance;
}
std::function<qint64()> &clock()
{
    static std::function<qint64()> instance = [] { return QDateTime::currentSecsSinceEpoch(); };
    return instance;
}
qint64 now()
{
    QMutexLocker locker(&eventsMutex());
    return clock()();
}
}   // namespace

void failure(const QString &code, std::optional<quint16> status, std::optional<qint64> retry,
             const std::optional<QString> &requestId)
{
    JsonValue event = JsonValue::object();
    event.insert(QStringLiteral("category"), JsonValue::string(category(code)));
    event.insert(QStringLiteral("httpStatus"), JsonValue::optional(status));
    const qint64 occurredAt = now();
    event.insert(QStringLiteral("occurredAt"), JsonValue::fromI64(occurredAt));
    event.insert(QStringLiteral("retryAfterSeconds"),
                 retry ? JsonValue::fromI64(std::max<qint64>(*retry, 0)) : JsonValue());
    std::optional<QString> parsedId;
    if (requestId)
        parsedId = crypto::parseUuid(*requestId);
    event.insert(QStringLiteral("requestId"), JsonValue::optional(parsedId));
    const qint64 at = now();
    QMutexLocker locker(&eventsMutex());
    if (events().failure(event, at))
        qWarning("[CommunityUpload] failure %s", event.toJson(true).constData());
}

void recovered()
{
    QMutexLocker locker(&eventsMutex());
    if (events().takeLast())
        qInfo("[CommunityUpload] upload_resumed");
}

std::optional<JsonValue> lastFailure()
{
    QMutexLocker locker(&eventsMutex());
    return events().last();
}

qint64 lastEmitted()
{
    QMutexLocker locker(&eventsMutex());
    return events().lastEmitted();
}

void resetForTests()
{
    QMutexLocker locker(&eventsMutex());
    events() = Events();
}

void setClockForTests(std::function<qint64()> value)
{
    QMutexLocker locker(&eventsMutex());
    clock() = std::move(value);
}

JsonValue snapshot(const JsonValue &status, qint64 capturedAt)
{
    JsonValue result = JsonValue::object();
    result.insert(QStringLiteral("schemaVersion"), JsonValue::fromU64(1));
    result.insert(QStringLiteral("capturedAt"), JsonValue::fromI64(capturedAt));
    for (const char *key : {"connected", "paused"}) {
        const auto value = status[QLatin1String(key)].asBool();
        result.insert(QLatin1String(key), value ? JsonValue::boolean(*value) : JsonValue());
    }
    for (const char *key : {"pendingCount", "lastSuccessAt", "lastRetryAt"}) {
        const auto value = status[QLatin1String(key)].asU64();
        result.insert(QLatin1String(key), value ? JsonValue::fromU64(*value) : JsonValue());
    }
    const auto lastError = status[QStringLiteral("lastError")].asString();
    result.insert(QStringLiteral("lastError"), lastError ? JsonValue::string(category(*lastError)) : JsonValue());
    // Compatible with recovery-enabled Dial versions without copying arbitrary fields.
    const JsonValue &source = status[QStringLiteral("recovery")];
    JsonValue recovery = JsonValue::object();
    if (source.isObject()) {
        recovery.insert(QStringLiteral("available"), JsonValue::boolean(true));
        static const char *const states[] = {"idle",   "pending", "scanning",    "uploading", "completed",
                                             "paused", "failed",  "interrupted", "running"};
        const auto state = source[QStringLiteral("state")].asString();
        bool known = false;
        for (const char *s : states)
            known = known || (state && *state == QLatin1String(s));
        recovery.insert(QStringLiteral("state"), known ? JsonValue::string(*state) : JsonValue());
        for (const char *key : {"added", "alreadyPresent", "preservedDeleted", "failed", "pendingCount"}) {
            const auto value = source[QLatin1String(key)].asU64();
            recovery.insert(QLatin1String(key), value ? JsonValue::fromU64(*value) : JsonValue());
        }
        const auto recoveryError = source[QStringLiteral("lastError")].asString();
        recovery.insert(QStringLiteral("lastError"),
                        recoveryError ? JsonValue::string(category(*recoveryError)) : JsonValue());
    } else {
        recovery.insert(QStringLiteral("available"), JsonValue::boolean(false));
    }
    result.insert(QStringLiteral("recovery"), std::move(recovery));
    return result;
}

void Reporter::observe(const JsonValue &status, const QString &path)
{
    const qint64 current = now();
    // Bounded disk writes even when retries/status updates happen every tick.
    if (m_lastWrite && current - *m_lastWrite < 30)
        return;
    m_lastWrite = current;
    JsonValue output = snapshot(status, current);
    output.insert(QStringLiteral("lastFailure"), lastFailure().value_or(JsonValue()));
    const bool failed = !storage::writePrivateFileAtomic(path, output.toJson(true));
    if (failed && !m_writeFailed)
        qWarning("[CommunityUpload] diagnostics_write_failed");
    else if (!failed && m_writeFailed)
        qInfo("[CommunityUpload] diagnostics_write_recovered");
    m_writeFailed = failed;
}

}   // namespace community::diagnostics
