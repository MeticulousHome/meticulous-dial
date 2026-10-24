#include "model.h"

#include "crypto.h"

#include <QStringList>

#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>

namespace community {

QString historyKindName(HistoryKind kind)
{
    return kind == HistoryKind::PourOver ? QStringLiteral("pour_over") : QStringLiteral("espresso");
}

const char *historyKindDebug(HistoryKind kind)
{
    return kind == HistoryKind::PourOver ? "PourOver" : "Espresso";
}

JsonValue UploadStatus::toJson() const
{
    JsonValue o = JsonValue::object();
    o.insert(QStringLiteral("state"), JsonValue::string(state));
    o.insert(QStringLiteral("connected"), JsonValue::boolean(connected));
    o.insert(QStringLiteral("paused"), JsonValue::boolean(paused));
    o.insert(QStringLiteral("pendingCount"), JsonValue::fromU64(quint64(pendingCount)));
    o.insert(QStringLiteral("lastSuccessAt"), JsonValue::optional(lastSuccessAt));
    o.insert(QStringLiteral("lastError"), JsonValue::optional(lastError));
    o.insert(QStringLiteral("lastRetryAt"), JsonValue::optional(lastRetryAt));
    o.insert(QStringLiteral("enrollmentExpiresAt"), JsonValue::optional(enrollmentExpiresAt));
    return o;
}

// --- state.json -------------------------------------------------------------------------------

static JsonValue queuedShotJson(const QueuedShot &item)
{
    JsonValue o = JsonValue::object();
    o.insert(QStringLiteral("id"), JsonValue::string(item.id));
    o.insert(QStringLiteral("sourceShotId"), JsonValue::string(item.sourceShotId));
    o.insert(QStringLiteral("historyPath"), JsonValue::string(item.historyPath));
    o.insert(QStringLiteral("historyKind"), JsonValue::string(historyKindName(item.historyKind)));
    o.insert(QStringLiteral("bodyFile"), JsonValue::string(item.bodyFile));
    o.insert(QStringLiteral("attemptCount"), JsonValue::fromU64(item.attemptCount));
    o.insert(QStringLiteral("nextAttemptAt"), JsonValue::fromI64(item.nextAttemptAt));
    o.insert(QStringLiteral("lastError"), JsonValue::optional(item.lastError));
    return o;
}

QByteArray serializeState(const PersistentState &state)
{
    JsonValue o = JsonValue::object();
    o.insert(QStringLiteral("installationId"), JsonValue::string(state.installationId));
    o.insert(QStringLiteral("privateSeed"), JsonValue::string(state.privateSeed));
    o.insert(QStringLiteral("publicKey"), JsonValue::string(state.publicKey));
    if (state.enrollment) {
        JsonValue e = JsonValue::object();
        e.insert(QStringLiteral("challenge"), JsonValue::string(state.enrollment->challenge));
        e.insert(QStringLiteral("issuedAt"), JsonValue::fromI64(state.enrollment->issuedAt));
        e.insert(QStringLiteral("machineSerial"), JsonValue::optional(state.enrollment->machineSerial));
        o.insert(QStringLiteral("enrollment"), std::move(e));
    } else {
        o.insert(QStringLiteral("enrollment"), JsonValue());
    }
    o.insert(QStringLiteral("authorizationId"), JsonValue::optional(state.authorizationId));
    o.insert(QStringLiteral("keyId"), JsonValue::optional(state.keyId));
    o.insert(QStringLiteral("keyVersion"), JsonValue::optional(state.keyVersion));
    o.insert(QStringLiteral("paused"), JsonValue::boolean(state.paused));
    o.insert(QStringLiteral("historyBaselined"), JsonValue::boolean(state.historyBaselined));
    o.insert(QStringLiteral("historyCursor"), JsonValue::optional(state.historyCursor));
    o.insert(QStringLiteral("pourOverHistoryBaselined"), JsonValue::boolean(state.pourOverHistoryBaselined));
    o.insert(QStringLiteral("pourOverHistoryCursor"), JsonValue::optional(state.pourOverHistoryCursor));
    JsonValue queue = JsonValue::array();
    for (const QueuedShot &item : state.queue)
        queue.append(queuedShotJson(item));
    o.insert(QStringLiteral("queue"), std::move(queue));
    o.insert(QStringLiteral("lastSuccessAt"), JsonValue::optional(state.lastSuccessAt));
    o.insert(QStringLiteral("lastError"), JsonValue::optional(state.lastError));
    o.insert(QStringLiteral("lastRetryAt"), JsonValue::optional(state.lastRetryAt));
    return o.toJson(false);
}

namespace {
// serde's derived Deserialize for a struct read from a JSON object: unknown members are ignored, a
// known member may appear once, Option<T> accepts a missing member or null, T must be there.
class StructReader
{
public:
    explicit StructReader(const JsonValue &object) : m_object(object), m_ok(object.isObject()) {}
    bool ok() const { return m_ok; }

