// The Qt Dial's Sentry reporter (src/sentry) end to end, against a local fake Sentry (fakesentry.h), in child
// processes (this executable run with `--child <scenario>`) that start it as main.cpp does:
//   (a) without DIAL_EXTERNAL_SERVICES=1 (and no local DIAL_SENTRY_DSN) nothing is initialised or written;
//   (b) qCritical, QML console.error and QML exceptions arrive as events with the release and the device
//       tags, a warning as a breadcrumb of a later event, cleaned of personal data; repeats and floods are
//       capped, also across restarts;
//   (c) a crash (and a qFatal) leaves a minidump that is sent on the next start; a crash loop is capped;
//   (d) an event made while Sentry cannot be reached is sent once it can, also after its retries ran out.
// Only 127.0.0.1 is ever contacted: the DSN is the fake's, and the scenarios that keep Sentry off have none.

#include "sentry/sentryreporter.h"

#include "fakesentry.h"

#include <QCoreApplication>
#include <QDir>
#include <QGuiApplication>
#include <QJsonArray>
#include <QProcess>
#include <QQmlComponent>
#include <QQmlEngine>
#include <QRegularExpression>
#include <QTemporaryDir>
#include <QTest>
#include <QThread>

#include <sentry.h>
#include <sys/resource.h>

namespace {

const char *const kVersion = "9.9.9-test";
const char *const kBuild = "42.gtest";

void machineInfo()
{
    dialsentry::setDeviceInfo({{QStringLiteral("serial"), QStringLiteral("SER-0042")},
                               {QStringLiteral("image_version"), QStringLiteral("2026.10.1")},
                               {QStringLiteral("image_build_channel"), QStringLiteral("beta")},
                               {QStringLiteral("name"), QStringLiteral("Alu Kitchen Machine")},
                               {QStringLiteral("hostname"), QStringLiteral("alus-kitchen")}});
}

const char *const kQmlScenario = R"(
import QtQml
import Dial.Native
QtObject {
    Component.onCompleted: {
        Sentry.setDeviceInfo({ serial: 4242, image_version: "2026.10.2", image_build_channel: "stable",
                               name: "Kitchen Dial", hostname: "kitchen-dial" })
        Sentry.captureMessage("Dial UI sustained slowdown", {
            level: "warning", fingerprint: ["dial-ui-sustained-slowdown"],
            tags: { "slowdown-report-kind": "sustained", "hostname": "kitchen-dial" },
            contexts: { dial_performance: { observed_fps: 12.5 }, wifi: { ssid: "Home", signal: 70 } } })
        console.warn("a QML warning before the error")
        console.error("a QML console error on kitchen-dial")
        var nothing = null
        nothing.missing = 1
    }
}
)";

int child(const QByteArray &scenario, int argc, char **argv)
{
    // A crash must not leave a core file behind.
    struct rlimit noCore = {0, 0};
    setrlimit(RLIMIT_CORE, &noCore);

    if (scenario == "disabled") {
        const bool on = dialsentry::start(kVersion, kBuild);
        qCritical("a critical message while Sentry is off");
        const bool initialised = sentry_is_enabled();
        dialsentry::stop();
        printf("enabled=%d initialised=%d\n", on, initialised);
        return on || initialised ? 3 : 0;
    }
    if (!dialsentry::start(kVersion, kBuild))
        return 2;
    if (scenario == "log") {
        machineInfo();
        qWarning("a warning before the error, password=hunter2 from 192.168.1.20");
        qCritical("a critical error for alu@example.com on Alu Kitchen Machine");
        for (int i = 0; i < 5; ++i)
            qCritical("a repeated critical error, attempt %d", i);
        qWarning("file:///usr/share/meticulous-dial-qt/qml/Dial/screens/brew/Barometer.qml:42: TypeError: "
                 "Cannot read property 'x' of null");
    } else if (scenario == "cap") {
        for (const char *word : {"alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india",
                                 "juliett", "kilo", "lima", "mike", "november", "oscar"})
            qCritical("distinct critical message %s", word);
    } else if (scenario == "qml") {
        QGuiApplication app(argc, argv);
        qmlRegisterSingletonInstance("Dial.Native", 1, 0, "Sentry", new SentryBridge(&app));
        QQmlEngine engine;
        QQmlComponent component(&engine);
        component.setData(kQmlScenario,
                          QUrl(QStringLiteral("file:///usr/share/meticulous-dial-qt/qml/Dial/screens/test/SentryTest.qml")));
        QObject *object = component.create();
        if (!object)
            qInfo("component errors: %s", qPrintable(component.errorString()));
        delete object;
    } else if (scenario == "crash") {
        machineInfo();
        qWarning("a warning just before the crash");
        volatile int *nowhere = nullptr;
        *nowhere = 42;
    } else if (scenario == "fatal") {
        machineInfo();
        qFatal("a fatal error for the test, token=abc123");
    } else if (scenario == "offline") {
        qCritical("an error made while Sentry was unreachable");
        QThread::msleep(300);
    } else if (scenario == "idle") {
        // Sends what the previous runs left (crash reports, the retry queue) at start.
        QThread::msleep(700);
    }
    dialsentry::stop();
    return 0;
}

