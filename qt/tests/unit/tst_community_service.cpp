// The Community uploader's state machine (community_upload.rs's CommunityUploadService) against a fake
// machine backend and a fake Community server that checks every signature; the HTTP client against a
// local HTTP server; and the QML singleton (`Community`) end to end with its worker thread.

#include "community.h"
#include "community/crypto.h"
#include "community/diagnostics.h"
#include "community/http.h"
#include "community/json.h"
#include "community/model.h"
#include "community/service.h"
#include "community/storage.h"

#include "mockhttpserver.h"

#include <QDir>
#include <QElapsedTimer>
#include <QProcess>
#include <QFile>
#include <QSignalSpy>
#include <QTemporaryDir>
#include <QTest>
#include <QUrlQuery>

#include <limits>

using namespace community;

namespace {
QString str(const char *text)
{
    return QString::fromUtf8(text);
}

HttpResponse reply(int status, const QByteArray &body = QByteArray(),
                   const QHash<QByteArray, QByteArray> &headers = QHash<QByteArray, QByteArray>())
{
    HttpResponse response;
    response.received = true;
    response.status = status;
    response.body = body;
    response.headers = headers;
    response.contentLength = body.size();
    return response;
}

QHash<QByteArray, QByteArray> headerMap(const HttpRequest &request)
{
    QHash<QByteArray, QByteArray> map;
    for (const auto &header : request.headers)
        map.insert(header.first.toLower(), header.second);
    return map;
}

QByteArray readFile(const QString &path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly))
        return QByteArray();
    return file.readAll();
}

QStringList &capturedLog()
{
    static QStringList lines;
    return lines;
}

void captureMessages(QtMsgType, const QMessageLogContext &, const QString &message)
{
    capturedLog().append(message);
}

// The machine backend and the Community server, as the uploader sees them through its HttpClient.
class FakeWorld final : public HttpClient
{
public:
    // Machine.
    std::optional<QString> lastEspresso;
    std::optional<QString> lastPourOver;
    QStringList espressoIndex;
    QStringList pourOverIndex;
    QHash<QString, QByteArray> files;   // "espresso:<path>" / "pour_over:<path>" -> raw record
    bool machineDown = false;

    // Community.
    std::function<QString()> publicKey;   // the key the server knows for this installation
    int exchangeStatus = 200;
    QByteArray exchangeRetryAfter;
    QByteArray exchangeError = "invalid_payload";
    int tokenStatus = 200;
    QByteArray tokenError;
    QString issuedToken;
    int tokenCount = 0;
    int uploadStatus = 201;
    QByteArray uploadError;
    QByteArray uploadRetryAfter;
    int revokeStatus = 204;
    QByteArray revokeError;
    bool communityDown = false;
    QByteArray serverTime;
    QVector<QByteArray> uploads;
    QVector<QByteArray> idempotencyKeys;
    QStringList signatureErrors;

    std::function<std::optional<HttpResponse>(const HttpRequest &)> hook;
    QVector<HttpRequest> requests;

    QStringList paths() const
    {
        QStringList out;
        for (const HttpRequest &r : requests)
            out.append(QString::fromLatin1(r.method) + QLatin1Char(' ') + r.url.toString(QUrl::FullyEncoded));
        return out;
    }

    HttpResponse send(const HttpRequest &request) override
    {
        requests.append(request);
        if (hook) {
            if (auto hooked = hook(request))
                return *hooked;
        }
        const QString host = request.url.host();
        const QString path = request.url.path();
        if (host == QLatin1String("machine.example"))
            return machine(request, path);
        if (host == QLatin1String("community.example"))
            return community(request, path);
        return HttpResponse();
    }

private:
    static QByteArray historyJson(const QStringList &entries)
    {
        QByteArray out = "{\"history\":[";
        for (int i = 0; i < entries.size(); ++i)
            out += (i ? ",{\"file\":\"" : "{\"file\":\"") + entries[i].toUtf8() + "\"}";
        return out + "]}";
    }

    HttpResponse machine(const HttpRequest &request, const QString &path)
    {
        if (machineDown)
            return HttpResponse();
        if (path == QLatin1String("/api/v1/history/last"))
            return lastEspresso ? reply(200, "{\"file\":\"" + lastEspresso->toUtf8() + "\"}") : reply(404);
        if (path == QLatin1String("/api/v1/history/pour-over/last"))
            return lastPourOver ? reply(200, "{\"file\":\"" + lastPourOver->toUtf8() + "\"}") : reply(404);
        if (path == QLatin1String("/api/v1/history/upload-index"))
            return reply(200, historyJson(espressoIndex));
        if (path == QLatin1String("/api/v1/history/pour-over"))
            return reply(200, historyJson(pourOverIndex));
        const QString espressoFiles = str("/api/v1/history/files/");
        const QString pourOverFiles = str("/api/v1/history/pour-over/files/");
        QString key;
        if (path.startsWith(pourOverFiles))
            key = str("pour_over:") + path.mid(pourOverFiles.size());
        else if (path.startsWith(espressoFiles))
            key = str("espresso:") + path.mid(espressoFiles.size());
        if (!key.isEmpty() && files.contains(key))
            return reply(200, files.value(key));
        Q_UNUSED(request);
        return reply(404);
    }

    bool verifyMachineSignature(const HttpRequest &request)
    {
        const auto h = headerMap(request);
        const QString canonical = machineRequestCanonical(
            QString::fromLatin1(request.method), request.url.path(), QString::fromLatin1(h.value("x-meticulous-key-id")),
            h.value("x-meticulous-key-version").toUInt(), h.value("x-meticulous-timestamp").toLongLong(),
            QString::fromLatin1(h.value("x-meticulous-nonce")), QString::fromLatin1(h.value("x-meticulous-request-id")),
            crypto::sha256Hex(request.body));
        const auto key = crypto::base64UrlDecode(publicKey());
        const auto signature = crypto::base64UrlDecode(QString::fromLatin1(h.value("x-meticulous-signature")));
        const bool ok = key && signature && crypto::ed25519Verify(*key, canonical.toUtf8(), *signature);
        if (!ok)
            signatureErrors.append(request.url.path());
        return ok;
    }

    HttpResponse withTime(HttpResponse response)
    {
        if (!serverTime.isEmpty())
            response.headers.insert("x-meticulous-server-time", serverTime);
        return response;
    }

    static QByteArray errorBody(const QByteArray &error)
    {
        return error.isEmpty() ? QByteArray() : "{\"error\":\"" + error + "\"}";
    }

    HttpResponse community(const HttpRequest &request, const QString &path)
    {
        if (communityDown)
            return HttpResponse();
        const auto h = headerMap(request);
        if (path == QString::fromLatin1(kExchangePath)) {
            const QString canonical = enrollmentExchangeCanonical(
                path, QString::fromLatin1(h.value("x-meticulous-installation-id")),
                h.value("x-meticulous-timestamp").toLongLong(), QString::fromLatin1(h.value("x-meticulous-nonce")),
                QString::fromLatin1(h.value("x-meticulous-request-id")), crypto::sha256Hex(request.body));
            const auto key = crypto::base64UrlDecode(publicKey());
            const auto signature = crypto::base64UrlDecode(QString::fromLatin1(h.value("x-meticulous-signature")));
            if (!key || !signature || !crypto::ed25519Verify(*key, canonical.toUtf8(), *signature)) {
                signatureErrors.append(path);
                return reply(401, "{\"error\":\"invalid_signature\"}");
            }
            if (exchangeStatus == 202)
                return withTime(reply(202, QByteArray(), {{"retry-after", exchangeRetryAfter}}));
            if (exchangeStatus != 200)
                return withTime(reply(exchangeStatus, errorBody(exchangeError)));
            issuedToken = str("token-exchange");
            return withTime(reply(200, R"({"accessToken":"token-exchange","authorizationId":"44444444-4444-4444-8444-444444444444",)"
                                       R"("keyId":"22222222-2222-4222-8222-222222222222","keyVersion":3})"));
        }
        if (path == QString::fromLatin1(kTokenPath)) {
            if (!verifyMachineSignature(request))
                return reply(401, "{\"error\":\"invalid_signature\"}");
            if (tokenStatus != 200)
                return withTime(reply(tokenStatus, errorBody(tokenError)));
            ++tokenCount;
            issuedToken = str("token-%1").arg(tokenCount);
            return withTime(reply(200, "{\"accessToken\":\"" + issuedToken.toUtf8() + "\"}"));
        }
        if (path == QString::fromLatin1(kShotPath) || path == QString::fromLatin1(kRevokePath)) {
            if (h.value("authorization") != "Bearer " + issuedToken.toUtf8())
                return reply(401, "{\"error\":\"invalid_access\"}");
            if (!verifyMachineSignature(request))
                return reply(401, "{\"error\":\"invalid_signature\"}");
            if (path == QString::fromLatin1(kRevokePath))
                return withTime(reply(revokeStatus, errorBody(revokeError)));
            if (uploadStatus >= 200 && uploadStatus < 300) {
                uploads.append(request.body);
                idempotencyKeys.append(h.value("x-meticulous-idempotency-key"));
            }
            QHash<QByteArray, QByteArray> headers;
            if (!uploadRetryAfter.isEmpty())
                headers.insert("retry-after", uploadRetryAfter);
            headers.insert("x-request-id", "{77777777-7777-4777-8777-777777777777}");
            return withTime(reply(uploadStatus, errorBody(uploadError), headers));
        }
        return reply(404);
    }
};