    const JsonValue *member(const QString &key)
    {
        if (!m_ok)
            return nullptr;
        if (m_object.count(key) > 1) {
            m_ok = false;   // duplicate field
            return nullptr;
        }
        return m_object.get(key);
    }

    QString requiredString(const QString &key)
    {
        const JsonValue *v = member(key);
        if (!v || !v->isString()) {
            m_ok = false;
            return QString();
        }
        return v->stringRef();
    }
    std::optional<QString> optionalString(const QString &key)
    {
        const JsonValue *v = member(key);
        if (!v || v->isNull())
            return std::nullopt;
        if (!v->isString()) {
            m_ok = false;
            return std::nullopt;
        }
        return v->stringRef();
    }
    QString requiredUuid(const QString &key)
    {
        const QString text = requiredString(key);
        if (!m_ok)
            return QString();
        const auto uuid = crypto::parseUuid(text);
        if (!uuid)
            m_ok = false;
        return uuid.value_or(QString());
    }
    std::optional<QString> optionalUuid(const QString &key)
    {
        const auto text = optionalString(key);
        if (!text)
            return std::nullopt;
        const auto uuid = crypto::parseUuid(*text);
        if (!uuid)
            m_ok = false;
        return uuid;
    }
    bool requiredBool(const QString &key)
    {
        const JsonValue *v = member(key);
        if (!v || !v->isBool()) {
            m_ok = false;
            return false;
        }
        return *v->asBool();
    }
    bool defaultBool(const QString &key)
    {
        const JsonValue *v = member(key);
        if (!v)
            return false;
        if (!v->isBool()) {
            m_ok = false;
            return false;
        }
        return *v->asBool();
    }
    qint64 requiredI64(const QString &key)
    {
        const JsonValue *v = member(key);
        const auto n = v ? v->asI64() : std::nullopt;
        if (!n) {
            m_ok = false;
            return 0;
        }
        return *n;
    }
    std::optional<qint64> optionalI64(const QString &key)
    {
        const JsonValue *v = member(key);
        if (!v || v->isNull())
            return std::nullopt;
        const auto n = v->asI64();
        if (!n)
            m_ok = false;
        return n;
    }
    quint32 requiredU32(const QString &key)
    {
        const JsonValue *v = member(key);
        const auto n = v ? v->asU64() : std::nullopt;
        if (!n || *n > std::numeric_limits<quint32>::max()) {
            m_ok = false;
            return 0;
        }
        return quint32(*n);
    }
    std::optional<quint32> optionalU32(const QString &key)
    {
        const JsonValue *v = member(key);
        if (!v || v->isNull())
            return std::nullopt;
        const auto n = v->asU64();
        if (!n || *n > std::numeric_limits<quint32>::max()) {
            m_ok = false;
            return std::nullopt;
        }
        return quint32(*n);
    }
    void fail() { m_ok = false; }

private:
    const JsonValue &m_object;
    bool m_ok;
};

std::optional<QueuedShot> parseQueuedShot(const JsonValue &value)
{
    StructReader r(value);
    QueuedShot item;
    item.id = r.requiredUuid(QStringLiteral("id"));
    item.sourceShotId = r.requiredString(QStringLiteral("sourceShotId"));
    item.historyPath = r.requiredString(QStringLiteral("historyPath"));
    if (const JsonValue *kind = r.member(QStringLiteral("historyKind"))) {   // #[serde(default)]
        if (kind->isString() && kind->stringRef() == QLatin1String("espresso"))
            item.historyKind = HistoryKind::Espresso;
        else if (kind->isString() && kind->stringRef() == QLatin1String("pour_over"))
            item.historyKind = HistoryKind::PourOver;
        else
            r.fail();
    }
    item.bodyFile = r.requiredString(QStringLiteral("bodyFile"));
    item.attemptCount = r.requiredU32(QStringLiteral("attemptCount"));
    item.nextAttemptAt = r.requiredI64(QStringLiteral("nextAttemptAt"));
    item.lastError = r.optionalString(QStringLiteral("lastError"));
    if (!r.ok())
        return std::nullopt;
    return item;
}
}   // namespace

std::optional<PersistentState> parseState(const QByteArray &bytes)
{
    const auto parsed = parseJson(bytes);
    if (!parsed)
        return std::nullopt;
    StructReader r(*parsed);
    PersistentState state;
    state.installationId = r.requiredUuid(QStringLiteral("installationId"));
    state.privateSeed = r.requiredString(QStringLiteral("privateSeed"));
    state.publicKey = r.requiredString(QStringLiteral("publicKey"));
    if (const JsonValue *enrollment = r.member(QStringLiteral("enrollment")); enrollment && !enrollment->isNull()) {
        StructReader e(*enrollment);
        EnrollmentState value;
        value.challenge = e.requiredString(QStringLiteral("challenge"));
        value.issuedAt = e.requiredI64(QStringLiteral("issuedAt"));
        value.machineSerial = e.optionalString(QStringLiteral("machineSerial"));
        if (!e.ok())
            return std::nullopt;
        state.enrollment = value;
    }
    state.authorizationId = r.optionalUuid(QStringLiteral("authorizationId"));
    state.keyId = r.optionalUuid(QStringLiteral("keyId"));
    state.keyVersion = r.optionalU32(QStringLiteral("keyVersion"));
    state.paused = r.requiredBool(QStringLiteral("paused"));
    state.historyBaselined = r.requiredBool(QStringLiteral("historyBaselined"));
    state.historyCursor = r.optionalString(QStringLiteral("historyCursor"));
    state.pourOverHistoryBaselined = r.defaultBool(QStringLiteral("pourOverHistoryBaselined"));
    state.pourOverHistoryCursor = r.optionalString(QStringLiteral("pourOverHistoryCursor"));
    const JsonValue *queue = r.member(QStringLiteral("queue"));
    if (!queue || !queue->isArray())
        return std::nullopt;
    for (int i = 0; i < queue->size(); ++i) {
        const auto item = parseQueuedShot(queue->at(i));
        if (!item)
            return std::nullopt;
        state.queue.append(*item);
    }
    state.lastSuccessAt = r.optionalI64(QStringLiteral("lastSuccessAt"));
    state.lastError = r.optionalString(QStringLiteral("lastError"));
    state.lastRetryAt = r.optionalI64(QStringLiteral("lastRetryAt"));
    if (!r.ok())
        return std::nullopt;
    return state;
}

bool validateState(const PersistentState &state)
{
    const auto seed = crypto::base64UrlDecode(state.privateSeed);
    if (!seed || seed->size() != 32)
        return false;
    const auto expected = crypto::ed25519PublicKey(*seed);
    return expected && crypto::base64UrlEncode(*expected) == state.publicKey;
}

std::optional<PersistentState> freshState()
{
    PersistentState state;
    const QByteArray seed = crypto::randomBytes(32);
    const auto publicKey = crypto::ed25519PublicKey(seed);
    if (!publicKey) {
        qCritical("[CommunityUpload] OpenSSL cannot derive an Ed25519 key");
        return std::nullopt;
    }
    state.installationId = crypto::newUuid();
    state.privateSeed = crypto::base64UrlEncode(seed);
    state.publicKey = crypto::base64UrlEncode(*publicKey);
    return state;
}

bool rotateIdentityPreservingQueue(PersistentState &state)
{
    const auto fresh = freshState();
    if (!fresh)
        return false;
    state.installationId = fresh->installationId;
    state.privateSeed = fresh->privateSeed;
    state.publicKey = fresh->publicKey;
    return true;
}

UploadStatus statusOf(const PersistentState &state)
{
    UploadStatus status;
    status.connected = state.keyId.has_value() && state.keyVersion.has_value();
    if (status.connected && state.paused)
        status.state = QStringLiteral("upload_paused");
    else if (status.connected)
        status.state = QStringLiteral("connected");
    else
        status.state = QStringLiteral("not_connected");
    status.paused = state.paused;
    status.pendingCount = state.queue.size();
    status.lastSuccessAt = state.lastSuccessAt;
    status.lastError = state.lastError;
    status.lastRetryAt = state.lastRetryAt;
    if (state.enrollment)
        status.enrollmentExpiresAt = state.enrollment->issuedAt + kEnrollmentTtlSeconds;
    return status;
}

UploadStatus unavailableStatus(const QString &error)
{
    UploadStatus status;
    status.state = QStringLiteral("unavailable");
    status.lastError = error;
    return status;
}

// --- server and machine responses -------------------------------------------------------------

std::optional<ExchangeResponse> parseExchangeResponse(const JsonValue &value)
{
    StructReader r(value);
    ExchangeResponse response;
    response.accessToken = r.requiredString(QStringLiteral("accessToken"));
    response.authorizationId = r.requiredUuid(QStringLiteral("authorizationId"));
    response.keyId = r.requiredUuid(QStringLiteral("keyId"));
    response.keyVersion = r.requiredU32(QStringLiteral("keyVersion"));
    if (!r.ok())
        return std::nullopt;
    return response;
}

std::optional<QString> parseTokenResponse(const JsonValue &value)
{
    StructReader r(value);
    const QString token = r.requiredString(QStringLiteral("accessToken"));
    if (!r.ok())
        return std::nullopt;
    return token;
}

std::optional<QString> parseErrorResponse(const JsonValue &value)
{
    StructReader r(value);
    const auto error = r.optionalString(QStringLiteral("error"));
    if (!r.ok())
        return std::nullopt;
    return error;
}

std::optional<QStringList> parseHistoryResponse(const JsonValue &value)
{
    StructReader r(value);
    const JsonValue *history = r.member(QStringLiteral("history"));
    if (!r.ok() || !history || !history->isArray())
        return std::nullopt;
    QStringList paths;
    for (int i = 0; i < history->size(); ++i) {
        StructReader entry(history->at(i));
        const auto name = entry.optionalString(QStringLiteral("name"));
        const auto url = entry.optionalString(QStringLiteral("url"));
        const auto file = entry.optionalString(QStringLiteral("file"));
        if (!entry.ok())
            return std::nullopt;
        if (file)
            paths.append(*file);
        else if (url)
            paths.append(*url);
        else if (name)
            paths.append(*name);
    }
    return paths;
}

std::optional<qint64> parseI64(const QByteArray &text)
{
    int i = 0;
    bool negative = false;
    if (i < text.size() && (text[i] == '+' || text[i] == '-')) {
        negative = text[i] == '-';
        ++i;
    }
    if (i >= text.size())
        return std::nullopt;
    qint64 value = 0;
    for (; i < text.size(); ++i) {
        const char c = text[i];
        if (c < '0' || c > '9')
            return std::nullopt;
        const int digit = c - '0';
        if (__builtin_mul_overflow(value, qint64(10), &value) ||
            (negative ? __builtin_sub_overflow(value, qint64(digit), &value)
                      : __builtin_add_overflow(value, qint64(digit), &value)))
            return std::nullopt;
    }
    return value;
}

// --- rules ------------------------------------------------------------------------------------

QString safeCategory(const QString &value)
{
    QString filtered;
    for (const QChar ch : value) {
        const ushort c = ch.unicode();
        if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_') {
            filtered.append(ch);
            if (filtered.size() == 64)
                break;
        }
    }
    return filtered.isEmpty() ? QStringLiteral("unknown") : filtered;
}

