#pragma once

// The data and the pure rules of the Community uploader, ported from the Tauri Dial's community_upload.rs:
// the persistent state (state.json, byte-compatible with serde's output so the Tauri and the Qt Dial
// can replace each other), the queue rules, the failure classification, the request canonical strings
// and the history validation. No I/O here.

#include "json.h"

#include <QString>
#include <QStringList>
#include <QUrl>
#include <QVector>

#include <optional>

namespace community {

constexpr int kContractVersion = 1;
inline constexpr char kAudience[] = "meticulous-community";
inline constexpr char kExchangePath[] = "/api/machine-uploads/v1/enrollments/exchange";
inline constexpr char kTokenPath[] = "/api/machine-uploads/v1/token";
inline constexpr char kShotPath[] = "/api/machine-uploads/v1/shots";
inline constexpr char kRevokePath[] = "/api/machine-uploads/v1/installations/current";
inline constexpr char kDefaultCommunityBase[] = "https://community.meticuloushome.com";
inline constexpr char kDefaultMachineBase[] = "http://localhost:8080";
inline constexpr char kUserAgent[] = "meticulous-dial-community-upload-v1";
constexpr qint64 kMaxShotBodyBytes = 2 * 1024 * 1024;
constexpr qint64 kMaxControlResponseBytes = 256 * 1024;
constexpr quint64 kMaxPourOverDurationMs = 10 * 60 * 1000;
constexpr int kMaxPourOverSamples = 3001;
constexpr int kMaxQueueItems = 128;
constexpr quint64 kMaxQueueBytes = 64 * 1024 * 1024;
constexpr qint64 kHistoryPollSeconds = 60;
constexpr qint64 kServerUpgradeRetrySeconds = 15 * 60;
constexpr qint64 kEnrollmentTtlSeconds = 10 * 60;
constexpr qint64 kEnrollmentExchangeGraceSeconds = 5 * 60;
constexpr qint64 kAccessTokenLifetimeSeconds = 240;
constexpr int kConnectTimeoutMs = 5000;
constexpr int kRequestTimeoutMs = 15000;
inline constexpr char kUnavailableMessage[] =
    "Community upload storage is unavailable. The Dial can still brew normally.";
inline constexpr char kStorageUnavailable[] = "Community upload storage unavailable";
inline constexpr char kStateUnavailable[] = "Community state unavailable";

enum class HistoryKind { Espresso, PourOver };
QString historyKindName(HistoryKind kind);    // serde: "espresso" / "pour_over"
const char *historyKindDebug(HistoryKind kind);   // Rust's {:?}: "Espresso" / "PourOver"

struct EnrollmentState {
    QString challenge;
    qint64 issuedAt = 0;
    std::optional<QString> machineSerial;
    bool operator==(const EnrollmentState &o) const
    {
        return challenge == o.challenge && issuedAt == o.issuedAt && machineSerial == o.machineSerial;
    }
};

struct QueuedShot {
    QString id;   // UUID, lower-case hyphenated
    QString sourceShotId;
    QString historyPath;
    HistoryKind historyKind = HistoryKind::Espresso;
    QString bodyFile;
    quint32 attemptCount = 0;
    qint64 nextAttemptAt = 0;
    std::optional<QString> lastError;
};

struct PersistentState {
    QString installationId;
    QString privateSeed;   // base64url of the 32-byte Ed25519 seed
    QString publicKey;     // base64url of the 32-byte Ed25519 public key
    std::optional<EnrollmentState> enrollment;
    std::optional<QString> authorizationId;
    std::optional<QString> keyId;
    std::optional<quint32> keyVersion;
    bool paused = false;
    bool historyBaselined = false;
    std::optional<QString> historyCursor;
    bool pourOverHistoryBaselined = false;
    std::optional<QString> pourOverHistoryCursor;
    QVector<QueuedShot> queue;
    std::optional<qint64> lastSuccessAt;
    std::optional<QString> lastError;
    std::optional<qint64> lastRetryAt;
};

struct VolatileState {
    std::optional<QString> accessToken;
    qint64 accessTokenExpiresAt = 0;
    qint64 clockOffsetSeconds = 0;
    qint64 workerNotBefore = 0;
    quint32 workerFailureCount = 0;
    qint64 historyScanNotBefore = 0;
};

struct RequestFailure {
    QString category;
    std::optional<qint64> retryAfterSeconds;
    bool permanent = false;
    std::optional<quint16> status;
};

// CommunityUploadStatus (serde camelCase).
struct UploadStatus {
    QString state = QStringLiteral("not_connected");   // not_connected | connected | upload_paused | unavailable
    bool connected = false;
    bool paused = false;
    int pendingCount = 0;
    std::optional<qint64> lastSuccessAt;
    std::optional<QString> lastError;
    std::optional<qint64> lastRetryAt;
    std::optional<qint64> enrollmentExpiresAt;
    bool operator==(const UploadStatus &o) const
    {
        return state == o.state && connected == o.connected && paused == o.paused && pendingCount == o.pendingCount &&
               lastSuccessAt == o.lastSuccessAt && lastError == o.lastError && lastRetryAt == o.lastRetryAt &&
               enrollmentExpiresAt == o.enrollmentExpiresAt;
    }
    bool operator!=(const UploadStatus &o) const { return !(*this == o); }
    JsonValue toJson() const;   // field order of the Rust struct
};

struct Enrollment {
    QString qrUrl;
    qint64 expiresAt = 0;
};

// --- state.json -------------------------------------------------------------------------------

// serde_json::to_vec(&PersistentState): compact, fields in struct order, None as null.
QByteArray serializeState(const PersistentState &state);
// serde_json::from_slice::<PersistentState>, with the serde defaults of the Rust struct (historyKind,
// pourOverHistoryBaselined and pourOverHistoryCursor may be missing). nullopt on any error.
std::optional<PersistentState> parseState(const QByteArray &bytes);
// validate_state: the seed decodes to 32 bytes and its public key matches publicKey.
bool validateState(const PersistentState &state);
// fresh_state: a new installation id and Ed25519 key, nothing else (nullopt if OpenSSL cannot make a key).
std::optional<PersistentState> freshState();
bool rotateIdentityPreservingQueue(PersistentState &state);
UploadStatus statusOf(const PersistentState &state);
UploadStatus unavailableStatus(const QString &error);

// --- rules ------------------------------------------------------------------------------------

QString safeCategory(const QString &value);
RequestFailure temporary(const QString &category);
RequestFailure permanent(const QString &category);
bool authorizationIsRetired(const QString &category);
bool failureIsPermanent(int status, const QString &category);
bool pourOverServerSupportMayBeMissing(std::optional<quint16> status, const QString &category);
RequestFailure reclassifyUploadFailure(RequestFailure failure, HistoryKind kind);
bool enrollmentExchangeExpired(qint64 issuedAt, qint64 now);
bool queueCapacityAllows(int itemCount, quint64 currentBytes, quint64 additionalBytes);
std::optional<QueuedShot> nextDueQueueItem(const QVector<QueuedShot> &queue, qint64 now);
void scheduleQueueRetry(PersistentState &state, const QString &id, const RequestFailure &failure, qint64 now);
int reactivateDeploymentBlockedPourOvers(PersistentState &state, qint64 now);
bool scheduleFractionalSampleRejectionReplay(PersistentState &state, qint64 now);

// normalize_history_path: two non-empty segments, no traversal; nullopt = permanent history_path_invalid.
std::optional<QString> normalizeHistoryPath(const QString &value);
// validate_history_record: the source shot id, or the permanent failure.
bool validateHistoryRecord(const JsonValue &parsed, HistoryKind kind, QString *sourceId, RequestFailure *failure);
// {"contractVersion":1,"shot":<raw bytes>} without reserializing the shot.
QByteArray wrapShotBody(const QByteArray &raw);

// Rust String ordering (UTF-8 bytes).
bool utf8Less(const QString &a, const QString &b);

// --- server and machine responses (serde structs) ---------------------------------------------

struct ExchangeResponse {
    QString accessToken;
    QString authorizationId;
    QString keyId;
    quint32 keyVersion = 0;
};
std::optional<ExchangeResponse> parseExchangeResponse(const JsonValue &value);
// TokenResponse.accessToken.
std::optional<QString> parseTokenResponse(const JsonValue &value);
// ErrorResponse.error (nullopt when missing, null or not that shape).
std::optional<QString> parseErrorResponse(const JsonValue &value);
// BrewHistoryResponse: for each entry, the first of file, url and name that is set (not normalized).
std::optional<QStringList> parseHistoryResponse(const JsonValue &value);
// str::parse::<i64>: an optional sign and digits, nothing else.
std::optional<qint64> parseI64(const QByteArray &text);

// --- request signing ---------------------------------------------------------------------------

QString machineRequestCanonical(const QString &method, const QString &path, const QString &keyId, quint32 keyVersion,
                                qint64 timestamp, const QString &nonce, const QString &requestId, const QString &bodySha256);
QString enrollmentExchangeCanonical(const QString &path, const QString &installationId, qint64 timestamp,
                                    const QString &nonce, const QString &requestId, const QString &bodySha256);
QString idempotencyKey(const QString &installationId, const QString &sourceShotId);
// sign_message: base64url Ed25519 signature; nullopt = permanent private_key_invalid.
std::optional<QString> signMessage(const QString &privateSeed, const QByteArray &message);
QString randomNonce();

using HeaderList = QVector<QPair<QByteArray, QByteArray>>;
// signed_headers / enrollment_headers. nonce and requestId are drawn when empty (tests pass them).
bool signedHeaders(const QString &keyId, quint32 keyVersion, const QString &privateSeed, qint64 timestamp,
                   const QString &method, const QString &path, const QByteArray &body, HeaderList *headers,
                   RequestFailure *failure, QString nonce = QString(), QString requestId = QString());
bool enrollmentHeaders(const QString &installationId, const QString &privateSeed, qint64 timestamp, const QString &path,
                       const QByteArray &body, HeaderList *headers, RequestFailure *failure, QString nonce = QString(),
                       QString requestId = QString());

// --- URLs ---------------------------------------------------------------------------------------

// community_url / machine_url: the base with this path and no query.
QUrl urlWithPath(const QUrl &base, const QString &path);
// The request targets of the machine's history (sent as these bytes: HttpRequest::target; a QUrl would
// re-encode | and ^ and decode %7E, where the url crate keeps them):
// the history file, /api/v1/history[/pour-over]/files/<segments>, each segment percent-encoded as the url
// crate's path_segments_mut().push does. nullopt = permanent history_path_invalid.
std::optional<QByteArray> machineHistoryFileTarget(HistoryKind kind, const QString &historyPath);
// path?max_results=200[&sort=asc][&after=...] with application/x-www-form-urlencoded values, as
// query_pairs_mut().append_pair does.
QByteArray machineHistoryListTarget(const QString &path, bool sortAsc, const std::optional<QString> &after);
// The enrollment QR link: <community base>/my-setup/machine/connect?enrollment=<base64url(json)>.
QByteArray enrollmentPayload(const QString &installationId, const EnrollmentState &enrollment, const QString &publicKey);
QString enrollmentQrUrl(const QUrl &communityBase, const QByteArray &payload);
QByteArray exchangeBody(const QString &installationId, const QString &challenge);

}   // namespace community