struct Fixture {
    QTemporaryDir dir;
    qint64 now = 1786700000;
    FakeWorld world;
    std::unique_ptr<UploadService> service;

    explicit Fixture(bool create = true)
    {
        world.publicKey = [this] { return service->persistentSnapshot().publicKey; };
        if (create)
            make();
    }
    QString root() const { return dir.filePath(str("community-upload")); }
    void make()
    {
        UploadService::Config config;
        config.root = root();
        config.communityBase = str("https://community.example");
        config.machineBase = str("http://machine.example");
        config.clock = [this] { return now; };
        QString error;
        service = UploadService::create(config, &error);
        if (!service)
            qFatal("cannot create the service: %s", qPrintable(error));
    }
    std::optional<RequestFailure> tick() { return service->workerTick(world); }
    // Tick like the worker loop does: the failure goes to the backoff.
    std::optional<RequestFailure> loopTick()
    {
        const auto failure = service->workerTick(world);
        if (failure)
            service->recordWorkerFailure(*failure);
        else
            service->clearWorkerFailureCount();
        return failure;
    }
    PersistentState state() const { return service->persistentSnapshot(); }
    PersistentState disk() const { return *parseState(readFile(root() + str("/state.json"))); }

    // Enrollment and exchange, then the history baseline.
    void connect()
    {
        QString error;
        QVERIFY(service->beginEnrollment(str("SN-1"), &error));
        QVERIFY(!tick());
        QVERIFY(state().keyId);
        QVERIFY(!tick());   // baseline
        QVERIFY(state().historyBaselined);
        world.requests.clear();
    }
    void addShot(const QString &path, const QByteArray &record)
    {
        world.espressoIndex.append(path);
        world.files.insert(str("espresso:") + path, record);
    }
    QStringList queueFiles() const
    {
        return QDir(root() + str("/queue")).entryList(QDir::Files | QDir::Hidden);
    }
};

}   // namespace

class TestCommunityService : public QObject
{
    Q_OBJECT

private slots:
    void init()
    {
        diagnostics::resetForTests();
    }

    void enrollsExchangesBaselinesQueuesAndUploads()
    {
        Fixture f;
        QCOMPARE(f.service->status().state, str("not_connected"));
        QString error;
        const auto enrollment = f.service->beginEnrollment(str("  SN-1 \n"), &error);
        QVERIFY2(enrollment, qPrintable(error));
        QCOMPARE(enrollment->expiresAt, f.now + 600);
        QVERIFY(enrollment->qrUrl.startsWith(str("https://community.example/my-setup/machine/connect?enrollment=")));
        const auto payload = parseJson(*crypto::base64UrlDecode(enrollment->qrUrl.section(QLatin1Char('='), 1)));
        QVERIFY(payload);
        const PersistentState enrolled = f.state();
        QCOMPARE((*payload)[str("kind")].asString(), std::optional<QString>(str("meticulous-community-enrollment")));
        QCOMPARE((*payload)[str("contractVersion")].asU64(), std::optional<quint64>(1));
        QCOMPARE((*payload)[str("installationId")].asString(), std::optional<QString>(enrolled.installationId));
        QCOMPARE((*payload)[str("publicKey")].asString(), std::optional<QString>(enrolled.publicKey));
        QCOMPARE((*payload)[str("machineSerial")].asString(), std::optional<QString>(str("SN-1")));
        QCOMPARE((*payload)[str("issuedAt")].asI64(), std::optional<qint64>(f.now));
        QCOMPARE((*payload)[str("challenge")].asString(), std::optional<QString>(enrolled.enrollment->challenge));
        QCOMPARE(crypto::base64UrlDecode(enrolled.enrollment->challenge)->size(), 32);
        QCOMPARE(f.service->status().enrollmentExpiresAt, std::optional<qint64>(f.now + 600));
        QCOMPARE(f.disk().enrollment->challenge, enrolled.enrollment->challenge);   // persisted

        // The server has not seen the phone yet: 202 with Retry-After.
        f.world.exchangeStatus = 202;
        f.world.exchangeRetryAfter = "3";
        QVERIFY(!f.loopTick());
        QVERIFY(!f.service->workerIsReady());
        f.now += 3;
        QVERIFY(f.service->workerIsReady());
        const HttpRequest exchange = f.world.requests.last();
        QCOMPARE(exchange.method, QByteArray("POST"));
        QCOMPARE(exchange.url.toString(), str("https://community.example/api/machine-uploads/v1/enrollments/exchange"));
        QCOMPARE(exchange.body, exchangeBody(enrolled.installationId, enrolled.enrollment->challenge));
        const auto h = headerMap(exchange);
        QCOMPARE(h.value("content-type"), QByteArray("application/json"));
        QCOMPARE(h.value("x-meticulous-installation-id"), enrolled.installationId.toLatin1());
        QCOMPARE(h.value("x-meticulous-timestamp"), QByteArray::number(f.now - 3));
        QCOMPARE(h.value("x-meticulous-nonce").size(), 32);
        QVERIFY(crypto::parseUuid(QString::fromLatin1(h.value("x-meticulous-request-id"))));
        QVERIFY(f.world.signatureErrors.isEmpty());

        // Approved.
        f.world.exchangeStatus = 200;
        f.world.serverTime = QByteArray::number(f.now + 100);
        QVERIFY(!f.loopTick());
        PersistentState connected = f.state();
        QCOMPARE(connected.keyId, std::optional<QString>(str("22222222-2222-4222-8222-222222222222")));
        QCOMPARE(connected.authorizationId, std::optional<QString>(str("44444444-4444-4444-8444-444444444444")));
        QCOMPARE(connected.keyVersion, std::optional<quint32>(3));
        QVERIFY(!connected.enrollment);
        QCOMPARE(f.service->status().state, str("connected"));
        QCOMPARE(f.service->volatileSnapshot().accessToken, std::optional<QString>(str("token-exchange")));
        QCOMPARE(f.service->volatileSnapshot().accessTokenExpiresAt, f.now + 240);
        QCOMPARE(f.service->volatileSnapshot().clockOffsetSeconds, 100);
        QCOMPARE(f.disk().keyId, connected.keyId);

        // Baseline: the newest shot now is where the uploads start.
        f.world.lastEspresso = str("2026-10-01/a.shot.json.zst");
        f.world.requests.clear();
        QVERIFY(!f.loopTick());
        QCOMPARE(f.world.paths(), QStringList({str("GET http://machine.example/api/v1/history/last"),
                                               str("GET http://machine.example/api/v1/history/pour-over/last")}));
        connected = f.state();
        QVERIFY(connected.historyBaselined);
        QCOMPARE(connected.historyCursor, std::optional<QString>(str("2026-10-01/a.shot.json.zst")));
        QVERIFY(connected.pourOverHistoryBaselined);
        QVERIFY(!connected.pourOverHistoryCursor);
        QCOMPARE(f.service->volatileSnapshot().historyScanNotBefore, f.now + 60);

        // A new shot: nothing until the scan is due or asked for.
        const QByteArray record = R"({"id":"shot-b","data":[{"t":1}],"profile":{"future":1.50}})";
        f.addShot(str("2026-10-01/a.shot.json.zst"), R"({"id":"shot-a","data":[]})");
        f.addShot(str("2026-10-01/b.shot.json.zst"), record);
        f.world.requests.clear();
        f.now += 1;
        QVERIFY(!f.loopTick());
        QVERIFY(f.world.requests.isEmpty());
        QCOMPARE(f.service->requestHistoryScan(), QString());
        QVERIFY(!f.loopTick());
        QCOMPARE(f.world.paths(),
                 QStringList({str("GET http://machine.example/api/v1/history/upload-index?max_results=200&after=2026-10-01%2Fa.shot.json.zst"),
                              str("GET http://machine.example/api/v1/history/files/2026-10-01/b.shot.json.zst"),
                              str("GET http://machine.example/api/v1/history/pour-over?sort=asc&max_results=200")}));
        PersistentState queued = f.state();
        QCOMPARE(queued.queue.size(), 1);
        QCOMPARE(queued.queue[0].sourceShotId, str("shot-b"));
        QCOMPARE(queued.queue[0].historyPath, str("2026-10-01/b.shot.json.zst"));
        QCOMPARE(queued.queue[0].bodyFile, queued.queue[0].id + str(".json"));
        QCOMPARE(queued.queue[0].nextAttemptAt, f.now);
        QCOMPARE(queued.historyCursor, std::optional<QString>(str("2026-10-01/b.shot.json.zst")));
        QCOMPARE(f.service->status().pendingCount, 1);
        const QString bodyPath = f.root() + str("/queue/") + queued.queue[0].bodyFile;
        QCOMPARE(readFile(bodyPath), wrapShotBody(record));
        QCOMPARE(f.disk().queue.size(), 1);

        // Upload with the token from the exchange, signed, with the idempotency key.
        f.world.requests.clear();
        QVERIFY(!f.loopTick());
        QCOMPARE(f.world.uploads.size(), 1);
        QCOMPARE(f.world.uploads[0], wrapShotBody(record));
        QCOMPARE(f.world.idempotencyKeys[0], idempotencyKey(queued.installationId, str("shot-b")).toLatin1());
        const auto uh = headerMap(f.world.requests[0]);
        QCOMPARE(uh.value("authorization"), QByteArray("Bearer token-exchange"));
        QCOMPARE(uh.value("x-meticulous-key-id"), QByteArray("22222222-2222-4222-8222-222222222222"));
        QCOMPARE(uh.value("x-meticulous-key-version"), QByteArray("3"));
        QCOMPARE(uh.value("x-meticulous-timestamp"), QByteArray::number(f.now + 100));   // server clock offset
        QVERIFY(f.world.signatureErrors.isEmpty());
        QCOMPARE(f.world.tokenCount, 0);
        QVERIFY(f.state().queue.isEmpty());
        QCOMPARE(f.state().lastSuccessAt, std::optional<qint64>(f.now));
        QVERIFY(!QFile::exists(bodyPath));
        QCOMPARE(f.service->status().pendingCount, 0);
    }