RequestFailure temporary(const QString &category)
{
    return RequestFailure{safeCategory(category), std::nullopt, false, std::nullopt};
}

RequestFailure permanent(const QString &category)
{
    return RequestFailure{safeCategory(category), std::nullopt, true, std::nullopt};
}

bool authorizationIsRetired(const QString &category)
{
    return category == QLatin1String("not_authorized") || category == QLatin1String("retired_key") ||
           category == QLatin1String("retired_or_revoked_access");
}

bool failureIsPermanent(int status, const QString &category)
{
    if (authorizationIsRetired(category))
        return true;
    if (status == 409)
        return category != QLatin1String("replayed_request");
    return status >= 400 && status < 500 && status != 401 && status != 408 && status != 429;
}

bool pourOverServerSupportMayBeMissing(std::optional<quint16> status, const QString &category)
{
    if (category == QLatin1String("invalid_json") || category == QLatin1String("invalid_shot"))
        return true;
    return status && (*status == 404 || *status == 405 || *status == 415 || *status == 422);
}

RequestFailure reclassifyUploadFailure(RequestFailure failure, HistoryKind kind)
{
    if (kind == HistoryKind::PourOver && pourOverServerSupportMayBeMissing(failure.status, failure.category)) {
        failure.category = QStringLiteral("community_pour_over_not_ready");
        failure.retryAfterSeconds = kServerUpgradeRetrySeconds;
        failure.permanent = false;
    }
    return failure;
}