QString messageOf(const QJsonObject &event)
{
    const QJsonValue message = event.value(QStringLiteral("message"));
    if (message.isObject()) {
        const QJsonObject o = message.toObject();
        return o.value(QStringLiteral("formatted")).toString(o.value(QStringLiteral("message")).toString());
    }
    return message.toString();
}

QJsonArray breadcrumbsOf(const QJsonObject &event)
{
    const QJsonValue crumbs = event.value(QStringLiteral("breadcrumbs"));
    return crumbs.isObject() ? crumbs.toObject().value(QStringLiteral("values")).toArray() : crumbs.toArray();
}

bool hasBreadcrumb(const QJsonObject &event, const QString &message, const QString &level)
{
    for (const QJsonValue &crumb : breadcrumbsOf(event)) {
        const QJsonObject c = crumb.toObject();
        if (c.value(QStringLiteral("message")).toString() == message && c.value(QStringLiteral("level")).toString() == level)
            return true;
    }
    return false;
}

QJsonObject eventWithMessage(const QVector<QJsonObject> &events, const QString &prefix)
{
    for (const QJsonObject &e : events) {
        if (messageOf(e).startsWith(prefix))
            return e;
    }
    return QJsonObject();
}

QJsonObject exceptionOf(const QJsonObject &event)
{
    const QJsonValue exception = event.value(QStringLiteral("exception"));
    const QJsonArray values = exception.isObject() ? exception.toObject().value(QStringLiteral("values")).toArray()
                                                   : exception.toArray();
    return values.isEmpty() ? QJsonObject() : values.first().toObject();
}

QString tag(const QJsonObject &event, const QString &key)
{
    return event.value(QStringLiteral("tags")).toObject().value(key).toString();
}

} // namespace

class TestSentryReporter : public QObject
{
    Q_OBJECT

    struct Run {
        int exitCode = -1;
        QProcess::ExitStatus status = QProcess::NormalExit;
        QByteArray output;
    };

    FakeSentry m_sentry;
    QTemporaryDir m_tmp;
    int m_databases = 0;

    QString newDatabase() { return m_tmp.filePath(QStringLiteral("db%1").arg(++m_databases)); }

    Run runChild(const QByteArray &scenario, const QString &database, const QString &dsn,
                 const QHash<QString, QString> &env = QHash<QString, QString>())
    {
        QProcess process;
        QProcessEnvironment environment = QProcessEnvironment::systemEnvironment();
        environment.remove(QStringLiteral("DIAL_EXTERNAL_SERVICES"));
        environment.remove(QStringLiteral("DIAL_SENTRY_DSN"));
        if (!dsn.isNull())
            environment.insert(QStringLiteral("DIAL_SENTRY_DSN"), dsn);
        environment.insert(QStringLiteral("DIAL_SENTRY_DATABASE"), database);
        environment.insert(QStringLiteral("DIAL_SENTRY_DEBUG"), QStringLiteral("1"));
        environment.insert(QStringLiteral("QT_QPA_PLATFORM"), QStringLiteral("offscreen"));
        for (auto it = env.cbegin(); it != env.cend(); ++it)
            environment.insert(it.key(), it.value());
        process.setProcessEnvironment(environment);
        process.setProcessChannelMode(QProcess::MergedChannels);
        process.start(QCoreApplication::applicationFilePath(), {QStringLiteral("--child"), QString::fromLatin1(scenario)});
        if (!process.waitForFinished(60000))
            process.kill();
        Run run;
        run.exitCode = process.exitCode();
        run.status = process.exitStatus();
        run.output = process.readAll();
        return run;
    }

