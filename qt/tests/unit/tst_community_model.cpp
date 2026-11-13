// The pure parts of the Community uploader against the Rust tests of community_upload.rs (qt/tests/community-contract/reference/)
// (and community_upload/diagnostics.rs) and the cross-language vector qt/tests/test-vectors/
// machine-upload-v1.json, plus the serde compatibility of state.json and the JSON parser.

#include "community/crypto.h"
#include "community/diagnostics.h"
#include "community/json.h"
#include "community/model.h"
#include "community/storage.h"

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QTemporaryDir>
#include <QTest>
#include <QUrlQuery>

#include <limits>
#include <sys/stat.h>

using namespace community;

namespace {
JsonValue parse(const char *text)
{
    const auto value = parseJson(QByteArray(text));
    if (!value)
        qFatal("test JSON does not parse: %s", text);
    return *value;
}

JsonValue readVector()
{
    QFile file(QStringLiteral(DIAL_TEST_VECTORS_DIR "/machine-upload-v1.json"));
    if (!file.open(QIODevice::ReadOnly))
        qFatal("cannot read the test vector %s", qPrintable(file.fileName()));
    const auto value = parseJson(file.readAll());
    if (!value)
        qFatal("the test vector does not parse");
    return *value;
}

QueuedShot shot(const QString &source, const QString &path, HistoryKind kind, const QString &bodyFile,
                quint32 attempts, qint64 nextAttempt, std::optional<QString> lastError = std::nullopt)
{
    QueuedShot item;
    item.id = crypto::newUuid();
    item.sourceShotId = source;
    item.historyPath = path;
    item.historyKind = kind;
    item.bodyFile = bodyFile;
    item.attemptCount = attempts;
    item.nextAttemptAt = nextAttempt;
    item.lastError = lastError;
    return item;
}

QString str(const char *text)
{
    return QString::fromUtf8(text);
}

RequestFailure failureOf(const char *category, bool isPermanent, std::optional<quint16> status)
{
    return RequestFailure{str(category), std::nullopt, isPermanent, status};
}
}   // namespace

class TestCommunityModel : public QObject
{
    Q_OBJECT

private slots:
    // --- JSON with serde_json semantics -----------------------------------------------------
    void jsonKeepsTheKindOfNumbers()
    {
        const JsonValue a = parse("[4, 4.0, -3, -0, 18446744073709551615, 18446744073709551616, 403.25, 1e3]");
        QCOMPARE(a.at(0).type(), JsonValue::Type::PosInt);
        QCOMPARE(a.at(0).asU64(), std::optional<quint64>(4));
        QCOMPARE(a.at(1).type(), JsonValue::Type::Float);
        QVERIFY(!a.at(1).asU64());
        QCOMPARE(a.at(1).asF64(), std::optional<double>(4.0));
        QCOMPARE(a.at(2).type(), JsonValue::Type::NegInt);
        QVERIFY(!a.at(2).asU64());
        QCOMPARE(a.at(2).asI64(), std::optional<qint64>(-3));
        QCOMPARE(a.at(3).type(), JsonValue::Type::Float);   // serde_json: -0 is a float
        QCOMPARE(a.at(4).asU64(), std::optional<quint64>(std::numeric_limits<quint64>::max()));
        QVERIFY(!a.at(4).asI64());
        QCOMPARE(a.at(5).type(), JsonValue::Type::Float);
        QCOMPARE(a.at(6).asF64(), std::optional<double>(403.25));
        QCOMPARE(a.at(7).type(), JsonValue::Type::Float);
        QCOMPARE(parse("9223372036854775807").asI64(), std::optional<qint64>(std::numeric_limits<qint64>::max()));
        QCOMPARE(parse("-9223372036854775808").asI64(), std::optional<qint64>(std::numeric_limits<qint64>::min()));
        QCOMPARE(parse("-9223372036854775809").type(), JsonValue::Type::Float);
    }

    void jsonRejectsWhatSerdeRejects_data()
    {
        QTest::addColumn<QByteArray>("text");
        QTest::newRow("leading zero") << QByteArray("01");
        QTest::newRow("bare dot") << QByteArray("1.");
        QTest::newRow("dot first") << QByteArray(".5");
        QTest::newRow("plus") << QByteArray("+1");
        QTest::newRow("out of range") << QByteArray("1e400");
        QTest::newRow("trailing comma") << QByteArray("[1,]");
        QTest::newRow("trailing characters") << QByteArray("{} x");
        QTest::newRow("control character") << QByteArray("\"a\x01\"");
        QTest::newRow("bad escape") << QByteArray("\"\\x\"");
        QTest::newRow("lone leading surrogate") << QByteArray("\"\\ud83d\"");
        QTest::newRow("lone trailing surrogate") << QByteArray("\"\\ude00\"");
        QTest::newRow("overlong utf-8") << QByteArray("\"\xc0\x80\"");
        QTest::newRow("utf-8 surrogate") << QByteArray("\"\xed\xa0\x80\"");
        QTest::newRow("bom") << QByteArray("\xef\xbb\xbf{}");
        QTest::newRow("single quotes") << QByteArray("{'a':1}");
        QTest::newRow("nan") << QByteArray("NaN");
        QTest::newRow("empty") << QByteArray("");
        QTest::newRow("depth 128") << QByteArray(128, '[') + QByteArray(128, ']');
    }
    void jsonRejectsWhatSerdeRejects()
    {
        QFETCH(QByteArray, text);
        QVERIFY(!parseJson(text));
    }

    void jsonAcceptsValidDocuments()
    {
        QVERIFY(parseJson(QByteArray(127, '[') + QByteArray(127, ']')));
        const JsonValue s = parse(" \"a\\u00e9\\ud83d\\ude00\\n\\/\xc3\xa9\" ");
        QCOMPARE(s.stringRef(), QString::fromUtf8("a\xc3\xa9\xf0\x9f\x98\x80\n/\xc3\xa9"));
        const JsonValue o = parse("{\"a\":1,\"b\":{\"c\":[true,false,null]},\"a\":2}");
        QCOMPARE(o[str("a")].asU64(), std::optional<quint64>(2));   // the last duplicate wins, as in a Value
        QCOMPARE(o.count(str("a")), 2);
        QVERIFY(o[str("b")][str("c")].at(2).isNull());
        QVERIFY(o[str("missing")].isNull());
        QVERIFY(!o[str("b")][str("c")].get(str("x")));   // get on an array: None
    }