bool enrollmentExchangeExpired(qint64 issuedAt, qint64 now)
{
    return issuedAt + kEnrollmentTtlSeconds + kEnrollmentExchangeGraceSeconds <= now;
}

bool queueCapacityAllows(int itemCount, quint64 currentBytes, quint64 additionalBytes)
{
    const quint64 total = currentBytes > std::numeric_limits<quint64>::max() - additionalBytes
                              ? std::numeric_limits<quint64>::max()
                              : currentBytes + additionalBytes;
    return itemCount < kMaxQueueItems && total <= kMaxQueueBytes;
}

std::optional<QueuedShot> nextDueQueueItem(const QVector<QueuedShot> &queue, qint64 now)
{
    for (const QueuedShot &item : queue) {
        if (item.nextAttemptAt <= now)
            return item;
    }
    return std::nullopt;
}

static qint64 saturatingAdd(qint64 a, qint64 b)
{
    qint64 result;
    if (__builtin_add_overflow(a, b, &result))
        return b > 0 ? std::numeric_limits<qint64>::max() : std::numeric_limits<qint64>::min();
    return result;
}

void scheduleQueueRetry(PersistentState &state, const QString &id, const RequestFailure &failure, qint64 now)
{
    for (QueuedShot &item : state.queue) {
        if (item.id != id)
            continue;
        if (item.attemptCount < std::numeric_limits<quint32>::max())
            item.attemptCount += 1;
        item.lastError = failure.category;
        const qint64 backoff =
            failure.retryAfterSeconds ? *failure.retryAfterSeconds
                                      : std::min<qint64>(qint64(1) << std::min<quint32>(item.attemptCount, 8), 300);
        item.nextAttemptAt = saturatingAdd(now, backoff);
        break;
    }
    state.lastError = failure.category;
    state.lastRetryAt = now;
}