    static QStringList cacheFiles(const QString &database)
    {
        return QDir(database + QStringLiteral("/cache")).entryList({QStringLiteral("*.envelope")}, QDir::Files);
    }

private slots:
    void initTestCase()
    {
        QVERIFY(m_tmp.isValid());
        QVERIFY(m_sentry.start());
    }

    void init() { m_sentry.clear(); }

    // (a)
    void offWithoutExternalServices()
    {
        const QList<QHash<QString, QString>> cases{
            {},
            {{QStringLiteral("DIAL_EXTERNAL_SERVICES"), QStringLiteral("0")}},
            {{QStringLiteral("DIAL_SENTRY_DSN"), QStringLiteral("https://0123456789abcdef@sentry.example.invalid/8")}},
            {{QStringLiteral("DIAL_SENTRY_DSN"), QString()}},
        };
        for (const auto &env : cases) {
            const QString db = newDatabase();
            const Run run = runChild("disabled", db, QString(), env);
            QVERIFY2(run.exitCode == 0 && run.status == QProcess::NormalExit, run.output.constData());
            QVERIFY2(run.output.contains("enabled=0 initialised=0"), run.output.constData());
            QVERIFY2(run.output.contains("sentry: off"), run.output.constData());
            QVERIFY2(!QDir(db).exists(), "the database was created");
        }
        QThread::msleep(300);
        QCOMPARE(m_sentry.requests(), 0);
    }

    // (b)
    void errorsBecomeEventsWithTheTags()
    {
        const Run run = runChild("log", newDatabase(), m_sentry.dsn());
        QVERIFY2(run.exitCode == 0, run.output.constData());
        QVERIFY2(m_sentry.waitForEvents(3, 10000), run.output.constData());
        QThread::msleep(300);
        const QVector<QJsonObject> events = m_sentry.events();
        QCOMPARE(events.size(), 3);   // the error, the repeated error once, the TypeError

        const QJsonObject error = eventWithMessage(events, QStringLiteral("a critical error"));
        QVERIFY(!error.isEmpty());
        QCOMPARE(messageOf(error), QStringLiteral("a critical error for [email] on [machine]"));
        QCOMPARE(error.value(QStringLiteral("level")).toString(), QStringLiteral("error"));
        QCOMPARE(error.value(QStringLiteral("release")).toString(), QStringLiteral("meticulous-dial-qt@9.9.9-test"));
        QCOMPARE(error.value(QStringLiteral("dist")).toString(), QStringLiteral("42.gtest"));
        QCOMPARE(error.value(QStringLiteral("environment")).toString(), QStringLiteral("production"));
        QCOMPARE(tag(error, QStringLiteral("serial")), QStringLiteral("SER-0042"));
        QCOMPARE(tag(error, QStringLiteral("build-version")), QStringLiteral("2026.10.1"));
        QCOMPARE(tag(error, QStringLiteral("build-channel")), QStringLiteral("beta"));
        QCOMPARE(tag(error, QStringLiteral("dial-version")), QStringLiteral("9.9.9-test"));
        QCOMPARE(tag(error, QStringLiteral("dial-runtime")), QStringLiteral("qt"));
        QCOMPARE(tag(error, QStringLiteral("log-source")), QStringLiteral("native"));
        QVERIFY(!error.contains(QStringLiteral("user")));
        QVERIFY(!error.contains(QStringLiteral("server_name")));
        // The warning before it, as a breadcrumb, cleaned.
        QVERIFY2(hasBreadcrumb(error, QStringLiteral("a warning before the error, password=[Filtered] from [ip]"),
                               QStringLiteral("warning")),
                 QJsonDocument(QJsonArray(breadcrumbsOf(error))).toJson().constData());

        int repeated = 0;
        for (const QJsonObject &e : events)
            repeated += messageOf(e).startsWith(QLatin1String("a repeated critical error")) ? 1 : 0;
        QCOMPARE(repeated, 1);

        QJsonObject typeError;
        for (const QJsonObject &e : events) {
            if (exceptionOf(e).value(QStringLiteral("type")).toString() == QLatin1String("TypeError"))
                typeError = e;
        }
        QVERIFY(!typeError.isEmpty());
        const QJsonObject exception = exceptionOf(typeError);
        QCOMPARE(exception.value(QStringLiteral("value")).toString(), QStringLiteral("Cannot read property 'x' of null"));
        const QJsonObject frame = exception.value(QStringLiteral("stacktrace")).toObject().value(QStringLiteral("frames"))
                                      .toArray().first().toObject();
        QCOMPARE(frame.value(QStringLiteral("filename")).toString(), QStringLiteral("Dial/screens/brew/Barometer.qml"));
        QCOMPARE(frame.value(QStringLiteral("lineno")).toInt(), 42);

        // Nothing personal anywhere in what was sent.
        for (const SentryEnvelope &envelope : m_sentry.envelopes()) {
            QVERIFY(envelope.target.startsWith("/api/8/envelope/"));
            for (const char *secret : {"hunter2", "192.168.1.20", "alu@example.com", "Alu Kitchen Machine"})
                QVERIFY2(!envelope.body.contains(secret), secret);
        }
    }