    void refreshesTheTokenAndKeepsItForFourMinutes()
    {
        Fixture f;
        f.connect();
        f.now += 230;   // 240 - 20: the exchange token is too old now
        f.addShot(str("2026-10-02/c.shot.json"), R"({"id":"c","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());   // queues
        QVERIFY(!f.tick());   // token + upload
        QCOMPARE(f.world.tokenCount, 1);
        QCOMPARE(f.world.uploads.size(), 1);
        const HttpRequest token = *std::find_if(f.world.requests.begin(), f.world.requests.end(), [](const HttpRequest &r) {
            return r.url.path() == QLatin1String(kTokenPath);
        });
        QCOMPARE(token.body, QByteArray("{\"contractVersion\":1}"));
        QCOMPARE(headerMap(token).value("authorization"), QByteArray());
        f.addShot(str("2026-10-02/d.shot.json"), R"({"id":"d","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QVERIFY(!f.tick());
        QCOMPARE(f.world.tokenCount, 1);   // cached
        QCOMPARE(f.world.uploads.size(), 2);
    }

    void classifiesUploadFailures()
    {
        Fixture f;
        f.connect();
        f.addShot(str("2026-10-02/a.shot.json"), R"({"id":"a","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QCOMPARE(f.state().queue.size(), 1);

        // 503 with Retry-After: deferred, and the worker backs off.
        f.world.uploadStatus = 503;
        f.world.uploadError = "Upstream Down";
        f.world.uploadRetryAfter = "7";
        auto failure = f.loopTick();
        QVERIFY(failure);
        QCOMPARE(failure->category, str("pstreamown"));
        QVERIFY(!failure->permanent);
        QCOMPARE(failure->status, std::optional<quint16>(503));
        QCOMPARE(failure->retryAfterSeconds, std::optional<qint64>(7));
        QCOMPARE(f.state().queue[0].attemptCount, 1u);
        QCOMPARE(f.state().queue[0].nextAttemptAt, f.now + 7);
        QCOMPARE(f.state().queue[0].lastError, std::optional<QString>(str("pstreamown")));
        QCOMPARE(f.service->volatileSnapshot().workerNotBefore, f.now + 7);
        QCOMPARE(f.service->status().lastError, std::optional<QString>(str("pstreamown")));
        QCOMPARE(f.service->status().lastRetryAt, std::optional<qint64>(f.now + 7));
        QCOMPARE((*diagnostics::lastFailure())[str("category")].asString(), std::optional<QString>(str("other_error")));
        QCOMPARE((*diagnostics::lastFailure())[str("requestId")].asString(),
                 std::optional<QString>(str("77777777-7777-4777-8777-777777777777")));
        QVERIFY(!f.service->workerIsReady());

        // invalid_access: the token is dropped, the item retried with a new one.
        f.now += 7;
        f.world.uploadStatus = 401;
        f.world.uploadError = "invalid_access";
        f.world.uploadRetryAfter.clear();
        failure = f.tick();
        QVERIFY(failure && !failure->permanent);
        QVERIFY(!f.service->volatileSnapshot().accessToken);
        QCOMPARE(f.state().queue[0].nextAttemptAt, f.now + 4);   // 2^2 after the second attempt
        f.now += 4;
        f.world.uploadStatus = 201;
        f.world.uploadError.clear();
        QVERIFY(!f.tick());
        QCOMPARE(f.world.tokenCount, 1);
        QVERIFY(f.state().queue.isEmpty());

        // 409 idempotency_payload_mismatch: permanent, the record and its body are dropped.
        f.addShot(str("2026-10-02/b.shot.json"), R"({"id":"b","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QCOMPARE(f.queueFiles().size(), 1);
        f.world.uploadStatus = 409;
        f.world.uploadError = "idempotency_payload_mismatch";
        failure = f.tick();
        QVERIFY(failure && failure->permanent);
        QVERIFY(f.state().queue.isEmpty());
        QVERIFY(f.queueFiles().isEmpty());
        QCOMPARE(f.state().lastError, std::optional<QString>(str("idempotency_payload_mismatch")));
        QVERIFY(!f.state().lastRetryAt);

        // 409 replayed_request is temporary.
        f.addShot(str("2026-10-02/c.shot.json"), R"({"id":"c","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        f.world.uploadError = "replayed_request";
        failure = f.tick();
        QVERIFY(failure && !failure->permanent);
        QCOMPARE(f.state().queue.size(), 1);

        // Retired access: a new identity, the queue kept, back to not connected.
        const PersistentState before = f.state();
        f.now += 100;
        f.world.uploadStatus = 401;
        f.world.uploadError = "retired_or_revoked_access";
        failure = f.tick();
        QVERIFY(failure && failure->permanent);
        const PersistentState after = f.state();
        QVERIFY(after.installationId != before.installationId);
        QVERIFY(after.publicKey != before.publicKey);
        QVERIFY(validateState(after));
        QVERIFY(!after.keyId && !after.keyVersion && !after.authorizationId);
        QCOMPARE(after.queue.size(), 1);
        QCOMPARE(after.lastError, std::optional<QString>(str("retired_or_revoked_access")));
        QCOMPARE(f.service->status().state, str("not_connected"));
        QVERIFY(!f.service->volatileSnapshot().accessToken);
        QCOMPARE(f.disk().installationId, after.installationId);
    }

    void aPourOverTheServerCannotTakeYetDoesNotStopTheWorker()
    {
        Fixture f;
        f.world.lastPourOver = str("2026-10-01/old.pour-over.json.zst");
        f.connect();
        const QByteArray record = R"({"schemaVersion":4,"id":"po-1","brewType":"pour_over","mode":"profile",)"
                                  R"("recipe":{"pourTargets":[]},"pours":[],"samples":[{"t":403.0}]})";
        f.world.pourOverIndex = {str("2026-10-01/old.pour-over.json.zst"), str("2026-10-02/new.pour-over.json.zst")};
        f.world.files.insert(str("pour_over:2026-10-02/new.pour-over.json.zst"), record);
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QCOMPARE(f.state().queue.size(), 1);
        QCOMPARE(f.state().queue[0].historyKind, HistoryKind::PourOver);
        QCOMPARE(f.state().pourOverHistoryCursor, std::optional<QString>(str("2026-10-02/new.pour-over.json.zst")));
        QVERIFY(f.world.paths().contains(
            str("GET http://machine.example/api/v1/history/pour-over/files/2026-10-02/new.pour-over.json.zst")));
        f.world.uploadStatus = 422;
        f.world.uploadError = "invalid_shot";
        QVERIFY(!f.tick());   // Ok: the item has its own slow retry
        QCOMPARE(f.state().queue[0].lastError, std::optional<QString>(str("community_pour_over_not_ready")));
        QCOMPARE(f.state().queue[0].nextAttemptAt, f.now + kServerUpgradeRetrySeconds);
        QCOMPARE(f.state().queue.size(), 1);
    }

    void tokenRefusalRetiresTheAuthorization()
    {
        Fixture f;
        f.connect();
        f.now += 1000;
        f.world.tokenStatus = 401;
        f.world.tokenError = "retired_key";
        f.addShot(str("2026-10-02/a.shot.json"), R"({"id":"a","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        const auto failure = f.tick();
        QVERIFY(failure);
        QCOMPARE(failure->category, str("retired_key"));
        QCOMPARE(f.service->status().state, str("not_connected"));
        QCOMPARE(f.state().queue.size(), 1);
    }

    void aPermanentExchangeRefusalForgetsTheEnrollment()
    {
        Fixture f;
        QString error;
        QVERIFY(f.service->beginEnrollment(std::nullopt, &error));
        f.world.exchangeStatus = 400;
        f.world.exchangeError = "invalid_payload";
        const auto failure = f.loopTick();
        QVERIFY(failure && failure->permanent);
        QVERIFY(!f.state().enrollment);
        QCOMPARE(f.state().lastError, std::optional<QString>(str("invalid_payload")));
        QCOMPARE(f.state().lastRetryAt, std::optional<qint64>(f.now + 2));   // record_retry after the backoff
        QCOMPARE(f.service->volatileSnapshot().workerFailureCount, 1u);
        f.now += 2;
        f.world.requests.clear();
        QVERIFY(!f.loopTick());
        QVERIFY(f.world.requests.isEmpty());   // nothing to exchange any more
    }

    void aTemporaryExchangeFailureKeepsTheEnrollment()
    {
        Fixture f;
        QString error;
        QVERIFY(f.service->beginEnrollment(std::nullopt, &error));
        f.world.communityDown = true;
        const auto failure = f.loopTick();
        QVERIFY(failure);
        QCOMPARE(failure->category, str("exchange_network"));
        QVERIFY(f.state().enrollment);
        QCOMPARE(f.service->status().lastError, std::optional<QString>(str("exchange_network")));
        f.world.exchangeStatus = 503;
        f.world.communityDown = false;
        f.now += 2;
        QVERIFY(f.loopTick());
        QVERIFY(f.state().enrollment);
        QCOMPARE(f.state().lastError, std::optional<QString>(str("invalid_payload")));
    }

    void theEnrollmentExpiresAfterItsGrace()
    {
        Fixture f;
        QString error;
        QVERIFY(f.service->beginEnrollment(std::nullopt, &error));
        f.world.exchangeStatus = 202;
        f.now += kEnrollmentTtlSeconds + kEnrollmentExchangeGraceSeconds - 1;
        QVERIFY(!f.tick());
        QCOMPARE(f.world.requests.size(), 1);
        f.now += 1;
        f.world.requests.clear();
        QVERIFY(!f.tick());
        QVERIFY(f.world.requests.isEmpty());
        QVERIFY(!f.state().enrollment);
        QCOMPARE(f.service->status().lastError, std::optional<QString>(str("pairing_code_expired")));
        QVERIFY(!f.service->status().enrollmentExpiresAt);
    }

    void commandsFollowTheRustRules()
    {
        Fixture f;
        QCOMPARE(f.service->setPaused(true), str("Community backup is not connected"));
        QString error;
        auto enrollment = f.service->beginEnrollment(str("   "), &error);
        QVERIFY(enrollment);
        QVERIFY(!f.state().enrollment->machineSerial);
        const QString longSerial = QString(100, QLatin1Char('a')) + QString::fromUtf8("\xf0\x9f\x98\x80").repeated(40);
        enrollment = f.service->beginEnrollment(longSerial, &error);
        QVERIFY(enrollment);
        const QString serial = *f.state().enrollment->machineSerial;
        QCOMPARE(serial.toUcs4().size(), 128);
        QVERIFY(serial.endsWith(QString::fromUtf8("\xf0\x9f\x98\x80")));
        QVERIFY(!f.tick());
        QVERIFY(f.state().keyId);
        QVERIFY(!f.service->beginEnrollment(std::nullopt, &error));
        QCOMPARE(error, str("Community backup is already connected"));
        QCOMPARE(f.service->setPaused(true), QString());
        QCOMPARE(f.service->status().state, str("upload_paused"));
        QVERIFY(f.disk().paused);
        f.world.requests.clear();
        f.addShot(str("2026-10-02/a.shot.json"), R"({"id":"a","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QVERIFY(f.world.requests.isEmpty());   // paused: nothing happens
        QCOMPARE(f.service->setPaused(false), QString());
        QCOMPARE(f.service->status().state, str("connected"));
        QVERIFY(!f.tick());
        QVERIFY(!f.world.requests.isEmpty());
    }

    void disconnectRevokesThenResetsLocally()
    {
        Fixture f;
        f.connect();
        f.addShot(str("2026-10-02/a.shot.json"), R"({"id":"a","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QCOMPARE(f.queueFiles().size(), 1);
        const PersistentState before = f.state();

        // The network is down: nothing is reset and the error says so.
        f.world.communityDown = true;
        QCOMPARE(f.service->disconnect(f.world),
                 str("Could not disconnect from Community. Check the internet connection and try again."));
        QCOMPARE(f.service->status().state, str("connected"));
        QCOMPARE(f.state().lastError, std::optional<QString>(str("disconnect_network")));
        QCOMPARE(f.state().lastRetryAt, std::optional<qint64>(f.now + 5));
        QCOMPARE(f.queueFiles().size(), 1);

        f.world.communityDown = false;
        f.world.requests.clear();
        QCOMPARE(f.service->disconnect(f.world), QString());
        QCOMPARE(f.world.requests.size(), 1);
        const HttpRequest revoke = f.world.requests[0];
        QCOMPARE(revoke.method, QByteArray("DELETE"));
        QCOMPARE(revoke.url.toString(), str("https://community.example/api/machine-uploads/v1/installations/current"));
        QCOMPARE(revoke.body, QByteArray("{\"contractVersion\":1}"));
        QVERIFY(f.world.signatureErrors.isEmpty());
        const PersistentState after = f.state();
        QVERIFY(after.installationId != before.installationId);
        QVERIFY(!after.keyId);
        QVERIFY(after.queue.isEmpty());
        QVERIFY(!after.historyBaselined);
        QVERIFY(f.queueFiles().isEmpty());
        QCOMPARE(f.service->status().state, str("not_connected"));
        QVERIFY(!f.service->volatileSnapshot().accessToken);

        // Not connected: only the local reset.
        f.world.requests.clear();
        QCOMPARE(f.service->disconnect(f.world), QString());
        QVERIFY(f.world.requests.isEmpty());
    }

    void disconnectTreatsARetiredAuthorizationAsDone()
    {
        Fixture f;
        f.connect();
        f.world.revokeStatus = 401;
        f.world.revokeError = "not_authorized";
        QCOMPARE(f.service->disconnect(f.world), QString());
        QCOMPARE(f.service->status().state, str("not_connected"));
        f.connect();
        f.world.revokeStatus = 500;
        f.world.revokeError.clear();
        QVERIFY(!f.service->disconnect(f.world).isEmpty());
        QCOMPARE(f.state().lastError, std::optional<QString>(str("disconnect_failed")));
    }

    void factoryResetLocalForgetsEverything()
    {
        Fixture f;
        f.connect();
        f.addShot(str("2026-10-02/a.shot.json"), R"({"id":"a","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        const QString installation = f.state().installationId;
        QCOMPARE(f.service->factoryResetLocal(), QString());
        QVERIFY(f.state().installationId != installation);
        QVERIFY(f.state().queue.isEmpty());
        QVERIFY(!f.state().keyId);
        QVERIFY(f.queueFiles().isEmpty());
        QCOMPARE(f.disk().installationId, f.state().installationId);
        QCOMPARE(f.service->volatileSnapshot().workerNotBefore, 0);
        QVERIFY(!f.service->volatileSnapshot().accessToken);
    }

    void skipsRecordsTheServerWouldNeverTake()
    {
        Fixture f;
        f.world.lastEspresso = str("2026-10-01/a.shot.json");
        f.connect();
        f.addShot(str("2026-10-02/bad.shot.json"), R"({"id":"bad","data":{}})");
        f.addShot(str("2026-10-02/good.shot.json"), R"({"id":"good","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QCOMPARE(f.state().queue.size(), 1);
        QCOMPARE(f.state().queue[0].sourceShotId, str("good"));
        QCOMPARE(f.state().historyCursor, std::optional<QString>(str("2026-10-02/good.shot.json")));
        QVERIFY(!f.state().lastError);   // queueing "good" cleared the skip's error

        // A file that is not there yet (still being compressed): temporary, the cursor stays.
        f.world.espressoIndex.append(str("2026-10-03/pending.shot.json"));
        f.service->requestHistoryScan();
        f.world.uploadStatus = 201;
        const auto failure = f.tick();   // uploads "good", then the scan fails on the pending file
        QVERIFY(failure);
        QCOMPARE(failure->category, str("shot_file_pending"));
        QCOMPARE(f.state().historyCursor, std::optional<QString>(str("2026-10-02/good.shot.json")));
        QCOMPARE(f.world.uploads.size(), 1);

        // Garbage JSON is also "pending"; a path the machine should never send is fatal for the page.
        f.world.files.insert(str("espresso:2026-10-03/pending.shot.json"), "{\"id\":");
        f.service->requestHistoryScan();
        QCOMPARE(f.tick()->category, str("shot_file_pending"));
        f.world.espressoIndex.append(str("../../etc/passwd"));
        f.service->requestHistoryScan();
        const auto traversal = f.tick();
        QVERIFY(traversal && traversal->permanent);
        QCOMPARE(traversal->category, str("history_path_invalid"));
    }

    void boundsTheQueue()
    {
        Fixture f;
        f.connect();
        PersistentState full = f.state();
        for (int i = 0; i < kMaxQueueItems; ++i) {
            QueuedShot item;
            item.id = crypto::newUuid();
            item.sourceShotId = str("s%1").arg(i);
            item.historyPath = str("2026-01-01/s%1").arg(i);
            item.bodyFile = item.id + str(".json");
            item.nextAttemptAt = std::numeric_limits<qint64>::max() - 1;   // not due
            full.queue.append(item);
        }
        f.service->setPersistentForTests(full);
        f.addShot(str("2026-10-02/a.shot.json"), R"({"id":"a","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QCOMPARE(f.state().queue.size(), kMaxQueueItems);
        QCOMPARE(f.service->volatileSnapshot().historyScanNotBefore, f.now + 5);   // incomplete: soon again
        RequestFailure failure;
        QVERIFY(!f.service->ensureQueueCapacity(0, &failure));
        QCOMPARE(failure.category, str("queue_capacity_reached"));
    }

    void aFullPageAsksForTheNextOneSoon()
    {
        Fixture f;
        f.world.lastEspresso = str("2026-01-01/000");
        f.connect();
        for (int i = 1; i <= 200; ++i)
            f.addShot(str("2026-01-01/%1").arg(i, 3, 10, QLatin1Char('0')), "{\"id\":\"" + QByteArray::number(i) + "\",\"data\":[]}");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QCOMPARE(f.state().queue.size(), 128);   // bounded
        QCOMPARE(f.service->volatileSnapshot().historyScanNotBefore, f.now + 5);
    }

    void workerBackoffDoublesUpToThirtySeconds()
    {
        Fixture f;
        const qint64 expected[] = {2, 4, 8, 16, 30, 30};
        for (const qint64 delay : expected) {
            f.service->recordWorkerFailure(temporary(str("upload_network")));
            QCOMPARE(f.service->volatileSnapshot().workerNotBefore, f.now + delay);
            QCOMPARE(f.service->status().lastRetryAt, std::optional<qint64>(f.now + delay));
        }
        RequestFailure withRetry = temporary(str("rate_limited"));
        withRetry.retryAfterSeconds = 0;
        f.service->recordWorkerFailure(withRetry);
        QCOMPARE(f.service->volatileSnapshot().workerNotBefore, f.now + 1);   // at least a second
        f.service->clearWorkerFailureCount();
        f.service->recordWorkerFailure(temporary(str("upload_network")));
        QCOMPARE(f.service->volatileSnapshot().workerNotBefore, f.now + 2);
    }

    void queuedBodiesThatVanishedAreDropped()
    {
        Fixture f;
        f.connect();
        f.addShot(str("2026-10-02/a.shot.json"), R"({"id":"a","data":[]})");
        f.service->requestHistoryScan();
        QVERIFY(!f.tick());
        QVERIFY(QFile::remove(f.root() + str("/queue/") + f.state().queue[0].bodyFile));
        const auto failure = f.tick();
        QVERIFY(failure && failure->permanent);
        QCOMPARE(failure->category, str("queued_body_missing"));
        QVERIFY(f.state().queue.isEmpty());
        QCOMPARE(f.state().lastError, std::optional<QString>(str("queued_body_missing")));
    }

    void createChecksTheBasesAndTheStorage()
    {
        QTemporaryDir dir;
        UploadService::Config config;
        config.root = dir.filePath(str("community-upload"));
        QString error;
        config.communityBase = str("not a url");
        QVERIFY(!UploadService::create(config, &error));
        QCOMPARE(error, str("Invalid COMMUNITY_API_BASE"));
        config.communityBase = str("ftp://community.example");
        QVERIFY(!UploadService::create(config, &error));
        QCOMPARE(error, str("Unsupported Community API scheme"));
        config.communityBase = str("https://community.example");
        config.machineBase = str("http://");
        QVERIFY(!UploadService::create(config, &error));
        QCOMPARE(error, str("Invalid MACHINE_API_BASE"));
        config.machineBase = str("ws://localhost:8080");
        QVERIFY(!UploadService::create(config, &error));
        QCOMPARE(error, str("Unsupported machine API scheme"));
        // The state is created before the bases are checked, as in Rust.
        QVERIFY(QFile::exists(config.root + str("/state.json")));

        config.machineBase = str("http://localhost:8080");
        QFile orphan(config.root + str("/queue/orphan.json"));
        QVERIFY(orphan.open(QIODevice::WriteOnly));
        orphan.close();
        auto service = UploadService::create(config, &error);
        QVERIFY(service);
        QVERIFY(!QFile::exists(orphan.fileName()));

        // Storage that cannot be used.
        QFile blocker(dir.filePath(str("file")));
        QVERIFY(blocker.open(QIODevice::WriteOnly));
        blocker.close();
        config.root = dir.filePath(str("file/community-upload"));
        QVERIFY(!UploadService::create(config, &error));
        QCOMPARE(error, QString::fromLatin1(kStorageUnavailable));
        config.root = dir.filePath(str("broken"));
        QVERIFY(storage::writePrivateFileAtomic(config.root + str("/state.json"), "{}"));
        QVERIFY(!UploadService::create(config, &error));
        QCOMPARE(error, QString::fromLatin1(kStorageUnavailable));
    }

    void takesOverTheStateOfTheTauriDial()
    {
        QTemporaryDir dir;
        const QString root = dir.filePath(str("community-upload"));
        // What the Tauri Dial left: connected, one parked Pour Over and its body.
        const QByteArray rust =
            R"({"installationId":"11111111-1111-4111-8111-111111111111",)"
            R"("privateSeed":"nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",)"
            R"("publicKey":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo","enrollment":null,)"
            R"("authorizationId":"44444444-4444-4444-8444-444444444444",)"
            R"("keyId":"22222222-2222-4222-8222-222222222222","keyVersion":3,"paused":false,)"
            R"("historyBaselined":true,"historyCursor":"2026-08-15/a.shot.json.zst",)"
            R"("queue":[{"id":"66666666-6666-4666-8666-666666666666","sourceShotId":"po-1",)"
            R"("historyPath":"2026-08-16/c.pour-over.json.zst",)"
            R"("bodyFile":"66666666-6666-4666-8666-666666666666.json","attemptCount":1,)"
            R"("nextAttemptAt":9223372036854775807,"lastError":"invalid_json"}],)"
            R"("lastSuccessAt":1786700001,"lastError":"invalid_json","lastRetryAt":null})";
        QVERIFY(storage::writePrivateFileAtomic(root + str("/state.json"), rust));
        QVERIFY(storage::writePrivateFileAtomic(root + str("/queue/66666666-6666-4666-8666-666666666666.json"), "{}"));
        UploadService::Config config;
        config.root = root;
        config.clock = [] { return qint64(1786800000); };
        QString error;
        const auto service = UploadService::create(config, &error);
        QVERIFY2(service, qPrintable(error));
        const PersistentState state = service->persistentSnapshot();
        QCOMPARE(state.installationId, str("11111111-1111-4111-8111-111111111111"));
        QCOMPARE(service->status().state, str("connected"));
        // No historyKind: an espresso, as serde's default says; so it stays parked.
        QCOMPARE(state.queue[0].historyKind, HistoryKind::Espresso);
        QCOMPARE(state.queue[0].nextAttemptAt, std::numeric_limits<qint64>::max());
        QVERIFY(QFile::exists(root + str("/queue/66666666-6666-4666-8666-666666666666.json")));
        QVERIFY(!state.pourOverHistoryBaselined);
    }

    // community_upload/diagnostics.rs: queue_persist_failures_preserve_diagnostics_until_upload_completes.
    void queuePersistFailuresPreserveDiagnosticsUntilUploadCompletes()
    {
        Fixture f;
        f.world.files.insert(str("espresso:2026-09-25/test.json"), R"({"id":"persist-test-shot","data":[]})");
        const QString statePath = f.root() + str("/state.json");
        QVERIFY(QFile::remove(statePath));
        QVERIFY(QDir().mkdir(statePath));   // state.json is a directory: the rename fails
        capturedLog().clear();
        const QtMessageHandler previous = qInstallMessageHandler(captureMessages);

        diagnostics::failure(str("state_persist_failed"), std::nullopt, std::nullopt, std::nullopt);
        const auto original = diagnostics::lastFailure();
        const qint64 firstEmitted = diagnostics::lastEmitted();
        for (int i = 0; i < 2; ++i) {
            RequestFailure error;
            QVERIFY(!f.service->queueHistoryPath(f.world, HistoryKind::Espresso, str("2026-09-25/test.json"), &error));
            QCOMPARE(error.category, str("state_persist_failed"));
            QCOMPARE(diagnostics::lastFailure(), original);
            f.service->recordWorkerFailure(error);
            QCOMPARE(diagnostics::lastFailure(), original);
            QCOMPARE(diagnostics::lastEmitted(), firstEmitted);
            QVERIFY(f.state().queue.isEmpty());
            QVERIFY(!f.state().historyCursor);
            QVERIFY(f.queueFiles().isEmpty());
        }
        // Storage repaired: queueing works, but no upload completed yet.
        QVERIFY(QDir().rmdir(statePath));
        RequestFailure error;
        QVERIFY(f.service->queueHistoryPath(f.world, HistoryKind::Espresso, str("2026-09-25/test.json"), &error));
        QCOMPARE(diagnostics::lastFailure(), original);
        QVERIFY(!capturedLog().join(QLatin1Char('\n')).contains(str("upload_resumed")));
        QCOMPARE(capturedLog().filter(str("[CommunityUpload] failure")).size(), 1);

        // Even an acknowledged upload is not resumed until its completion is durable.
        const QueuedShot queued = f.state().queue[0];
        const QString bodyPath = f.root() + str("/queue/") + queued.bodyFile;
        QVERIFY(QFile::remove(statePath));
        QVERIFY(QDir().mkdir(statePath));
        QVERIFY(!f.service->completeQueueItem(queued.id, bodyPath, &error));
        QCOMPARE(diagnostics::lastFailure(), original);
        QVERIFY(QFile::exists(bodyPath));
        QVERIFY(!capturedLog().join(QLatin1Char('\n')).contains(str("upload_resumed")));
        QVERIFY(QDir().rmdir(statePath));
        QVERIFY(f.service->completeQueueItem(queued.id, bodyPath, &error));
        QVERIFY(!diagnostics::lastFailure());
        QVERIFY(!QFile::exists(bodyPath));
        QCOMPARE(capturedLog().filter(str("upload_resumed")).size(), 1);
        qInstallMessageHandler(previous);
    }

    // --- the HTTP client against a real socket ------------------------------------------------
    void httpClientSpeaksLikeReqwest()
    {
        MockHttpServer server;
        server.handler = [](const MockRequest &request) {
            MockReply r;
            r.headers = {{"Set-Cookie", "session=1"}, {"Retry-After", "4"}, {"X-Two", "a"}};
            r.body = "echo:" + request.method + ":" + request.body;
            if (request.target.startsWith("/missing"))
                r.status = 404;
            return r;
        };
        QtHttpClient http;
        HttpRequest get;
        get.url = QUrl(QString::fromLatin1(server.base() + "/a?b=1"));
        get.maxBodyBytes = 1000;
        HttpResponse response = http.send(get);
        QVERIFY(response.received);
        QCOMPARE(response.status, 200);
        QCOMPARE(response.body, QByteArray("echo:GET:"));
        QCOMPARE(response.header("retry-after"), std::optional<QByteArray>("4"));
        QCOMPARE(response.contentLength, std::optional<qint64>(9));
        QVERIFY(!response.bodyFailed && !response.bodyCut);
        MockRequest seen = server.requests().last();
        QCOMPARE(seen.target, QByteArray("/a?b=1"));
        QCOMPARE(seen.headers.value("user-agent"), QByteArray("meticulous-dial-community-upload-v1"));
        QCOMPARE(seen.headers.value("accept-encoding"), QByteArray("identity"));
        QVERIFY(!seen.headers.contains("cookie"));

        HttpRequest post;
        post.method = "POST";
        post.url = QUrl(QString::fromLatin1(server.base() + "/p"));
        post.headers = {{"Content-Type", "application/json"}, {"x-meticulous-nonce", "n"}};
        post.body = "{\"a\":1}";
        post.hasBody = true;
        post.maxBodyBytes = 1000;
        response = http.send(post);
        QCOMPARE(response.body, QByteArray("echo:POST:{\"a\":1}"));
        seen = server.requests().last();
        QVERIFY(!seen.headers.contains("cookie"));   // no cookie store
        QCOMPARE(seen.headers.value("x-meticulous-nonce"), QByteArray("n"));
        QCOMPARE(seen.headers.value("content-type"), QByteArray("application/json"));

        HttpRequest del = post;
        del.method = "DELETE";
        response = http.send(del);
        QCOMPARE(response.body, QByteArray("echo:DELETE:{\"a\":1}"));

        get.url = QUrl(QString::fromLatin1(server.base() + "/missing"));
        response = http.send(get);
        QVERIFY(response.received);
        QCOMPARE(response.status, 404);
        QCOMPARE(response.body, QByteArray("echo:GET:"));
        QVERIFY(!response.bodyFailed);

        HttpRequest bad = get;
        bad.headers = {{"Authorization", "Bearer a\nb"}};
        QVERIFY(!http.send(bad).received);   // an invalid header value is a send() error
    }

    void httpClientBoundsBodiesAndTimesOut()
    {
        MockHttpServer server;
        MockReply next;
        server.handler = [&](const MockRequest &) { return next; };
        QtHttpClient http;
        http.requestTimeoutMs = 600;
        HttpRequest get;
        get.url = QUrl(QString::fromLatin1(server.base() + "/x"));
        get.maxBodyBytes = 10;

        next.body = QByteArray(100, 'x');
        HttpResponse response = http.send(get);
        QVERIFY(response.received);
        QVERIFY(response.bodyCut);   // the declared length is past the bound
        QCOMPARE(response.contentLength, std::optional<qint64>(100));

        next.omitContentLength = true;
        next.body = QByteArray(5000, 'y');
        response = http.send(get);
        QVERIFY(response.received);
        QVERIFY(response.bodyCut);
        QVERIFY(response.body.size() > 10);
        QVERIFY(response.body.size() <= 11);

        next = MockReply();
        next.hangAfterHeaders = true;
        next.body = QByteArray(8, 'z');
        QElapsedTimer timer;
        timer.start();
        response = http.send(get);
        QVERIFY(response.received);
        QVERIFY(response.bodyFailed);
        QVERIFY(timer.elapsed() < 5000);

        next = MockReply();
        next.hang = true;
        timer.restart();
        response = http.send(get);
        QVERIFY(!response.received);
        QVERIFY(timer.elapsed() >= 500 && timer.elapsed() < 5000);

        // Nobody listens there.
        QTcpServer closed;
        QVERIFY(closed.listen(QHostAddress::LocalHost, 0));
        const quint16 port = closed.serverPort();
        closed.close();
        get.url = QUrl(QStringLiteral("http://127.0.0.1:%1/").arg(port));
        QVERIFY(!http.send(get).received);
    }

    void httpClientStopsWhenAsked()
    {
        MockHttpServer server;
        server.handler = [](const MockRequest &) {
            MockReply r;
            r.hang = true;
            return r;
        };
        std::atomic<bool> stop{false};
        QtHttpClient http(&stop);
        HttpRequest get;
        get.url = QUrl(QString::fromLatin1(server.base() + "/x"));
        QTimer::singleShot(200, [&] { stop.store(true); });
        QElapsedTimer timer;
        timer.start();
        QVERIFY(!http.send(get).received);
        QVERIFY(timer.elapsed() < 3000);
        QVERIFY(!http.send(get).received);   // stopped: no new requests
    }

    // --- the QML singleton ------------------------------------------------------------------
    void communityObjectRunsTheUploaderOnItsThreads()
    {
        QTemporaryDir dir;
        MockHttpServer server;
        QString publicKey;
        int exchanges = 0;
        server.handler = [&](const MockRequest &request) {
            MockReply r;
            if (request.target == kExchangePath) {
                ++exchanges;
                r.body = R"({"accessToken":"tok","authorizationId":"44444444-4444-4444-8444-444444444444",)"
                         R"("keyId":"22222222-2222-4222-8222-222222222222","keyVersion":3})";
            } else if (request.target == kRevokePath) {
                r.status = request.headers.value("authorization") == "Bearer tok" ? 204 : 401;
            } else {
                r.status = 404;   // no history yet
            }
            return r;
        };
        qputenv("CONFIG_PATH", QFile::encodeName(dir.path()));
        qputenv("COMMUNITY_API_BASE", server.base());
        qputenv("MACHINE_API_BASE", server.base());
        {
            Community community(QUrl(str("http://unused.example")));
            QVariantMap status = community.status();
            QCOMPARE(status.value(str("state")).toString(), str("not_connected"));
            const QStringList keys = {str("state"), str("connected"), str("paused"), str("pendingCount"),
                                      str("lastSuccessAt"), str("lastError"), str("lastRetryAt"), str("enrollmentExpiresAt")};
            for (const QString &key : keys)
                QVERIFY2(status.contains(key), qPrintable(key));
            QCOMPARE(status.size(), keys.size());
            QCOMPARE(status.value(str("lastSuccessAt")).metaType(), QMetaType::fromType<std::nullptr_t>());
            QCOMPARE(status.value(str("pendingCount")).toInt(), 0);
            QVERIFY(QFile::exists(dir.filePath(str("community-upload/state.json"))));

            QSignalSpy statusSpy(&community, &Community::statusChanged);
            QSignalSpy enrollmentSpy(&community, &Community::enrollmentResult);
            QSignalSpy operationSpy(&community, &Community::operationFinished);
            community.beginEnrollment(str("SN-9"));
            QVERIFY(enrollmentSpy.wait(5000));
            const QVariantMap result = enrollmentSpy.at(0).at(0).toMap();
            QVERIFY(result.value(str("qrUrl")).toString().startsWith(QString::fromLatin1(server.base()) +
                                                                     str("/my-setup/machine/connect?enrollment=")));
            QVERIFY(result.value(str("expiresAt")).toLongLong() > 0);
            QVERIFY(!result.contains(str("error")));
            QVERIFY(statusSpy.count() > 0);
            // The worker exchanges within a tick or two.
            QTRY_COMPARE_WITH_TIMEOUT(community.status().value(str("state")).toString(), str("connected"), 5000);
            QVERIFY(exchanges >= 1);
            QVERIFY(community.status().value(str("connected")).toBool());

            community.setUploadPaused(true);
            QVERIFY(operationSpy.wait(5000));
            QCOMPARE(operationSpy.at(0).at(0).toString(), str("setUploadPaused"));
            QCOMPARE(operationSpy.at(0).at(1).toString(), QString());
            QCOMPARE(community.status().value(str("state")).toString(), str("upload_paused"));
            QCOMPARE(community.scanHistory(), QString());

            community.beginEnrollment(QString());
            QVERIFY(enrollmentSpy.wait(5000));
            QCOMPARE(enrollmentSpy.at(1).at(0).toMap().value(str("error")).toString(),
                     str("Community backup is already connected"));

            community.disconnect();
            QTRY_COMPARE_WITH_TIMEOUT(operationSpy.count(), 2, 10000);
            QCOMPARE(operationSpy.at(1).at(0).toString(), str("disconnect"));
            QCOMPARE(operationSpy.at(1).at(1).toString(), QString());
            QCOMPARE(community.status().value(str("state")).toString(), str("not_connected"));
            QCOMPARE(community.factoryResetLocal(), QString());

            // diagnostics.json is written by the worker (the first observe is immediate).
            QTRY_VERIFY_WITH_TIMEOUT(QFile::exists(dir.filePath(str("community-upload/diagnostics.json"))), 3000);
            const QByteArray diagnostics = readFile(dir.filePath(str("community-upload/diagnostics.json")));
            QVERIFY(!diagnostics.contains("privateSeed"));
            QVERIFY(parseJson(diagnostics));
        }
        qunsetenv("CONFIG_PATH");
        qunsetenv("COMMUNITY_API_BASE");
        qunsetenv("MACHINE_API_BASE");
    }

    void communityObjectReportsUnavailableStorage()
    {
        QTemporaryDir dir;
        QFile blocker(dir.filePath(str("config")));
        QVERIFY(blocker.open(QIODevice::WriteOnly));
        blocker.close();
        qputenv("CONFIG_PATH", QFile::encodeName(blocker.fileName()));
        {
            Community community(QUrl(str("http://localhost:8080")));
            const QVariantMap status = community.status();
            QCOMPARE(status.value(str("state")).toString(), str("unavailable"));
            QCOMPARE(status.value(str("connected")).toBool(), false);
            QCOMPARE(status.value(str("lastError")).toString(), QString::fromLatin1(kStorageUnavailable));
            QSignalSpy enrollmentSpy(&community, &Community::enrollmentResult);
            QSignalSpy operationSpy(&community, &Community::operationFinished);
            community.beginEnrollment(str("SN"));
            QVERIFY(enrollmentSpy.wait(2000));
            QCOMPARE(enrollmentSpy.at(0).at(0).toMap().value(str("error")).toString(),
                     QString::fromLatin1(kUnavailableMessage));
            community.setUploadPaused(true);
            QVERIFY(operationSpy.wait(2000));
            QCOMPARE(operationSpy.at(0).at(1).toString(), QString::fromLatin1(kUnavailableMessage));
            QCOMPARE(community.factoryResetLocal(), QString::fromLatin1(kUnavailableMessage));
            QCOMPARE(community.scanHistory(), QString::fromLatin1(kUnavailableMessage));
        }
        qputenv("CONFIG_PATH", QFile::encodeName(dir.path()));
        qputenv("COMMUNITY_API_BASE", "ftp://x");
        {
            Community community(QUrl(str("http://localhost:8080")));
            QCOMPARE(community.status().value(str("lastError")).toString(), str("Unsupported Community API scheme"));
        }
        qunsetenv("CONFIG_PATH");
        qunsetenv("COMMUNITY_API_BASE");
    }

    // Hand the files over to the Tauri Dial's real community_upload.rs and back. Needs a helper that
    // runs it (see docs/qt-migration/parity/community.md): COMMUNITY_RUST_HELPER="<program> [args]".
    void interopWithTheTauriUploader()
    {
        const QStringList helper = qEnvironmentVariable("COMMUNITY_RUST_HELPER").split(QLatin1Char(' '), Qt::SkipEmptyParts);
        if (helper.isEmpty())
            QSKIP("COMMUNITY_RUST_HELPER is not set");
        MockHttpServer server;
        server.handler = [](const MockRequest &request) {
            MockReply r;
            if (request.target == kTokenPath)
                r.body = R"({"accessToken":"rust-token"})";
            else if (request.target == kShotPath)
                r.status = request.headers.value("authorization") == "Bearer rust-token" ? 201 : 401;
            else if (request.target.startsWith("/api/v1/history/upload-index") ||
                     request.target.startsWith("/api/v1/history/pour-over?"))
                r.body = R"({"history":[]})";
            else
                r.status = 404;
            return r;
        };
        const auto runHelper = [&](const QString &configPath, const QStringList &args) {
            QProcess process;
            QProcessEnvironment env = QProcessEnvironment::systemEnvironment();
            env.insert(str("CONFIG_PATH"), configPath);
            env.insert(str("COMMUNITY_API_BASE"), QString::fromLatin1(server.base()));
            env.insert(str("MACHINE_API_BASE"), QString::fromLatin1(server.base()));
            process.setProcessEnvironment(env);
            QSignalSpy finished(&process, &QProcess::finished);
            process.start(helper[0], helper.mid(1) + args);
            if (!finished.wait(60000))
                qFatal("the Rust helper did not finish");
            const QByteArray err = process.readAllStandardError();
            if (!err.isEmpty())
                qWarning("helper stderr: %s", err.constData());
            return process.readAllStandardOutput().trimmed().split('\n');
        };

        // 1. What the Qt Dial wrote, the Tauri Dial continues: same identity, same queue, no re-upload.
        Fixture qt;
        qt.world.lastEspresso = str("2026-10-01/a.shot.json.zst");
        qt.world.lastPourOver = str("2026-10-01/a.pour-over.json.zst");
        qt.connect();
        const QByteArray espresso = R"({"id":"qt-shot","data":[{"time":0}],"profile":{"x":1.0}})";
        const QByteArray pourOver = R"({"schemaVersion":4,"id":"qt-pour","brewType":"pour_over","mode":"free_pour",)"
                                    R"("recipe":{"pourTargets":[]},"pours":[],"samples":[{"t":403.0}]})";
        qt.addShot(str("2026-10-02/b.shot.json.zst"), espresso);
        qt.world.pourOverIndex = {str("2026-10-02/b.pour-over.json.zst")};
        qt.world.files.insert(str("pour_over:2026-10-02/b.pour-over.json.zst"), pourOver);
        qt.service->requestHistoryScan();
        QVERIFY(!qt.tick());
        const PersistentState handedOver = qt.state();
        QCOMPARE(handedOver.queue.size(), 2);
        qt.service.reset();

        QList<QByteArray> out = runHelper(qt.dir.path(), {str("status")});
        auto status = parseJson(out.last());
        QVERIFY2(status, out.last().constData());
        QCOMPARE((*status)[str("state")].asString(), std::optional<QString>(str("connected")));
        QCOMPARE((*status)[str("pendingCount")].asU64(), std::optional<quint64>(2));
        QCOMPARE(qt.queueFiles().size(), 2);   // not orphans for Rust either

        out = runHelper(qt.dir.path(), {str("run"), str("5")});
        status = parseJson(out.last());
        QVERIFY2(status, out.last().constData());
        QCOMPARE((*status)[str("pendingCount")].asU64(), std::optional<quint64>(0));
        QVERIFY((*status)[str("lastSuccessAt")].asU64());
        int uploads = 0;
        const QByteArray publicKey = *crypto::base64UrlDecode(handedOver.publicKey);
        for (const MockRequest &request : server.requests()) {
            const QString path = QString::fromLatin1(request.target.split('?').first());
            if (request.method != "POST" || (path != QLatin1String(kShotPath) && path != QLatin1String(kTokenPath)))
                continue;
            const auto &h = request.headers;
            QCOMPARE(h.value("x-meticulous-key-id"), handedOver.keyId->toLatin1());
            const QString canonical = machineRequestCanonical(
                QString::fromLatin1(request.method), path, QString::fromLatin1(h.value("x-meticulous-key-id")),
                h.value("x-meticulous-key-version").toUInt(), h.value("x-meticulous-timestamp").toLongLong(),
                QString::fromLatin1(h.value("x-meticulous-nonce")), QString::fromLatin1(h.value("x-meticulous-request-id")),
                crypto::sha256Hex(request.body));
            QVERIFY(crypto::ed25519Verify(publicKey, canonical.toUtf8(),
                                          *crypto::base64UrlDecode(QString::fromLatin1(h.value("x-meticulous-signature")))));
            if (path == QLatin1String(kShotPath)) {
                ++uploads;
                const QueuedShot &item = request.body == wrapShotBody(espresso) ? handedOver.queue[0] : handedOver.queue[1];
                QCOMPARE(request.body, wrapShotBody(item.historyKind == HistoryKind::Espresso ? espresso : pourOver));
                QCOMPARE(h.value("x-meticulous-idempotency-key"),
                         idempotencyKey(handedOver.installationId, item.sourceShotId).toLatin1());
            }
        }
        QCOMPARE(uploads, 2);
        // ... and the Qt Dial reads back what the Tauri Dial wrote, byte for byte as it would write it.
        const QByteArray rustAfterUpload = readFile(qt.root() + str("/state.json"));
        QVERIFY(parseState(rustAfterUpload));
        QCOMPARE(serializeState(*parseState(rustAfterUpload)), rustAfterUpload);
        qt.make();
        QVERIFY(qt.state().queue.isEmpty());
        QCOMPARE(qt.state().installationId, handedOver.installationId);
        QCOMPARE(qt.state().keyId, handedOver.keyId);
        QCOMPARE(qt.state().historyCursor, handedOver.historyCursor);
        QVERIFY(qt.state().lastSuccessAt);
        QVERIFY(qt.queueFiles().isEmpty());

        // 2. An enrollment the Tauri Dial started, the Qt Dial finishes with the Rust-made key.
        Fixture rust(false);
        out = runHelper(rust.dir.path(), {str("enroll"), str(" SN-R ")});
        QCOMPARE(out.size(), 2);
        const auto enrollment = parseJson(out[0]);
        QVERIFY2(enrollment, out[0].constData());
        const QByteArray rustWritten = readFile(rust.root() + str("/state.json"));
        QCOMPARE(serializeState(*parseState(rustWritten)), rustWritten);
        rust.make();
        const PersistentState rustState = rust.state();
        QVERIFY(validateState(rustState));
        QCOMPARE(rust.service->status().enrollmentExpiresAt, (*enrollment)[str("expiresAt")].asI64());
        const QString qr = *(*enrollment)[str("qrUrl")].asString();
        const auto payload = parseJson(*crypto::base64UrlDecode(qr.section(QLatin1Char('='), 1)));
        QVERIFY(payload);
        QCOMPARE((*payload)[str("installationId")].asString(), std::optional<QString>(rustState.installationId));
        QCOMPARE((*payload)[str("publicKey")].asString(), std::optional<QString>(rustState.publicKey));
        QCOMPARE((*payload)[str("machineSerial")].asString(), std::optional<QString>(str("SN-R")));
        // The Rust payload is exactly what the Qt port builds from the same enrollment.
        QCOMPARE(enrollmentPayload(rustState.installationId, *rustState.enrollment, rustState.publicKey),
                 *crypto::base64UrlDecode(qr.section(QLatin1Char('='), 1)));
        rust.now = rustState.enrollment->issuedAt + 1;
        QVERIFY(!rust.tick());
        QVERIFY(rust.world.signatureErrors.isEmpty());
        QCOMPARE(rust.service->status().state, str("connected"));
        rust.service.reset();
        out = runHelper(rust.dir.path(), {str("status")});
        status = parseJson(out.last());
        QCOMPARE((*status)[str("state")].asString(), std::optional<QString>(str("connected")));
    }

    void storageRootFollowsConfigPath()
    {
        qputenv("CONFIG_PATH", "/x/config/");
        QCOMPARE(Community::storageRoot(), str("/x/config/community-upload"));
        qunsetenv("CONFIG_PATH");
        const QString root = Community::storageRoot();
        QVERIFY(root == str("/meticulous-user/config/community-upload") ||
                root == QDir::tempPath() + str("/meticulous-dial-config/community-upload"));
    }
};

QTEST_GUILESS_MAIN(TestCommunityService)
#include "tst_community_service.moc"