int reactivateDeploymentBlockedPourOvers(PersistentState &state, qint64 now)
{
    int reactivated = 0;
    for (QueuedShot &item : state.queue) {
        if (item.historyKind == HistoryKind::PourOver && item.nextAttemptAt == std::numeric_limits<qint64>::max() &&
            item.lastError &&
            (*item.lastError == QLatin1String("invalid_json") || *item.lastError == QLatin1String("invalid_shot"))) {
            item.nextAttemptAt = now;
            item.lastError = QStringLiteral("community_pour_over_not_ready");
            ++reactivated;
        }
    }
    if (reactivated > 0) {
        state.lastError = QStringLiteral("community_pour_over_not_ready");
        state.lastRetryAt = now;
    }
    return reactivated;
}

bool scheduleFractionalSampleRejectionReplay(PersistentState &state, qint64 now)
{
    const bool rejectedByOldValidator = state.lastError && *state.lastError == QLatin1String("pour_over_samples_invalid");
    const bool hasPendingPourOver = std::any_of(state.queue.cbegin(), state.queue.cend(), [](const QueuedShot &item) {
        return item.historyKind == HistoryKind::PourOver;
    });
    if (!rejectedByOldValidator || hasPendingPourOver)
        return false;
    // Older Dial builds required sample time to be an unsigned integer; the backend writes it as a float
    // (403.0), so those records were skipped before they entered the queue. Rewind only this known
    // failure once: the server's source-shot uniqueness and the idempotency key make the replay safe.
    state.pourOverHistoryBaselined = true;
    state.pourOverHistoryCursor.reset();
    state.lastError = QStringLiteral("pour_over_replay_scheduled");
    state.lastRetryAt = now;
    qWarning("[CommunityUpload] replaying Pour Over history after fractional sample-time validation fix");
    return true;
}