    void qmlErrorsAndTheBridge()
    {
        const Run run = runChild("qml", newDatabase(), m_sentry.dsn());
        QVERIFY2(run.exitCode == 0, run.output.constData());
        QVERIFY2(m_sentry.waitForEvents(3, 10000), run.output.constData());
        QThread::msleep(300);
        const QVector<QJsonObject> events = m_sentry.events();
        QCOMPARE(events.size(), 3);

        const QJsonObject slowdown = eventWithMessage(events, QStringLiteral("Dial UI sustained slowdown"));
        QVERIFY(!slowdown.isEmpty());
        QCOMPARE(slowdown.value(QStringLiteral("level")).toString(), QStringLiteral("warning"));
        QCOMPARE(slowdown.value(QStringLiteral("fingerprint")).toArray().first().toString(),
                 QStringLiteral("dial-ui-sustained-slowdown"));
        QCOMPARE(tag(slowdown, QStringLiteral("slowdown-report-kind")), QStringLiteral("sustained"));
        QVERIFY(!slowdown.value(QStringLiteral("tags")).toObject().contains(QStringLiteral("hostname")));
        QCOMPARE(tag(slowdown, QStringLiteral("serial")), QStringLiteral("4242"));
        const QJsonObject contexts = slowdown.value(QStringLiteral("contexts")).toObject();
        QCOMPARE(contexts.value(QStringLiteral("dial_performance")).toObject().value(QStringLiteral("observed_fps")).toDouble(),
                 12.5);
        QVERIFY(!contexts.value(QStringLiteral("wifi")).toObject().contains(QStringLiteral("ssid")));
        QCOMPARE(contexts.value(QStringLiteral("wifi")).toObject().value(QStringLiteral("signal")).toInt(), 70);

        const QJsonObject consoleError = eventWithMessage(events, QStringLiteral("a QML console error"));
        QVERIFY2(!consoleError.isEmpty(), run.output.constData());
        QCOMPARE(messageOf(consoleError), QStringLiteral("a QML console error on [machine]"));
        QCOMPARE(tag(consoleError, QStringLiteral("log-source")), QStringLiteral("qml"));
        QCOMPARE(tag(consoleError, QStringLiteral("build-version")), QStringLiteral("2026.10.2"));
        QCOMPARE(tag(consoleError, QStringLiteral("build-channel")), QStringLiteral("stable"));
        QVERIFY(hasBreadcrumb(consoleError, QStringLiteral("a QML warning before the error"), QStringLiteral("warning")));
        const QJsonObject qt = consoleError.value(QStringLiteral("extra")).toObject().value(QStringLiteral("qt_message")).toObject();
        QCOMPARE(qt.value(QStringLiteral("file")).toString(), QStringLiteral("Dial/screens/test/SentryTest.qml"));

        QJsonObject typeError;
        for (const QJsonObject &e : events) {
            if (exceptionOf(e).value(QStringLiteral("type")).toString() == QLatin1String("TypeError"))
                typeError = e;
        }
        QVERIFY2(!typeError.isEmpty(), run.output.constData());
        const QJsonObject frame = exceptionOf(typeError).value(QStringLiteral("stacktrace")).toObject()
                                      .value(QStringLiteral("frames")).toArray().first().toObject();
        QCOMPARE(frame.value(QStringLiteral("filename")).toString(), QStringLiteral("Dial/screens/test/SentryTest.qml"));
        for (const SentryEnvelope &envelope : m_sentry.envelopes()) {
            QVERIFY(!envelope.body.contains("kitchen-dial"));
            QVERIFY(!envelope.body.contains("\"Home\""));
        }
    }