    void jsonWritesLikeSerde()
    {
        JsonValue o = JsonValue::object();
        o.insert(str("z"), JsonValue::string(QString::fromUtf8("q\"\\\b\f\n\r\t\x01\x7f/\xc3\xa9")));
        o.insert(str("a"), JsonValue::fromI64(-5));
        o.insert(str("m"), JsonValue());
        QCOMPARE(o.toJson(false), QByteArray("{\"z\":\"q\\\"\\\\\\b\\f\\n\\r\\t\\u0001\x7f/\xc3\xa9\",\"a\":-5,\"m\":null}"));
        QCOMPARE(o.toJson(true), QByteArray("{\"a\":-5,\"m\":null,\"z\":\"q\\\"\\\\\\b\\f\\n\\r\\t\\u0001\x7f/\xc3\xa9\"}"));
    }

    // --- crypto and the cross-language vector -----------------------------------------------
    void matchesCommunityCrossLanguageVector()
    {
        const JsonValue vector = readVector();
        const JsonValue &request = vector[str("request")];
        const auto seed = crypto::base64UrlDecode(vector[str("privateSeed")].stringRef());
        QVERIFY(seed);
        QCOMPARE(seed->size(), 32);
        const auto publicKey = crypto::ed25519PublicKey(*seed);
        QVERIFY(publicKey);
        QCOMPARE(crypto::base64UrlEncode(*publicKey), vector[str("publicKey")].stringRef());
        QCOMPARE(crypto::sha256Hex(request[str("body")].stringRef().toUtf8()), request[str("bodySha256")].stringRef());
        const QString canonical = machineRequestCanonical(
            request[str("method")].stringRef(), request[str("path")].stringRef(), vector[str("keyId")].stringRef(),
            quint32(*vector[str("keyVersion")].asU64()), *request[str("timestamp")].asI64(),
            request[str("nonce")].stringRef(), request[str("requestId")].stringRef(), request[str("bodySha256")].stringRef());
        QCOMPARE(canonical, request[str("canonical")].stringRef());
        QCOMPARE(signMessage(vector[str("privateSeed")].stringRef(), canonical.toUtf8()),
                 std::optional<QString>(request[str("signature")].stringRef()));
        QCOMPARE(idempotencyKey(vector[str("installationId")].stringRef(), str("shot-vector-001")),
                 request[str("idempotencyKey")].stringRef());
        QCOMPARE(request[str("audience")].stringRef(), QString::fromLatin1(kAudience));

        // The same through signed_headers, and OpenSSL verifies it.
        HeaderList headers;
        RequestFailure failure;
        QVERIFY(signedHeaders(vector[str("keyId")].stringRef(), quint32(*vector[str("keyVersion")].asU64()),
                              vector[str("privateSeed")].stringRef(), *request[str("timestamp")].asI64(),
                              str("post"), request[str("path")].stringRef(), request[str("body")].stringRef().toUtf8(),
                              &headers, &failure, request[str("nonce")].stringRef(),
                              request[str("requestId")].stringRef()));
        QHash<QByteArray, QByteArray> map;
        for (const auto &h : headers)
            map.insert(h.first, h.second);
        QCOMPARE(map.value("x-meticulous-key-id"), QByteArray("22222222-2222-4222-8222-222222222222"));
        QCOMPARE(map.value("x-meticulous-key-version"), QByteArray("3"));
        QCOMPARE(map.value("x-meticulous-timestamp"), QByteArray("1786700000"));
        QCOMPARE(map.value("x-meticulous-nonce"), QByteArray("AAECAwQFBgcICQoLDA0ODw"));
        QCOMPARE(map.value("x-meticulous-request-id"), QByteArray("33333333-3333-4333-8333-333333333333"));
        QCOMPARE(QString::fromLatin1(map.value("x-meticulous-signature")), request[str("signature")].stringRef());
        const auto signature = crypto::base64UrlDecode(request[str("signature")].stringRef());
        QVERIFY(signature);
        QVERIFY(crypto::ed25519Verify(*publicKey, canonical.toUtf8(), *signature));
        QVERIFY(!crypto::ed25519Verify(*publicKey, canonical.toUtf8() + "x", *signature));
    }

    void enrollmentCanonicalStringFollowsTheContract()
    {
        QCOMPARE(enrollmentExchangeCanonical(QString::fromLatin1(kExchangePath), str("11111111-1111-4111-8111-111111111111"),
                                             1786700000, str("nonce"), str("33333333-3333-4333-8333-333333333333"),
                                             str("abc")),
                 str("meticulous-enrollment-exchange-v1\nmethod:POST\npath:/api/machine-uploads/v1/enrollments/exchange\n"
                     "audience:meticulous-community\ninstallation-id:11111111-1111-4111-8111-111111111111\n"
                     "timestamp:1786700000\nnonce:nonce\nrequest-id:33333333-3333-4333-8333-333333333333\nbody-sha256:abc\n"));
    }

    void base64UrlIsStrict()
    {
        QVERIFY(crypto::base64UrlDecode(str("nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A")));
        QVERIFY(!crypto::base64UrlDecode(str("nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A=")));   // padding
        QVERIFY(!crypto::base64UrlDecode(str("nWGxne/9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A")));    // standard alphabet
        QVERIFY(!crypto::base64UrlDecode(str("nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2B")));    // trailing bits
        QVERIFY(!crypto::base64UrlDecode(str("abcde")));                                          // length
        QCOMPARE(crypto::base64UrlEncode(QByteArray("\xfb\xff", 2)), str("-_8"));
    }

    void uuidsParseAndPrintLikeTheUuidCrate()
    {
        const QString expected = str("22222222-2222-4222-8222-222222222222");
        QCOMPARE(crypto::parseUuid(str("22222222-2222-4222-8222-222222222222")), std::optional<QString>(expected));
        QCOMPARE(crypto::parseUuid(str("22222222222242228222222222222222")), std::optional<QString>(expected));
        QCOMPARE(crypto::parseUuid(str("{22222222-2222-4222-8222-222222222222}")), std::optional<QString>(expected));
        QCOMPARE(crypto::parseUuid(str("urn:uuid:22222222-2222-4222-8222-222222222222")), std::optional<QString>(expected));
        QCOMPARE(crypto::parseUuid(str("ABCDEFAB-2222-4222-8222-222222222222")),
                 std::optional<QString>(str("abcdefab-2222-4222-8222-222222222222")));
        QVERIFY(!crypto::parseUuid(str("22222222-2222-4222-8222-22222222222")));
        QVERIFY(!crypto::parseUuid(str("2222222-22222-4222-8222-222222222222")));
        QVERIFY(!crypto::parseUuid(str("g2222222-2222-4222-8222-222222222222")));
        const QString random = crypto::newUuid();
        QCOMPARE(random.size(), 36);
        QCOMPARE(random[14], QLatin1Char('4'));
        QVERIFY(QStringLiteral("89ab").contains(random[19]));
        QCOMPARE(crypto::parseUuid(random), std::optional<QString>(random));
        QVERIFY(crypto::newUuid() != random);
        QCOMPARE(randomNonce().size(), 32);   // 24 bytes
    }