static std::optional<QString> normalizeHistorySegment(const QString &value)
{
    const QString trimmed = value.trimmed();
    if (trimmed.isEmpty() || trimmed == QLatin1String(".") || trimmed == QLatin1String("..") ||
        trimmed.contains(QLatin1Char('/')) || trimmed.contains(QLatin1Char('\\')) || trimmed.toUtf8().size() > 255)
        return std::nullopt;
    return trimmed;
}

std::optional<QString> normalizeHistoryPath(const QString &value)
{
    QString normalized = value.trimmed();
    int start = 0;
    while (start < normalized.size() && normalized[start] == QLatin1Char('/'))
        ++start;
    normalized = normalized.mid(start);
    QStringList segments;
    for (const QString &segment : normalized.split(QLatin1Char('/'))) {
        const auto clean = normalizeHistorySegment(segment);
        if (!clean)
            return std::nullopt;
        segments.append(*clean);
    }
    if (segments.size() != 2)
        return std::nullopt;
    return segments.join(QLatin1Char('/'));
}

bool validateHistoryRecord(const JsonValue &parsed, HistoryKind kind, QString *sourceId, RequestFailure *failure)
{
    const auto fail = [&](const char *category) {
        *failure = permanent(QString::fromLatin1(category));
        return false;
    };
    const auto id = parsed[QStringLiteral("id")].asString();
    if (!id || id->isEmpty() || id->toUtf8().size() > 256)
        return fail("shot_id_invalid");
    if (kind == HistoryKind::Espresso) {
        if (!parsed[QStringLiteral("data")].isArray())
            return fail("shot_data_invalid");
    } else {
        if (parsed[QStringLiteral("brewType")].asString() != QStringLiteral("pour_over"))
            return fail("pour_over_type_invalid");
        const auto schema = parsed[QStringLiteral("schemaVersion")].asU64();
        if (!schema || *schema < 1 || *schema > 4)
            return fail("pour_over_schema_invalid");
        const auto mode = parsed[QStringLiteral("mode")].asString();
        if (mode != QStringLiteral("free_pour") && mode != QStringLiteral("profile"))
            return fail("pour_over_mode_invalid");
        const JsonValue &samples = parsed[QStringLiteral("samples")];
        bool samplesBounded = samples.isArray() && samples.size() > 0 && samples.size() <= kMaxPourOverSamples;
        for (int i = 0; samplesBounded && i < samples.size(); ++i) {
            const auto time = samples.at(i)[QStringLiteral("t")].asF64();
            samplesBounded = time && std::isfinite(*time) && *time >= 0.0 && *time <= double(kMaxPourOverDurationMs);
        }
        if (!samplesBounded)
            return fail("pour_over_samples_invalid");
        const auto duration = parsed[QStringLiteral("measurements")][QStringLiteral("durationMs")].asU64();
        if (duration && *duration > kMaxPourOverDurationMs)
            return fail("pour_over_duration_invalid");
        const JsonValue &pours = parsed[QStringLiteral("pours")];
        if (!pours.isArray() || pours.size() > 128)
            return fail("pour_over_pours_invalid");
        const JsonValue &targets = parsed[QStringLiteral("recipe")][QStringLiteral("pourTargets")];
        if (!targets.isArray() || targets.size() > 128)
            return fail("pour_over_targets_invalid");
    }
    *sourceId = *id;
    return true;
}

QByteArray wrapShotBody(const QByteArray &raw)
{
    QByteArray body;
    body.reserve(raw.size() + 32);
    body.append("{\"contractVersion\":1,\"shot\":");
    body.append(raw);
    body.append('}');
    return body;
}

bool utf8Less(const QString &a, const QString &b)
{
    return a.toUtf8() < b.toUtf8();
}

// --- request signing ---------------------------------------------------------------------------

QString machineRequestCanonical(const QString &method, const QString &path, const QString &keyId, quint32 keyVersion,
                                qint64 timestamp, const QString &nonce, const QString &requestId, const QString &bodySha256)
{
    return QStringLiteral("meticulous-machine-request-v1\nmethod:%1\npath:%2\naudience:%3\nkey-id:%4\nkey-version:%5\n"
                          "timestamp:%6\nnonce:%7\nrequest-id:%8\nbody-sha256:%9\n")
        .arg(method.toUpper(), path, QLatin1String(kAudience), keyId.toLower(), QString::number(keyVersion),
             QString::number(timestamp), nonce, requestId.toLower(), bodySha256);
}