    void floodsAreCappedAcrossRestarts()
    {
        const QString db = newDatabase();
        Run run = runChild("cap", db, m_sentry.dsn());
        QVERIFY2(run.exitCode == 0, run.output.constData());
        QVERIFY(m_sentry.waitForEvents(10, 10000));
        QThread::msleep(500);
        QCOMPARE(m_sentry.events().size(), 10);
        QVERIFY2(run.output.contains("sentry: event limit reached"), run.output.constData());
        QVERIFY(QFile::exists(db + QStringLiteral("/dial-rate-limits.json")));
        // A restart does not reset the window.
        m_sentry.clear();
        run = runChild("cap", db, m_sentry.dsn());
        QVERIFY2(run.exitCode == 0, run.output.constData());
        QThread::msleep(500);
        QCOMPARE(m_sentry.events().size(), 0);
    }

    // (c)
    void aCrashIsSentOnTheNextStart()
    {
        const QString db = newDatabase();
        Run run = runChild("crash", db, m_sentry.dsn());
        QCOMPARE(run.status, QProcess::CrashExit);
        QThread::msleep(300);
        QCOMPARE(m_sentry.events().size(), 0);   // breakpad writes it; nothing is sent from a crashing process
        run = runChild("idle", db, m_sentry.dsn());
        QVERIFY2(run.exitCode == 0, run.output.constData());
        QVERIFY2(m_sentry.waitForEvents(1, 10000), run.output.constData());
        const SentryEnvelope envelope = m_sentry.envelopes().first();
        const QJsonObject event = envelope.event();
        QCOMPARE(event.value(QStringLiteral("level")).toString(), QStringLiteral("fatal"));
        QCOMPARE(tag(event, QStringLiteral("serial")), QStringLiteral("SER-0042"));
        QCOMPARE(event.value(QStringLiteral("release")).toString(), QStringLiteral("meticulous-dial-qt@9.9.9-test"));
        QVERIFY(!event.contains(QStringLiteral("user")));
        QVERIFY(hasBreadcrumb(event, QStringLiteral("a warning just before the crash"), QStringLiteral("warning")));
        const SentryItem *minidump = envelope.minidump();
        QVERIFY(minidump);
        QVERIFY(minidump->payload.startsWith("MDMP"));
        QVERIFY(minidump->payload.size() > 4096);
        qInfo("crash report: %lld bytes of minidump", qlonglong(minidump->payload.size()));
    }