    // --- the Rust tests of community_upload.rs ----------------------------------------------
    void keepsAnExpiredDisplayChallengeForTheBoundedExchangeGrace()
    {
        const qint64 issuedAt = 1000;
        QVERIFY(!enrollmentExchangeExpired(issuedAt, issuedAt + kEnrollmentTtlSeconds));
        QVERIFY(!enrollmentExchangeExpired(issuedAt,
                                           issuedAt + kEnrollmentTtlSeconds + kEnrollmentExchangeGraceSeconds - 1));
        QVERIFY(enrollmentExchangeExpired(issuedAt, issuedAt + kEnrollmentTtlSeconds + kEnrollmentExchangeGraceSeconds));
    }

    void wrapsRawShotWithoutReserializingIt()
    {
        const QByteArray raw = R"( {"id":"shot-1","data":[{"unknown":true}],"profile":{"future":{"kept":true}}} )";
        const QByteArray body = wrapShotBody(raw);
        QVERIFY(body.contains(raw));
        QCOMPARE(body, QByteArray("{\"contractVersion\":1,\"shot\":") + raw + "}");
        const auto parsed = parseJson(body);
        QVERIFY(parsed);
        QCOMPARE((*parsed)[str("shot")][str("profile")][str("future")][str("kept")].asBool(), std::optional<bool>(true));
    }

    void acceptsCanonicalPourOverRecordsForTheSharedUploadEnvelope()
    {
        // The backend contract models sample time as a float, so its canonical JSON emits 403.0.
        const QByteArray raw = R"({"schemaVersion":4,"id":"pour-over-1","brewType":"pour_over","mode":"free_pour",)"
                               R"("recipe":{"pourTargets":[]},"pours":[],"samples":[{"t":403.0,"w":0,"f":1,"p":1}]})";
        QString id;
        RequestFailure failure;
        QVERIFY(validateHistoryRecord(parse(raw.constData()), HistoryKind::PourOver, &id, &failure));
        QCOMPARE(id, str("pour-over-1"));
        const auto envelope = parseJson(wrapShotBody(raw));
        QVERIFY(envelope);
        QCOMPARE((*envelope)[str("shot")][str("brewType")].asString(), std::optional<QString>(str("pour_over")));
    }

    void acceptsBoundedFractionalPourOverSampleTimes()
    {
        QString id;
        RequestFailure failure;
        QVERIFY(validateHistoryRecord(
            parse(R"({"schemaVersion":4,"id":"pour-over-fractional-time","brewType":"pour_over","mode":"profile",)"
                  R"("recipe":{"pourTargets":[]},"pours":[],"samples":[{"t":403.25,"w":1.2,"f":4.3,"p":1}]})"),
            HistoryKind::PourOver, &id, &failure));
        QCOMPARE(id, str("pour-over-fractional-time"));
    }

    void rejectsMalformedOrUnboundedPourOverRecords_data()
    {
        QTest::addColumn<QByteArray>("record");
        QTest::addColumn<QString>("category");
        const QByteArray head = R"({"id":"pour-over-1","brewType":"pour_over","mode":"free_pour",)";
        QTest::newRow("missing samples") << head + R"("schemaVersion":4,"recipe":{"pourTargets":[]},"pours":[]})"
                                         << str("pour_over_samples_invalid");
        QTest::newRow("future schema")
            << head + R"("schemaVersion":5,"recipe":{"pourTargets":[]},"pours":[],"samples":[{"t":0}]})"
            << str("pour_over_schema_invalid");
        QTest::newRow("float schema (serde as_u64)")
            << head + R"("schemaVersion":4.0,"recipe":{"pourTargets":[]},"pours":[],"samples":[{"t":0}]})"
            << str("pour_over_schema_invalid");
        QTest::newRow("sample past limit")
            << head + R"("schemaVersion":4,"recipe":{"pourTargets":[]},"measurements":{"durationMs":600001},)"
                      R"("pours":[],"samples":[{"t":600001,"w":300,"f":0,"p":0}]})"
            << str("pour_over_samples_invalid");
        QTest::newRow("duration past limit")
            << head + R"("schemaVersion":4,"recipe":{"pourTargets":[]},"measurements":{"durationMs":600001},)"
                      R"("pours":[],"samples":[{"t":1}]})"
            << str("pour_over_duration_invalid");
        QTest::newRow("negative sample time")
            << head + R"("schemaVersion":4,"recipe":{"pourTargets":[]},"pours":[],"samples":[{"t":-0.1,"w":0}]})"
            << str("pour_over_samples_invalid");
        QTest::newRow("sample time not a number")
            << head + R"("schemaVersion":4,"recipe":{"pourTargets":[]},"pours":[],"samples":[{"t":"1"}]})"
            << str("pour_over_samples_invalid");
        QByteArray tooMany = head + R"("schemaVersion":4,"recipe":{"pourTargets":[]},"pours":[],"samples":[)";
        for (int i = 0; i <= kMaxPourOverSamples; ++i)
            tooMany += i ? R"(,{"t":0,"w":0,"f":0,"p":0})" : R"({"t":0,"w":0,"f":0,"p":0})";
        tooMany += "]}";
        QTest::newRow("too many samples") << tooMany << str("pour_over_samples_invalid");
        QTest::newRow("wrong type") << QByteArray(R"({"id":"x","brewType":"espresso"})") << str("pour_over_type_invalid");
        QTest::newRow("wrong mode")
            << QByteArray(R"({"id":"x","brewType":"pour_over","schemaVersion":1,"mode":"auto"})")
            << str("pour_over_mode_invalid");
        QTest::newRow("no pours")
            << head + R"("schemaVersion":4,"recipe":{"pourTargets":[]},"samples":[{"t":0}]})"
            << str("pour_over_pours_invalid");
        QTest::newRow("no targets") << head + R"("schemaVersion":4,"recipe":{},"pours":[],"samples":[{"t":0}]})"
                                    << str("pour_over_targets_invalid");
        QTest::newRow("no id") << QByteArray(R"({"brewType":"pour_over"})") << str("shot_id_invalid");
    }
    void rejectsMalformedOrUnboundedPourOverRecords()
    {
        QFETCH(QByteArray, record);
        QFETCH(QString, category);
        QString id;
        RequestFailure failure;
        QVERIFY(!validateHistoryRecord(parse(record.constData()), HistoryKind::PourOver, &id, &failure));
        QCOMPARE(failure.category, category);
        QVERIFY(failure.permanent);
    }