QString enrollmentExchangeCanonical(const QString &path, const QString &installationId, qint64 timestamp,
                                    const QString &nonce, const QString &requestId, const QString &bodySha256)
{
    return QStringLiteral("meticulous-enrollment-exchange-v1\nmethod:POST\npath:%1\naudience:%2\ninstallation-id:%3\n"
                          "timestamp:%4\nnonce:%5\nrequest-id:%6\nbody-sha256:%7\n")
        .arg(path, QLatin1String(kAudience), installationId.toLower(), QString::number(timestamp), nonce,
             requestId.toLower(), bodySha256);
}

QString idempotencyKey(const QString &installationId, const QString &sourceShotId)
{
    const QString text = QStringLiteral("meticulous-machine-shot-idempotency-v1\n%1\n%2\n")
                             .arg(installationId.toLower(), sourceShotId);
    return crypto::sha256Hex(text.toUtf8());
}

std::optional<QString> signMessage(const QString &privateSeed, const QByteArray &message)
{
    const auto seed = crypto::base64UrlDecode(privateSeed);
    if (!seed || seed->size() != 32)
        return std::nullopt;
    const auto signature = crypto::ed25519Sign(*seed, message);
    if (!signature)
        return std::nullopt;
    return crypto::base64UrlEncode(*signature);
}

QString randomNonce()
{
    return crypto::base64UrlEncode(crypto::randomBytes(24));
}

static bool validHeaderValue(const QString &value)
{
    // http::HeaderValue::from_str: visible ASCII, space and tab.
    for (const QChar ch : value) {
        const ushort c = ch.unicode();
        if (!(c == '\t' || (c >= 0x20 && c < 0x7f)))
            return false;
    }
    return true;
}

static bool appendHeader(HeaderList *headers, const char *name, const QString &value, RequestFailure *failure)
{
    if (!validHeaderValue(value)) {
        *failure = permanent(QStringLiteral("header_invalid"));
        return false;
    }
    headers->append({QByteArray(name), value.toLatin1()});
    return true;
}

bool signedHeaders(const QString &keyId, quint32 keyVersion, const QString &privateSeed, qint64 timestamp,
                   const QString &method, const QString &path, const QByteArray &body, HeaderList *headers,
                   RequestFailure *failure, QString nonce, QString requestId)
{
    if (nonce.isEmpty())
        nonce = randomNonce();
    if (requestId.isEmpty())
        requestId = crypto::newUuid();
    const QString canonical = machineRequestCanonical(method, path, keyId, keyVersion, timestamp, nonce, requestId,
                                                      crypto::sha256Hex(body));
    const auto signature = signMessage(privateSeed, canonical.toUtf8());
    if (!signature) {
        *failure = permanent(QStringLiteral("private_key_invalid"));
        return false;
    }
    return appendHeader(headers, "x-meticulous-key-id", keyId, failure) &&
           appendHeader(headers, "x-meticulous-key-version", QString::number(keyVersion), failure) &&
           appendHeader(headers, "x-meticulous-timestamp", QString::number(timestamp), failure) &&
           appendHeader(headers, "x-meticulous-nonce", nonce, failure) &&
           appendHeader(headers, "x-meticulous-request-id", requestId, failure) &&
           appendHeader(headers, "x-meticulous-signature", *signature, failure);
}

bool enrollmentHeaders(const QString &installationId, const QString &privateSeed, qint64 timestamp, const QString &path,
                       const QByteArray &body, HeaderList *headers, RequestFailure *failure, QString nonce,
                       QString requestId)
{
    if (nonce.isEmpty())
        nonce = randomNonce();
    if (requestId.isEmpty())
        requestId = crypto::newUuid();
    const QString canonical =
        enrollmentExchangeCanonical(path, installationId, timestamp, nonce, requestId, crypto::sha256Hex(body));
    const auto signature = signMessage(privateSeed, canonical.toUtf8());
    if (!signature) {
        *failure = permanent(QStringLiteral("private_key_invalid"));
        return false;
    }
    return appendHeader(headers, "x-meticulous-installation-id", installationId, failure) &&
           appendHeader(headers, "x-meticulous-timestamp", QString::number(timestamp), failure) &&
           appendHeader(headers, "x-meticulous-nonce", nonce, failure) &&
           appendHeader(headers, "x-meticulous-request-id", requestId, failure) &&
           appendHeader(headers, "x-meticulous-signature", *signature, failure);
}