    void aFatalMessageRidesOnTheCrashReport()
    {
        const QString db = newDatabase();
        Run run = runChild("fatal", db, m_sentry.dsn());
        QCOMPARE(run.status, QProcess::CrashExit);
        run = runChild("idle", db, m_sentry.dsn());
        QVERIFY2(m_sentry.waitForEvents(1, 10000), run.output.constData());
        const SentryEnvelope envelope = m_sentry.envelopes().first();
        QVERIFY(envelope.minidump());
        const QJsonObject fatal = envelope.event().value(QStringLiteral("contexts")).toObject()
                                      .value(QStringLiteral("qt_fatal")).toObject();
        QCOMPARE(fatal.value(QStringLiteral("message")).toString(), QStringLiteral("a fatal error for the test, token=[Filtered]"));
        QVERIFY(hasBreadcrumb(envelope.event(), QStringLiteral("a fatal error for the test, token=[Filtered]"),
                              QStringLiteral("fatal")));
    }

    void aCrashLoopIsCapped()
    {
        const QString db = newDatabase();
        QByteArray outputs;
        for (int i = 0; i < 5; ++i) {
            const Run run = runChild("crash", db, m_sentry.dsn());
            QCOMPARE(run.status, QProcess::CrashExit);
            outputs += run.output;
        }
        const Run run = runChild("idle", db, m_sentry.dsn());
        QVERIFY2(run.exitCode == 0, run.output.constData());
        QThread::msleep(500);
        int crashes = 0;
        for (const SentryEnvelope &envelope : m_sentry.envelopes())
            crashes += envelope.minidump() ? 1 : 0;
        QCOMPARE(crashes, 3);
        QVERIFY(outputs.contains("crash reports paused"));
    }

    // (d)
    void anEventMadeOfflineIsSentLater()
    {
        const QString db = newDatabase();
        const QString dsn = m_sentry.dsn();
        m_sentry.stop();
        Run run = runChild("offline", db, dsn);
        QVERIFY2(run.exitCode == 0, run.output.constData());
        QCOMPARE(m_sentry.requests(), 0);
        const QStringList waiting = cacheFiles(db);
        QCOMPARE(waiting.size(), 1);
        QVERIFY2(waiting.first().contains(QLatin1String("-00-")), qPrintable(waiting.first()));

        QVERIFY(m_sentry.start());
        run = runChild("idle", db, dsn);
        QVERIFY2(m_sentry.waitForEvents(1, 10000), run.output.constData());
        QCOMPARE(messageOf(m_sentry.events().first()), QStringLiteral("an error made while Sentry was unreachable"));
        QVERIFY(cacheFiles(db).isEmpty());
    }

    void anEventWhoseRetriesRanOutIsSentLater()
    {
        const QString db = newDatabase();
        const QString dsn = m_sentry.dsn();
        m_sentry.stop();
        Run run = runChild("offline", db, dsn);
        QVERIFY2(run.exitCode == 0, run.output.constData());
        // Every start retries once (sentry-native: 6 tries); then the envelope rests in the cache.
        for (int i = 0; i < 6; ++i) {
            run = runChild("idle", db, dsn);
            QVERIFY2(run.exitCode == 0, run.output.constData());
        }
        const QStringList resting = cacheFiles(db);
        QCOMPARE(resting.size(), 1);
        QVERIFY2(QRegularExpression(QStringLiteral("^[0-9a-f-]{36}\\.envelope$")).match(resting.first()).hasMatch(),
                 qPrintable(resting.first()));

        QVERIFY(m_sentry.start());
        run = runChild("idle", db, dsn);
        QVERIFY2(run.output.contains("1 cached envelope(s) rearmed"), run.output.constData());
        QVERIFY2(m_sentry.waitForEvents(1, 10000), run.output.constData());
        QCOMPARE(messageOf(m_sentry.events().first()), QStringLiteral("an error made while Sentry was unreachable"));
    }
};

int main(int argc, char **argv)
{
    if (argc >= 3 && qstrcmp(argv[1], "--child") == 0)
        return child(QByteArray(argv[2]), argc, argv);
    QCoreApplication app(argc, argv);
    TestSentryReporter test;
    return QTest::qExec(&test, argc, argv);
}

#include "tst_sentry_reporter.moc"