    void validatesEspressoRecords()
    {
        QString id;
        RequestFailure failure;
        QVERIFY(validateHistoryRecord(parse(R"({"id":"shot-1","data":[]})"), HistoryKind::Espresso, &id, &failure));
        QCOMPARE(id, str("shot-1"));
        QVERIFY(!validateHistoryRecord(parse(R"({"id":"shot-1","data":{}})"), HistoryKind::Espresso, &id, &failure));
        QCOMPARE(failure.category, str("shot_data_invalid"));
        QVERIFY(!validateHistoryRecord(parse(R"({"id":"","data":[]})"), HistoryKind::Espresso, &id, &failure));
        QCOMPARE(failure.category, str("shot_id_invalid"));
        const QByteArray longId = "{\"id\":\"" + QByteArray(257, 'a') + "\",\"data\":[]}";
        QVERIFY(!validateHistoryRecord(parse(longId.constData()), HistoryKind::Espresso, &id, &failure));
        QVERIFY(!validateHistoryRecord(parse(R"([1])"), HistoryKind::Espresso, &id, &failure));
        QCOMPARE(failure.category, str("shot_id_invalid"));
    }

    void rejectsHistoryPathTraversal()
    {
        QCOMPARE(normalizeHistoryPath(str("2026-08-15/shot.json.zst")),
                 std::optional<QString>(str("2026-08-15/shot.json.zst")));
        QCOMPARE(normalizeHistoryPath(str("  //2026-08-15 / shot.json.zst ")),
                 std::optional<QString>(str("2026-08-15/shot.json.zst")));
        QVERIFY(!normalizeHistoryPath(str("../config/secret")));
        QVERIFY(!normalizeHistoryPath(str("2026-08-15/../../secret")));
        QVERIFY(!normalizeHistoryPath(str("2026-08-15/./x")));
        QVERIFY(!normalizeHistoryPath(str("2026-08-15")));
        QVERIFY(!normalizeHistoryPath(str("2026-08-15//x")));
        QVERIFY(!normalizeHistoryPath(str("a\\b/c")));
        QVERIFY(!normalizeHistoryPath(str("a/") + QString(256, QLatin1Char('x'))));
    }

    void classifiesIdempotencyConflictsAsPermanent()
    {
        QVERIFY(failureIsPermanent(409, str("idempotency_payload_mismatch")));
        QVERIFY(!failureIsPermanent(409, str("replayed_request")));
        QVERIFY(failureIsPermanent(401, str("retired_or_revoked_access")));
        QVERIFY(!failureIsPermanent(401, str("expired_request")));
        QVERIFY(failureIsPermanent(400, str("invalid_json")));
        QVERIFY(!failureIsPermanent(408, str("x")));
        QVERIFY(!failureIsPermanent(429, str("rate_limited")));
        QVERIFY(!failureIsPermanent(503, str("x")));
        QVERIFY(failureIsPermanent(503, str("retired_key")));
    }

    void retriesPourOverSchemaRejectionsWithoutBlockingEspresso()
    {
        const RequestFailure pourOver =
            reclassifyUploadFailure(failureOf("invalid_json", true, 400), HistoryKind::PourOver);
        QCOMPARE(pourOver.category, str("community_pour_over_not_ready"));
        QCOMPARE(pourOver.retryAfterSeconds, std::optional<qint64>(kServerUpgradeRetrySeconds));
        QVERIFY(!pourOver.permanent);
        const RequestFailure espresso =
            reclassifyUploadFailure(failureOf("invalid_json", true, 400), HistoryKind::Espresso);
        QCOMPARE(espresso.category, str("invalid_json"));
        QVERIFY(espresso.permanent);
        QCOMPARE(reclassifyUploadFailure(failureOf("other", true, 422), HistoryKind::PourOver).category,
                 str("community_pour_over_not_ready"));
        QCOMPARE(reclassifyUploadFailure(failureOf("other", true, 400), HistoryKind::PourOver).category, str("other"));
    }

    void retriesTemporaryUploadFailuresWithBoundedBackoff()
    {
        PersistentState state = *freshState();
        QueuedShot item = shot(str("temporary-failure"), str("2026-08-17/temporary.shot.json"), HistoryKind::Espresso,
                               str("temporary.json"), 0, 0);
        const QString id = item.id;
        state.queue.append(item);
        scheduleQueueRetry(state, id, temporary(str("upload_network")), 1000);
        QCOMPARE(state.queue.size(), 1);
        QCOMPARE(state.queue[0].attemptCount, 1u);
        QCOMPARE(state.queue[0].nextAttemptAt, 1002);
        QCOMPARE(state.queue[0].lastError, std::optional<QString>(str("upload_network")));
        QCOMPARE(state.lastRetryAt, std::optional<qint64>(1000));
        QCOMPARE(state.lastError, std::optional<QString>(str("upload_network")));
        // Retries stay bounded no matter how often an item fails.
        qint64 previous = 0;
        for (int i = 0; i < 20; ++i) {
            scheduleQueueRetry(state, id, temporary(str("upload_network")), 1000);
            QVERIFY(state.queue[0].nextAttemptAt >= previous);
            previous = state.queue[0].nextAttemptAt;
        }
        QVERIFY(state.queue[0].nextAttemptAt <= 1000 + 300);
        QCOMPARE(state.queue[0].nextAttemptAt, 1000 + 256);   // 2^8, under the 300 s cap
        RequestFailure withRetry = temporary(str("rate_limited"));
        withRetry.retryAfterSeconds = 42;
        scheduleQueueRetry(state, id, withRetry, 1000);
        QCOMPARE(state.queue[0].nextAttemptAt, 1042);
    }

    void reactivatesPourOversParkedByAnOlderCommunityDeployment()
    {
        PersistentState state = *freshState();
        state.queue.append(shot(str("pour-over-parked"), str("2026-08-16/parked.json.zst"), HistoryKind::PourOver,
                                str("parked.json"), 1, std::numeric_limits<qint64>::max(), str("invalid_json")));
        state.queue.append(shot(str("espresso-parked"), str("2026-08-16/e.json.zst"), HistoryKind::Espresso,
                                str("e.json"), 1, std::numeric_limits<qint64>::max(), str("invalid_json")));
        QCOMPARE(reactivateDeploymentBlockedPourOvers(state, 1234), 1);
        QCOMPARE(state.queue[0].nextAttemptAt, 1234);
        QCOMPARE(state.queue[0].lastError, std::optional<QString>(str("community_pour_over_not_ready")));
        QCOMPARE(state.queue[1].nextAttemptAt, std::numeric_limits<qint64>::max());
        QCOMPARE(state.lastError, std::optional<QString>(str("community_pour_over_not_ready")));
        QCOMPARE(state.lastRetryAt, std::optional<qint64>(1234));
        QCOMPARE(reactivateDeploymentBlockedPourOvers(state, 1235), 0);
    }