// --- URLs ---------------------------------------------------------------------------------------

QUrl urlWithPath(const QUrl &base, const QString &path)
{
    QUrl url = base;
    url.setPath(path);
    url.setQuery(QString());
    return url;
}

static QByteArray encodePathSegment(const QString &segment)
{
    // The url crate's SPECIAL_PATH_SEGMENT set: controls, space, non-ASCII and "#<>?`{}/%\ are encoded.
    static const char hex[] = "0123456789ABCDEF";
    QByteArray out;
    for (const char ch : segment.toUtf8()) {
        const auto c = static_cast<unsigned char>(ch);
        if (c <= 0x20 || c >= 0x7f || std::strchr("\"#<>?`{}/%\\", c)) {
            out.append('%');
            out.append(hex[c >> 4]);
            out.append(hex[c & 0xf]);
        } else {
            out.append(ch);
        }
    }
    return out;
}

static QByteArray formEncode(const QString &value)
{
    // form_urlencoded::byte_serialize: alphanumerics and *-._ stay, space is +, the rest %XX.
    static const char hex[] = "0123456789ABCDEF";
    QByteArray out;
    for (const char ch : value.toUtf8()) {
        const auto c = static_cast<unsigned char>(ch);
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '*' || c == '-' ||
            c == '.' || c == '_') {
            out.append(ch);
        } else if (c == ' ') {
            out.append('+');
        } else {
            out.append('%');
            out.append(hex[c >> 4]);
            out.append(hex[c & 0xf]);
        }
    }
    return out;
}

std::optional<QByteArray> machineHistoryFileTarget(HistoryKind kind, const QString &historyPath)
{
    const auto normalized = normalizeHistoryPath(historyPath);
    if (!normalized)
        return std::nullopt;
    QByteArray path = kind == HistoryKind::PourOver ? QByteArray("/api/v1/history/pour-over/files")
                                                    : QByteArray("/api/v1/history/files");
    for (const QString &segment : normalized->split(QLatin1Char('/'))) {
        path.append('/');
        path.append(encodePathSegment(segment));
    }
    return path;
}

QByteArray machineHistoryListTarget(const QString &path, bool sortAsc, const std::optional<QString> &after)
{
    QByteArray target = path.toUtf8();   // a constant: /api/v1/history/upload-index or /pour-over
    target.append('?');
    if (sortAsc)
        target.append("sort=asc&");
    target.append("max_results=200");
    if (after) {
        target.append("&after=");
        target.append(formEncode(*after));
    }
    return target;
}

QByteArray enrollmentPayload(const QString &installationId, const EnrollmentState &enrollment, const QString &publicKey)
{
    JsonValue payload = JsonValue::object();
    payload.insert(QStringLiteral("kind"), JsonValue::string(QStringLiteral("meticulous-community-enrollment")));
    payload.insert(QStringLiteral("contractVersion"), JsonValue::fromU64(kContractVersion));
    payload.insert(QStringLiteral("installationId"), JsonValue::string(installationId));
    payload.insert(QStringLiteral("challenge"), JsonValue::string(enrollment.challenge));
    payload.insert(QStringLiteral("publicKey"), JsonValue::string(publicKey));
    payload.insert(QStringLiteral("issuedAt"), JsonValue::fromI64(enrollment.issuedAt));
    payload.insert(QStringLiteral("machineSerial"), JsonValue::optional(enrollment.machineSerial));
    return payload.toJson(true);   // json! builds a BTreeMap: keys in order
}

QString enrollmentQrUrl(const QUrl &communityBase, const QByteArray &payload)
{
    QUrl url = communityBase;
    url.setPath(QStringLiteral("/my-setup/machine/connect"));
    url.setQuery(QStringLiteral("enrollment=") + crypto::base64UrlEncode(payload));
    return url.toString(QUrl::FullyEncoded);
}

QByteArray exchangeBody(const QString &installationId, const QString &challenge)
{
    JsonValue body = JsonValue::object();
    body.insert(QStringLiteral("contractVersion"), JsonValue::fromU64(kContractVersion));
    body.insert(QStringLiteral("installationId"), JsonValue::string(installationId));
    body.insert(QStringLiteral("challenge"), JsonValue::string(challenge));
    return body.toJson(true);
}

}   // namespace community