    void schedulesReplayForPourOversSkippedByTheFractionalSampleBug()
    {
        PersistentState state = *freshState();
        state.pourOverHistoryBaselined = true;
        state.pourOverHistoryCursor = str("2026-08-17/skipped.pour-over.json.zst");
        state.lastError = str("pour_over_samples_invalid");
        QVERIFY(scheduleFractionalSampleRejectionReplay(state, 1234));
        QVERIFY(state.pourOverHistoryBaselined);
        QVERIFY(!state.pourOverHistoryCursor);
        QCOMPARE(state.lastError, std::optional<QString>(str("pour_over_replay_scheduled")));
        QCOMPARE(state.lastRetryAt, std::optional<qint64>(1234));
        QVERIFY(!scheduleFractionalSampleRejectionReplay(state, 1235));
    }

    void doesNotRewindWhenAPourOverIsAlreadyDurablyQueued()
    {
        PersistentState state = *freshState();
        state.pourOverHistoryBaselined = true;
        state.pourOverHistoryCursor = str("2026-08-17/queued.pour-over.json.zst");
        state.lastError = str("pour_over_samples_invalid");
        state.queue.append(shot(str("queued-pour-over"), str("2026-08-17/queued.pour-over.json.zst"),
                                HistoryKind::PourOver, str("queued.json"), 0, 1234));
        QVERIFY(!scheduleFractionalSampleRejectionReplay(state, 1234));
        QCOMPARE(state.pourOverHistoryCursor, std::optional<QString>(str("2026-08-17/queued.pour-over.json.zst")));
    }

    void boundsTheDurableUploadQueueByCountAndBytes()
    {
        QVERIFY(queueCapacityAllows(0, 0, quint64(kMaxShotBodyBytes)));
        QVERIFY(!queueCapacityAllows(kMaxQueueItems, 0, 1));
        QVERIFY(queueCapacityAllows(1, kMaxQueueBytes - 1, 1));
        QVERIFY(!queueCapacityAllows(1, kMaxQueueBytes, 1));
        QVERIFY(!queueCapacityAllows(1, std::numeric_limits<quint64>::max(), 1));   // saturating
    }

    void aDeploymentBlockedPourOverDoesNotBlockALaterEspresso()
    {
        const QueuedShot blocked = shot(str("blocked-pour-over"), str("2026-08-16/blocked.json.zst"),
                                        HistoryKind::PourOver, str("blocked.json"), 1, 10000,
                                        str("community_pour_over_not_ready"));
        const QueuedShot espresso = shot(str("ready-espresso"), str("2026-08-16/ready.shot.json"),
                                         HistoryKind::Espresso, str("ready.json"), 0, 100);
        const auto selected = nextDueQueueItem({blocked, espresso}, 100);
        QVERIFY(selected);
        QCOMPARE(selected->id, espresso.id);
        QVERIFY(!nextDueQueueItem({blocked}, 100));
    }

    void rotatesRevokedIdentityWithoutLosingQueuedShots()
    {
        PersistentState state = *freshState();
        const QString priorInstallation = state.installationId;
        const QString priorPublicKey = state.publicKey;
        state.queue.append(shot(str("queued-shot"), str("2026-08-15/queued.shot.json"), HistoryKind::Espresso,
                                str("queued.json"), 2, 123, str("retired_key")));
        QVERIFY(rotateIdentityPreservingQueue(state));
        QVERIFY(state.installationId != priorInstallation);
        QVERIFY(state.publicKey != priorPublicKey);
        QVERIFY(validateState(state));
        QCOMPARE(state.queue.size(), 1);
        QCOMPARE(state.queue[0].sourceShotId, str("queued-shot"));
    }

    void migratesExistingUploaderStateWithEspressoDefaults()
    {
        PersistentState state = *freshState();
        state.queue.append(shot(str("legacy-shot"), str("2026-08-15/legacy.shot.json"), HistoryKind::PourOver,
                                str("legacy.json"), 0, 123));
        QByteArray serialized = serializeState(state);
        const QByteArray fields = ",\"pourOverHistoryBaselined\":false,\"pourOverHistoryCursor\":null";
        QVERIFY(serialized.contains(fields));
        serialized.replace(fields, "");
        QVERIFY(serialized.contains(",\"historyKind\":\"pour_over\""));
        serialized.replace(",\"historyKind\":\"pour_over\"", "");
        const auto migrated = parseState(serialized);
        QVERIFY(migrated);
        QVERIFY(!migrated->pourOverHistoryBaselined);
        QVERIFY(!migrated->pourOverHistoryCursor);
        QCOMPARE(migrated->queue[0].historyKind, HistoryKind::Espresso);
    }

    // --- state.json compatibility -------------------------------------------------------------
    void readsAndWritesStateJsonByteForByteLikeSerde()
    {
        // As serde_json::to_vec(&PersistentState) writes it (struct order, compact, None as null).
        const QByteArray rust =
            R"({"installationId":"11111111-1111-4111-8111-111111111111",)"
            R"("privateSeed":"nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",)"
            R"("publicKey":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",)"
            R"("enrollment":{"challenge":"abc","issuedAt":1786700000,"machineSerial":null},)"
            R"("authorizationId":"44444444-4444-4444-8444-444444444444",)"
            R"("keyId":"22222222-2222-4222-8222-222222222222","keyVersion":3,"paused":false,)"
            R"("historyBaselined":true,"historyCursor":"2026-08-15/a.shot.json.zst",)"
            R"("pourOverHistoryBaselined":true,"pourOverHistoryCursor":null,)"
            R"("queue":[{"id":"55555555-5555-4555-8555-555555555555","sourceShotId":"shot-1",)"
            R"("historyPath":"2026-08-15/b.shot.json.zst","historyKind":"espresso",)"
            R"("bodyFile":"55555555-5555-4555-8555-555555555555.json","attemptCount":2,)"
            R"("nextAttemptAt":9223372036854775807,"lastError":"upload_network"},)"
            // (moc misreads \" inside a raw string: an ordinary literal here)
            "{\"id\":\"66666666-6666-4666-8666-666666666666\",\"sourceShotId\":\"po-\\\"1\\\"\","
            R"("historyPath":"2026-08-16/c.pour-over.json.zst","historyKind":"pour_over",)"
            R"("bodyFile":"66666666-6666-4666-8666-666666666666.json","attemptCount":0,)"
            R"("nextAttemptAt":-5,"lastError":null}],)"
            R"("lastSuccessAt":1786700001,"lastError":"upload_network","lastRetryAt":null})";
        const auto state = parseState(rust);
        QVERIFY(state);
        QVERIFY(validateState(*state));
        QCOMPARE(state->keyVersion, std::optional<quint32>(3));
        QCOMPARE(state->enrollment->issuedAt, 1786700000);
        QCOMPARE(state->queue.size(), 2);
        QCOMPARE(state->queue[0].nextAttemptAt, std::numeric_limits<qint64>::max());
        QCOMPARE(state->queue[1].historyKind, HistoryKind::PourOver);
        QCOMPARE(state->queue[1].sourceShotId, str("po-\"1\""));
        QCOMPARE(serializeState(*state), rust);

        const UploadStatus status = statusOf(*state);
        QCOMPARE(status.state, str("connected"));
        QCOMPARE(status.pendingCount, 2);
        QCOMPARE(status.enrollmentExpiresAt, std::optional<qint64>(1786700000 + 600));
        QCOMPARE(status.toJson().toJson(false),
                 QByteArray(R"({"state":"connected","connected":true,"paused":false,"pendingCount":2,)"
                            R"("lastSuccessAt":1786700001,"lastError":"upload_network","lastRetryAt":null,)"
                            R"("enrollmentExpiresAt":1786700600})"));
    }

    void rejectsStateJsonThatSerdeRejects_data()
    {
        QTest::addColumn<QByteArray>("from");
        QTest::addColumn<QByteArray>("to");
        QTest::newRow("missing paused") << QByteArray("\"paused\":false,") << QByteArray();
        QTest::newRow("missing queue") << QByteArray(",\"queue\":[]") << QByteArray();
        QTest::newRow("float key version") << QByteArray("\"keyVersion\":3") << QByteArray("\"keyVersion\":3.0");
        QTest::newRow("negative key version") << QByteArray("\"keyVersion\":3") << QByteArray("\"keyVersion\":-3");
        QTest::newRow("bad uuid") << QByteArray("\"keyId\":\"22222222-2222-4222-8222-222222222222\"")
                                  << QByteArray("\"keyId\":\"nope\"");
        QTest::newRow("null pour-over flag") << QByteArray("\"pourOverHistoryBaselined\":false")
                                             << QByteArray("\"pourOverHistoryBaselined\":null");
        QTest::newRow("duplicate field") << QByteArray("\"paused\":false,") << QByteArray("\"paused\":false,\"paused\":true,");
        QTest::newRow("not json") << QByteArray("{") << QByteArray("[");
    }
    void rejectsStateJsonThatSerdeRejects()
    {
        QFETCH(QByteArray, from);
        QFETCH(QByteArray, to);
        const QByteArray base =
            R"({"installationId":"11111111-1111-4111-8111-111111111111",)"
            R"("privateSeed":"nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",)"
            R"("publicKey":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo","enrollment":null,"authorizationId":null,)"
            R"("keyId":"22222222-2222-4222-8222-222222222222","keyVersion":3,"paused":false,"historyBaselined":false,)"
            R"("historyCursor":null,"pourOverHistoryBaselined":false,"pourOverHistoryCursor":null,"queue":[],)"
            R"("lastSuccessAt":null,"lastError":null,"lastRetryAt":null})";
        QVERIFY(parseState(base));
        QByteArray changed = base;
        QVERIFY(changed.contains(from));
        changed.replace(changed.indexOf(from), from.size(), to);
        QVERIFY(!parseState(changed));
    }

    void validateStateCatchesAMismatchedKey()
    {
        PersistentState state = *freshState();
        QVERIFY(validateState(state));
        state.publicKey = (*freshState()).publicKey;
        QVERIFY(!validateState(state));
        state.privateSeed = str("short");
        QVERIFY(!validateState(state));
    }

    void statusFollowsTheConnectionState()
    {
        PersistentState state = *freshState();
        QCOMPARE(statusOf(state).state, str("not_connected"));
        state.keyId = crypto::newUuid();
        QCOMPARE(statusOf(state).state, str("not_connected"));   // needs the key version too
        state.keyVersion = 1;
        QCOMPARE(statusOf(state).state, str("connected"));
        state.paused = true;
        QCOMPARE(statusOf(state).state, str("upload_paused"));
        QVERIFY(statusOf(state).paused);
        const UploadStatus unavailable = unavailableStatus(QString::fromLatin1(kStorageUnavailable));
        QCOMPARE(unavailable.state, str("unavailable"));
        QVERIFY(!unavailable.connected);
        QCOMPARE(unavailable.lastError, std::optional<QString>(QString::fromLatin1(kStorageUnavailable)));
    }

    void safeCategoryKeepsOnlyTheAllowedCharacters()
    {
        QCOMPARE(safeCategory(str("Retired Key!")), str("etiredey"));
        QCOMPARE(safeCategory(str("")), str("unknown"));
        QCOMPARE(safeCategory(str("ÉÉÉ")), str("unknown"));
        QCOMPARE(safeCategory(QString(100, QLatin1Char('a'))).size(), 64);
        QCOMPARE(temporary(str("UPLOAD")).category, str("unknown"));
    }

    void parsesIntegersLikeRust()
    {
        QCOMPARE(parseI64("5"), std::optional<qint64>(5));
        QCOMPARE(parseI64("+5"), std::optional<qint64>(5));
        QCOMPARE(parseI64("-5"), std::optional<qint64>(-5));
        QCOMPARE(parseI64("9223372036854775807"), std::optional<qint64>(std::numeric_limits<qint64>::max()));
        QCOMPARE(parseI64("-9223372036854775808"), std::optional<qint64>(std::numeric_limits<qint64>::min()));
        QVERIFY(!parseI64("9223372036854775808"));
        QVERIFY(!parseI64(" 5"));
        QVERIFY(!parseI64("5s"));
        QVERIFY(!parseI64("Wed, 21 Oct 2015 07:28:00 GMT"));
        QVERIFY(!parseI64(""));
        QVERIFY(!parseI64("-"));
    }

    void parsesServerResponsesLikeSerde()
    {
        const auto exchanged = parseExchangeResponse(
            parse(R"({"accessToken":"t","authorizationId":"44444444-4444-4444-8444-444444444444",)"
                  R"("keyId":"22222222-2222-4222-8222-222222222222","keyVersion":7,"extra":1})"));
        QVERIFY(exchanged);
        QCOMPARE(exchanged->keyVersion, 7u);
        QVERIFY(!parseExchangeResponse(parse(R"({"accessToken":"t","authorizationId":"44444444-4444-4444-8444-444444444444",)"
                                             R"("keyId":"22222222-2222-4222-8222-222222222222","keyVersion":7.0})")));
        QVERIFY(!parseExchangeResponse(parse(R"({"accessToken":"t"})")));
        QCOMPARE(parseTokenResponse(parse(R"({"accessToken":"abc"})")), std::optional<QString>(str("abc")));
        QVERIFY(!parseTokenResponse(parse(R"({"accessToken":null})")));
        QCOMPARE(parseErrorResponse(parse(R"({"error":"retired_key"})")), std::optional<QString>(str("retired_key")));
        QVERIFY(!parseErrorResponse(parse(R"({"error":5})")));
        QVERIFY(!parseErrorResponse(parse(R"({"message":"x"})")));
        QVERIFY(!parseErrorResponse(parse(R"("x")")));
        const auto history = parseHistoryResponse(
            parse(R"({"history":[{"file":"a/1","url":"u","name":"n"},{"url":"a/2","name":"n"},{"name":"a/3"},{}]})"));
        QVERIFY(history);
        QCOMPARE(*history, QStringList({str("a/1"), str("a/2"), str("a/3")}));
        QVERIFY(!parseHistoryResponse(parse(R"({"history":[{"file":3}]})")));
        QVERIFY(!parseHistoryResponse(parse(R"({"items":[]})")));
    }

    // --- URLs ---------------------------------------------------------------------------------
    void buildsTheCommunityAndMachineUrls()
    {
        const QUrl community(str("https://community.meticuloushome.com/ignored?x=1"));
        QCOMPARE(urlWithPath(community, QString::fromLatin1(kShotPath)).toString(QUrl::FullyEncoded),
                 str("https://community.meticuloushome.com/api/machine-uploads/v1/shots"));
        QCOMPARE(machineHistoryFileTarget(HistoryKind::Espresso, str("2026-08-15/shot 1.json.zst")),
                 std::optional<QByteArray>("/api/v1/history/files/2026-08-15/shot%201.json.zst"));
        QCOMPARE(machineHistoryFileTarget(HistoryKind::PourOver, str("/2026-08-15/a#b?c%.json")),
                 std::optional<QByteArray>("/api/v1/history/pour-over/files/2026-08-15/a%23b%3Fc%25.json"));
        // The url crate keeps | ^ [ ] ~ and the sub-delims in a path segment (QUrl would encode | and ^).
        QCOMPARE(machineHistoryFileTarget(HistoryKind::Espresso, str("d/[x]|^~'!$&()*+,;=@:é`{}\"<>")),
                 std::optional<QByteArray>("/api/v1/history/files/d/[x]|^~'!$&()*+,;=@:%C3%A9%60%7B%7D%22%3C%3E"));
        QVERIFY(!machineHistoryFileTarget(HistoryKind::Espresso, str("../x")));
        const QByteArray list = machineHistoryListTarget(str("/api/v1/history/upload-index"), false,
                                                         str("2026-08-15/a b:c.json"));
        QCOMPARE(list, QByteArray("/api/v1/history/upload-index?max_results=200&after=2026-08-15%2Fa+b%3Ac.json"));
        // Form decoding (what the backend does) gives the cursor back.
        const QString after = QUrlQuery(QString::fromLatin1(list.mid(list.indexOf('?') + 1)))
                                  .queryItemValue(str("after"), QUrl::FullyEncoded);
        QCOMPARE(QUrl::fromPercentEncoding(after.toLatin1().replace('+', ' ')), str("2026-08-15/a b:c.json"));
        // form_urlencoded::byte_serialize: only alphanumerics and *-._ stay (QUrl would decode %7E).
        QCOMPARE(machineHistoryListTarget(str("/api/v1/history/upload-index"), false, str("a~b|c")),
                 QByteArray("/api/v1/history/upload-index?max_results=200&after=a%7Eb%7Cc"));
        QCOMPARE(machineHistoryListTarget(str("/api/v1/history/pour-over"), true, std::nullopt),
                 QByteArray("/api/v1/history/pour-over?sort=asc&max_results=200"));
    }

    void buildsTheEnrollmentQrLink()
    {
        EnrollmentState enrollment;
        enrollment.challenge = str("CHALLENGE");
        enrollment.issuedAt = 1786700000;
        const QByteArray payload =
            enrollmentPayload(str("11111111-1111-4111-8111-111111111111"), enrollment, str("PUBLIC"));
        // json! objects are BTreeMaps: the keys come out sorted.
        QCOMPARE(payload, QByteArray(R"({"challenge":"CHALLENGE","contractVersion":1,)"
                                     R"("installationId":"11111111-1111-4111-8111-111111111111","issuedAt":1786700000,)"
                                     R"("kind":"meticulous-community-enrollment","machineSerial":null,"publicKey":"PUBLIC"})"));
        enrollment.machineSerial = str("SN-1");
        const QByteArray withSerial =
            enrollmentPayload(str("11111111-1111-4111-8111-111111111111"), enrollment, str("PUBLIC"));
        QVERIFY(withSerial.contains(R"("machineSerial":"SN-1")"));
        const QString link = enrollmentQrUrl(QUrl(QString::fromLatin1(kDefaultCommunityBase)), withSerial);
        QVERIFY(link.startsWith(str("https://community.meticuloushome.com/my-setup/machine/connect?enrollment=")));
        const QString encoded = link.mid(link.indexOf(QLatin1Char('=')) + 1);
        QCOMPARE(crypto::base64UrlDecode(encoded), std::optional<QByteArray>(withSerial));
        QCOMPARE(exchangeBody(str("11111111-1111-4111-8111-111111111111"), str("CH")),
                 QByteArray(R"({"challenge":"CH","contractVersion":1,"installationId":"11111111-1111-4111-8111-111111111111"})"));
    }

    // --- diagnostics.rs -----------------------------------------------------------------------
    void snapshotExcludesSecretsAndUnknownFields()
    {
        const JsonValue value = diagnostics::snapshot(
            parse(R"({"connected": true, "paused": false, "pendingCount": 2, "privateSeed": "SECRET",)"
                  R"("accessToken": "SECRET", "lastError": "SECRET",)"
                  R"("recovery": {"state": "running", "added": 3, "privateSeed": "SECRET"}})"),
            42);
        QVERIFY(!value.toJson(true).contains("SECRET"));
        QCOMPARE(value[str("lastError")].asString(), std::optional<QString>(str("other_error")));
        QCOMPARE(value[str("recovery")][str("added")].asU64(), std::optional<quint64>(3));
        QCOMPARE(value[str("recovery")][str("state")].asString(), std::optional<QString>(str("running")));
        QCOMPARE(value[str("pendingCount")].asU64(), std::optional<quint64>(2));
        QCOMPARE(value[str("capturedAt")].asU64(), std::optional<quint64>(42));
        QCOMPARE(value[str("schemaVersion")].asU64(), std::optional<quint64>(1));
        QCOMPARE(diagnostics::snapshot(parse(R"({"lastError":"upload_network"})"), 1)[str("lastError")].asString(),
                 std::optional<QString>(str("upload_network")));
        QCOMPARE(diagnostics::snapshot(parse("{}"), 1).toJson(true),
                 QByteArray(R"({"capturedAt":1,"connected":null,"lastError":null,"lastRetryAt":null,"lastSuccessAt":null,)"
                            R"("paused":null,"pendingCount":null,"recovery":{"available":false},"schemaVersion":1})"));
    }

    void reporterWritesPrivateSanitizedFileAndLimitsWrites()
    {
        QTemporaryDir root;
        QVERIFY(root.isValid());
        const QString path = root.filePath(str("diagnostics.json"));
        qint64 now = 1000;
        diagnostics::setClockForTests([&] { return now; });
        diagnostics::resetForTests();
        diagnostics::Reporter reporter;
        reporter.observe(parse(R"({"pendingCount": 2, "accessToken": "SECRET"})"), path);
        QFile file(path);
        QVERIFY(file.open(QIODevice::ReadOnly));
        const QByteArray first = file.readAll();
        file.close();
        QVERIFY(!first.contains("SECRET"));
        QCOMPARE((*parseJson(first))[str("pendingCount")].asU64(), std::optional<quint64>(2));
        QVERIFY((*parseJson(first))[str("lastFailure")].isNull());
        now += 29;
        reporter.observe(parse(R"({"pendingCount": 3})"), path);
        QVERIFY(file.open(QIODevice::ReadOnly));
        QCOMPARE(file.readAll(), first);
        file.close();
        struct stat st;
        QCOMPARE(::stat(QFile::encodeName(path).constData(), &st), 0);
        QCOMPARE(int(st.st_mode & 0777), 0600);
        QCOMPARE(::stat(QFile::encodeName(root.path()).constData(), &st), 0);
        QCOMPARE(int(st.st_mode & 0777), 0700);
        // After 30 s it writes again, with the last failure.
        diagnostics::failure(str("upload_network"), 503, 5, str("{33333333-3333-4333-8333-333333333333}"));
        now += 1;
        reporter.observe(parse(R"({"pendingCount": 3})"), path);
        QVERIFY(file.open(QIODevice::ReadOnly));
        const JsonValue second = *parseJson(file.readAll());
        QCOMPARE(second[str("pendingCount")].asU64(), std::optional<quint64>(3));
        QCOMPARE(second[str("lastFailure")][str("category")].asString(), std::optional<QString>(str("upload_network")));
        QCOMPARE(second[str("lastFailure")][str("httpStatus")].asU64(), std::optional<quint64>(503));
        QCOMPARE(second[str("lastFailure")][str("retryAfterSeconds")].asU64(), std::optional<quint64>(5));
        QCOMPARE(second[str("lastFailure")][str("requestId")].asString(),
                 std::optional<QString>(str("33333333-3333-4333-8333-333333333333")));
        diagnostics::resetForTests();
        diagnostics::setClockForTests([] { return QDateTime::currentSecsSinceEpoch(); });
    }

    void repeatedRequestsDoNotFloodLogs()
    {
        diagnostics::Events events;
        const JsonValue event = parse(R"({"category":"upload_network", "httpStatus":null,"requestId":null})");
        QVERIFY(events.failure(event, 1));
        QVERIFY(!events.failure(event, 2));
        QVERIFY(events.failure(event, 301));
        QVERIFY(events.failure(parse(R"({"category":"token_network","httpStatus":401})"), 302));
        QVERIFY(events.takeLast());
        QVERIFY(!events.takeLast());
    }

    void categoriesOutsideTheAllowlistBecomeOtherError()
    {
        QCOMPARE(diagnostics::category(str("upload_network")), str("upload_network"));
        QCOMPARE(diagnostics::category(str("exchange_response_invalid")), str("other_error"));
        QCOMPARE(diagnostics::category(str("SECRET")), str("other_error"));
    }

    // --- storage ------------------------------------------------------------------------------
    void writesPrivateFilesAtomically()
    {
        QTemporaryDir root;
        const QString dir = root.filePath(str("a/b"));
        const QString path = dir + str("/state.json");
        QVERIFY(storage::writePrivateFileAtomic(path, "one"));
        QVERIFY(storage::writePrivateFileAtomic(path, "two"));
        QFile file(path);
        QVERIFY(file.open(QIODevice::ReadOnly));
        QCOMPARE(file.readAll(), QByteArray("two"));
        QCOMPARE(QDir(dir).entryList(QDir::Files | QDir::Hidden).size(), 1);   // no temporaries left
        struct stat st;
        ::stat(QFile::encodeName(dir).constData(), &st);
        QCOMPARE(int(st.st_mode & 0777), 0700);
        // A directory in the way: the write fails and leaves nothing behind.
        const QString blocked = dir + str("/blocked.json");
        QVERIFY(QDir().mkpath(blocked + str("/x")));
        QVERIFY(!storage::writePrivateFileAtomic(blocked, "x"));
        QCOMPARE(QDir(dir).entryList(QDir::Files | QDir::Hidden).size(), 1);
    }

    void loadsOrCreatesTheStateAndAppliesTheMigrations()
    {
        QTemporaryDir root;
        const QString path = root.filePath(str("state.json"));
        const auto created = storage::loadOrCreateState(path, 100);
        QVERIFY(created);
        QVERIFY(validateState(*created));
        const auto loaded = storage::loadOrCreateState(path, 100);
        QVERIFY(loaded);
        QCOMPARE(loaded->installationId, created->installationId);

        PersistentState parked = *created;
        parked.queue.append(shot(str("po"), str("2026-08-16/p.json.zst"), HistoryKind::PourOver, str("p.json"), 1,
                                 std::numeric_limits<qint64>::max(), str("invalid_shot")));
        QVERIFY(storage::persistState(path, parked));
        const auto migrated = storage::loadOrCreateState(path, 555);
        QVERIFY(migrated);
        QCOMPARE(migrated->queue[0].nextAttemptAt, 555);
        // ... and written back.
        QFile file(path);
        QVERIFY(file.open(QIODevice::ReadOnly));
        QCOMPARE(parseState(file.readAll())->queue[0].nextAttemptAt, 555);
        file.close();

        QVERIFY(storage::writePrivateFileAtomic(path, "{not json"));
        QVERIFY(!storage::loadOrCreateState(path, 1));
    }

    void removesOrphanedQueueFilesOnly()
    {
        QTemporaryDir root;
        const QString queue = root.filePath(str("queue"));
        QVERIFY(storage::createPrivateDir(queue));
        for (const char *name : {"keep.json", "orphan.json", ".orphan.json.x.tmp"}) {
            QFile file(queue + QLatin1Char('/') + QLatin1String(name));
            QVERIFY(file.open(QIODevice::WriteOnly));
            file.write("x");
        }
        QVERIFY(QDir().mkpath(queue + str("/subdir")));
        QVERIFY(QFile::link(queue + str("/keep.json"), queue + str("/link.json")));
        QVERIFY(storage::removeOrphanedQueueFiles(
            queue, {shot(str("s"), str("a/b"), HistoryKind::Espresso, str("keep.json"), 0, 0)}));
        QStringList left = QDir(queue).entryList(QDir::AllEntries | QDir::Hidden | QDir::System | QDir::NoDotAndDotDot);
        left.sort();
        QCOMPARE(left, QStringList({str("keep.json"), str("link.json"), str("subdir")}));
    }
};

QTEST_GUILESS_MAIN(TestCommunityModel)
#include "tst_community_model.moc"
