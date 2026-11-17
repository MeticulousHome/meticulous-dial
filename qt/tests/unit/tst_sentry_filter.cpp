// The pure rules of the Qt Dial's Sentry reports (src/sentry): when Sentry is on at all, which Qt messages
// become events or breadcrumbs, the React sanitizer's keys (src/sentryPrivacy.ts) and the message cleaning,
// the rate limits, and the frame windows of the slowdown monitor. No network, no sentry_init.

#include "sentry/framemonitor.h"
#include "sentry/logfilter.h"
#include "sentry/sentryreporter.h"

#include <QHash>
#include <QTest>

using namespace dialsentry;

namespace {

Config configFor(const QHash<QString, QString> &vars)
{
    return resolveConfig([&vars](const char *name) -> std::optional<QString> {
        const auto it = vars.constFind(QString::fromLatin1(name));
        if (it == vars.cend())
            return std::nullopt;
        return it.value();
    });
}

// Plays frames and the heartbeat timer as FrameMonitor does, with the GUI thread blocked during `stalls`
// (a timer due inside a stall fires when it ends).
struct FrameSim {
    FrameWindowCollector collector;
    QVector<FrameWindowCollector::Window> windows;
    bool armed = false;
    double due = 0;
    QVector<QPair<double, double>> stalls;
    int heartbeats = 0;

    double fireTime(double t) const
    {
        for (const auto &stall : stalls) {
            if (t >= stall.first && t < stall.second)
                return stall.second;
        }
        return t;
    }
    void runUntil(double t)
    {
        while (armed && fireTime(due) <= t) {
            const double at = fireTime(due);
            ++heartbeats;
            if (collector.heartbeat(at))
                due = collector.nextHeartbeatAt();
            else
                armed = false;
        }
    }
    void frame(double t)
    {
        runUntil(t);
        const bool wasRunning = collector.heartbeatRunning();
        FrameWindowCollector::Window window;
        if (collector.frame(t, &window))
            windows.append(window);
        if (!wasRunning && collector.heartbeatRunning()) {
            armed = true;
            due = collector.nextHeartbeatAt();
        }
    }
    // Frames every `step` ms from `from` to `to`; returns the time after the last one.
    double animate(double from, double to, double step = 1000.0 / 60.0)
    {
        double t = from;
        for (; t < to; t += step)
            frame(t);
        return t;
    }
};

} // namespace

class TestSentryFilter : public QObject
{
    Q_OBJECT

private slots:
    void configIsOffWithoutExternalServices()
    {
        Config c = configFor({});
        QVERIFY(!c.enabled);
        QVERIFY(c.reason.contains(QLatin1String("external services are off")));

        c = configFor({{QStringLiteral("DIAL_EXTERNAL_SERVICES"), QStringLiteral("0")}});
        QVERIFY(!c.enabled);
        c = configFor({{QStringLiteral("DIAL_EXTERNAL_SERVICES"), QStringLiteral("true")}});
        QVERIFY(!c.enabled);
        // An override is honoured only when it points to this machine.
        c = configFor({{QStringLiteral("DIAL_SENTRY_DSN"), QStringLiteral("https://key@sentry.example.com/8")}});
        QVERIFY(!c.enabled);
        c = configFor({{QStringLiteral("DIAL_SENTRY_DSN"), QStringLiteral("http://key@127.0.0.1.example.com/8")}});
        QVERIFY(!c.enabled);
        c = configFor({{QStringLiteral("DIAL_SENTRY_DSN"), QString::fromLatin1(kDefaultDsn)}});
        QVERIFY(!c.enabled);
        // Empty: off even on the machine.
        c = configFor({{QStringLiteral("DIAL_EXTERNAL_SERVICES"), QStringLiteral("1")},
                       {QStringLiteral("DIAL_SENTRY_DSN"), QString()}});
        QVERIFY(!c.enabled);
    }

    void configOnTheMachineUsesTheReactDsn()
    {
        const Config c = configFor({{QStringLiteral("DIAL_EXTERNAL_SERVICES"), QStringLiteral("1")},
                                    {QStringLiteral("XDG_CACHE_HOME"), QStringLiteral("/meticulous-user/.cache")}});
        QVERIFY(c.enabled);
        QCOMPARE(c.dsn, QStringLiteral("https://d958eb514629903cf133ad2b19e80ead@sentry.meticulousespresso.com/8"));
        QCOMPARE(c.databasePath, QStringLiteral("/meticulous-user/.cache/meticulous-dial-qt/sentry"));
        QVERIFY(!c.localOverride);
        // A non-local override on the machine is ignored, not followed.
        const Config ignored = configFor({{QStringLiteral("DIAL_EXTERNAL_SERVICES"), QStringLiteral("1")},
                                          {QStringLiteral("DIAL_SENTRY_DSN"), QStringLiteral("https://k@other.example.com/1")},
                                          {QStringLiteral("HOME"), QStringLiteral("/root")}});
        QVERIFY(ignored.enabled);
        QCOMPARE(ignored.dsn, QString::fromLatin1(kDefaultDsn));
        QCOMPARE(ignored.databasePath, QStringLiteral("/root/.cache/meticulous-dial-qt/sentry"));
    }

    void configHonoursALocalTestDsn()
    {
        for (const QString &dsn : {QStringLiteral("http://key@127.0.0.1:9123/8"), QStringLiteral("http://key@localhost:9/8"),
                                   QStringLiteral("http://key@[::1]:9/8")}) {
            const Config c = configFor({{QStringLiteral("DIAL_SENTRY_DSN"), dsn},
                                        {QStringLiteral("DIAL_SENTRY_DATABASE"), QStringLiteral("/tmp/db")}});
            QVERIFY2(c.enabled, qPrintable(dsn));
            QVERIFY(c.localOverride);
            QCOMPARE(c.dsn, dsn);
            QCOMPARE(c.databasePath, QStringLiteral("/tmp/db"));
        }
    }

    void classifiesMessages()
    {
        QCOMPARE(classify(QtDebugMsg, QStringLiteral("x")).kind, Kind::Ignore);
        QCOMPARE(classify(QtInfoMsg, QStringLiteral("stop requested: quitting")).kind, Kind::Ignore);
        QCOMPARE(classify(QtWarningMsg, QStringLiteral("Binding loop detected for property \"width\"")).kind,
                 Kind::Breadcrumb);
        QCOMPARE(classify(QtWarningMsg, QStringLiteral("QOpenGLShader: ERROR: 0:1: syntax")).kind, Kind::Breadcrumb);
        const Classification critical = classify(QtCriticalMsg, QStringLiteral("Error fetching device Info: timeout"));
        QCOMPARE(critical.kind, Kind::Event);
        QCOMPARE(QByteArray(critical.level), QByteArray("error"));
        QVERIFY(!critical.exception);
        QCOMPARE(classify(QtFatalMsg, QStringLiteral("boom")).kind, Kind::Fatal);

        const Classification typeError = classify(QtWarningMsg,
            QStringLiteral("file:///usr/share/meticulous-dial-qt/qml/Dial/screens/brew/Barometer.qml:42: "
                           "TypeError: Cannot read property 'x' of null"));
        QCOMPARE(typeError.kind, Kind::Event);
        QVERIFY(typeError.exception);
        QCOMPARE(typeError.exceptionType, QStringLiteral("TypeError"));
        QCOMPARE(typeError.exceptionValue, QStringLiteral("Cannot read property 'x' of null"));
        QCOMPARE(typeError.file, QStringLiteral("Dial/screens/brew/Barometer.qml"));
        QCOMPARE(typeError.line, 42);

        const Classification reference = classify(QtWarningMsg,
            QStringLiteral("file:///repo/qt/qml/main.qml:7:5: ReferenceError: foo is not defined"));
        QVERIFY(reference.exception);
        QCOMPARE(reference.exceptionType, QStringLiteral("ReferenceError"));
        QCOMPARE(reference.file, QStringLiteral("main.qml"));
        QCOMPARE(reference.line, 7);

        const Classification thrown = classify(QtWarningMsg,
            QStringLiteral("file:///x/qml/Dial/Core/Api.qml:10: Error: request failed"));
        QVERIFY(thrown.exception);
        QCOMPARE(thrown.exceptionType, QStringLiteral("Error"));

        // Warnings that only carry an error by name are events, as messages.
        const Classification named = classify(QtWarningMsg, QStringLiteral("Could not read history: Error: timeout"));
        QCOMPARE(named.kind, Kind::Event);
        QVERIFY(!named.exception);
        QCOMPARE(classify(QtWarningMsg, QStringLiteral("unexpected RangeError in parser")).kind, Kind::Event);
    }

    void sensitiveKeysAreReacts()
    {
        for (const char *key : {"password", "Password", "wifi-password", "root_password", "ip", "client_ip", "IP Address",
                                "ssid", "known_ssid_list", "apName", "knownWifis", "machine_name", "email", "user_email",
                                "username", "api-key", " token ", "authorization", "cookie", "hostname", "remote_addr"})
            QVERIFY2(isSensitiveKey(key), key);
        for (const char *key : {"zip", "description", "tip", "tokens", "serial", "build-version", "screen", "ipv4ish",
                                "skip", "name"})
            QVERIFY2(!isSensitiveKey(key), key);
        QVERIFY(isDroppedTag("machine"));
        QVERIFY(isDroppedTag("Machine-Name"));
        QVERIFY(isDroppedTag("hostname"));
        QVERIFY(!isDroppedTag("serial"));
        QVERIFY(!isDroppedTag("dial-version"));
        QVERIFY(!isSensitiveKey(static_cast<const char *>(nullptr)));
    }

    void sanitizesMessages_data()
    {
        QTest::addColumn<QString>("input");
        QTest::addColumn<QString>("expected");
        QTest::newRow("key=value") << "password=hunter2 ok" << "password=[Filtered] ok";
        QTest::newRow("key: value") << "Connecting with ssid: MyNet now" << "Connecting with ssid: [Filtered] now";
        QTest::newRow("json") << R"({"ssid":"Home WiFi","signal":5,"root_password":"x"})"
                              << R"({"ssid":"[Filtered]","signal":5,"root_password":"[Filtered]"})";
        QTest::newRow("query") << "GET /api?token=abc123&page=2" << "GET /api?token=[Filtered]&page=2";
        QTest::newRow("url credentials") << "fetch http://alu:secret@10.0.0.2/x" << "fetch http://[Filtered]@[ip]/x";
        QTest::newRow("bearer") << "header Bearer abcdefghijklmnop sent" << "header Bearer [Filtered] sent";
        QTest::newRow("email") << "contact alu@example.com please" << "contact [email] please";
        QTest::newRow("ipv4") << "from 192.168.1.20 and 127.0.0.1:8080" << "from [ip] and 127.0.0.1:8080";
        QTest::newRow("version") << "version 1.105.1 and 6.4.2" << "version 1.105.1 and 6.4.2";
        QTest::newRow("ipv6") << "addr fe80::1c2b:3cff:fe4d:5e6f%wlan0" << "addr [ip]%wlan0";
        QTest::newRow("loopback v6") << "listening on ::1 port 9" << "listening on ::1 port 9";
        QTest::newRow("c++") << "QQuickItem::update and std::string, a::b" << "QQuickItem::update and std::string, a::b";
        QTest::newRow("time") << "at 12:30:45 today" << "at 12:30:45 today";
        QTest::newRow("mac") << "station aa:bb:cc:dd:ee:0f joined" << "station [mac] joined";
        QTest::newRow("mdns") << "reach alus-machine.local:8080" << "reach [host].local:8080";
        QTest::newRow("plain") << "Route not found: profileHome" << "Route not found: profileHome";
    }

    void sanitizesMessages()
    {
        QFETCH(QString, input);
        QFETCH(QString, expected);
        QCOMPARE(Sanitizer().sanitize(input), expected);
    }

    void sanitizesTheMachinesName()
    {
        Sanitizer s;
        s.setMachineStrings({QStringLiteral("Alu's Kitchen"), QStringLiteral("alus-kitchen"), QStringLiteral("Meticulous"),
                             QStringLiteral("ab")});
        QCOMPARE(s.sanitize(QStringLiteral("Alu's Kitchen is ready on ALUS-KITCHEN")),
                 QStringLiteral("[machine] is ready on [machine]"));
        // Generic names and very short ones are left alone (they appear in the Dial's own paths).
        QCOMPARE(s.sanitize(QStringLiteral("/usr/share/meticulous-dial-qt/qml about")),
                 QStringLiteral("/usr/share/meticulous-dial-qt/qml about"));
    }

    void sanitizedMessagesAreCapped()
    {
        const QString out = Sanitizer().sanitize(QString(10000, QLatin1Char('x')));
        QCOMPARE(out.size(), Sanitizer::maxLength);
    }

    void normalizesRepeats()
    {
        QCOMPARE(normalizedKey(QStringLiteral("retry 3 in 500 ms")), normalizedKey(QStringLiteral("retry 4 in 1000 ms")));
        QCOMPARE(normalizedKey(QStringLiteral("id 1b4e28ba-2fa1-11d2-883f-0016d3cca427 failed")),
                 normalizedKey(QStringLiteral("id 9c4e28ba-2fa1-11d2-883f-0016d3cca999 failed")));
        QVERIFY(normalizedKey(QStringLiteral("profile abc")) != normalizedKey(QStringLiteral("profile abd")));
        QCOMPARE(keyHash(QStringLiteral("x")), keyHash(QStringLiteral("x")));
        QVERIFY(keyHash(QStringLiteral("x")) != keyHash(QStringLiteral("y")));
    }

    void deduplicatesEvents()
    {
        RateLimiter limiter;
        const qint64 t0 = 1'700'000'000'000;
        QVERIFY(limiter.allowEvent(1, t0).send);
        for (int i = 1; i <= 5; ++i) {
            const auto d = limiter.allowEvent(1, t0 + i * 1000);
            QVERIFY(!d.send);
            QVERIFY(d.duplicate);
        }
        // After the dedupe window the next one goes, counting the repeats it stood for.
        const auto later = limiter.allowEvent(1, t0 + limiter.limits().dedupeMs + 1);
        QVERIFY(later.send);
        QCOMPARE(later.repeated, 5);
    }

    void capsEvents()
    {
        RateLimiter limiter;
        const qint64 t0 = 1'700'000'000'000;
        int sent = 0;
        for (int i = 0; i < 15; ++i)
            sent += limiter.allowEvent(quint64(100 + i), t0 + i).send ? 1 : 0;
        QCOMPARE(sent, 10);
        QCOMPARE(limiter.droppedEvents(), 5);
        // Ten minutes later there is room again, up to 50 a day.
        qint64 t = t0 + limiter.limits().shortWindowMs + 100;
        int total = sent;
        for (int round = 0; round < 10; ++round, t += limiter.limits().shortWindowMs + 100) {
            for (int i = 0; i < 10; ++i)
                total += limiter.allowEvent(quint64(1000 + round * 100 + i), t + i).send ? 1 : 0;
        }
        QCOMPARE(total, 50);
        // Without dedupe (the slowdown monitor) only the caps apply.
        RateLimiter fresh;
        QVERIFY(fresh.allowEvent(7, t0, false).send);
        QVERIFY(fresh.allowEvent(7, t0 + 1, false).send);
    }

    void capsBreadcrumbs()
    {
        RateLimiter limiter;
        const qint64 t0 = 1'700'000'000'000;
        QVERIFY(limiter.allowBreadcrumb(1, t0));
        QVERIFY(!limiter.allowBreadcrumb(1, t0 + 100));
        QVERIFY(limiter.allowBreadcrumb(1, t0 + limiter.limits().breadcrumbDedupeMs + 1));
        int allowed = 0;
        for (int i = 0; i < 100; ++i)
            allowed += limiter.allowBreadcrumb(quint64(10 + i), t0 + 3 * 60 * 1000 + i) ? 1 : 0;
        QCOMPARE(allowed, limiter.limits().breadcrumbsPerMinute);
    }

    void capsCrashReports()
    {
        RateLimiter limiter;
        const qint64 t0 = 1'700'000'000'000;
        QVERIFY(limiter.crashReportsAllowed(t0));
        limiter.recordCrash(t0);
        limiter.recordCrash(t0 + 2000);
        QVERIFY(limiter.crashReportsAllowed(t0 + 3000));
        limiter.recordCrash(t0 + 4000);
        QVERIFY(!limiter.crashReportsAllowed(t0 + 5000));
        QVERIFY(limiter.crashReportsAllowed(t0 + 60 * 60 * 1000 + 1));
    }

    void limitsSurviveARestart()
    {
        const qint64 t0 = 1'700'000'000'000;
        RateLimiter first;
        for (int i = 0; i < 10; ++i)
            QVERIFY(first.allowEvent(quint64(i), t0 + i).send);
        first.recordCrash(t0);
        const QJsonObject saved = first.save(t0 + 100);

        RateLimiter second;
        second.load(saved, t0 + 200);
        QVERIFY(!second.allowEvent(999, t0 + 300).send);          // the 10-minute cap carried over
        QVERIFY(second.allowEvent(3, t0 + 11 * 60 * 1000).duplicate);   // the dedupe window too
        // Times in the future (a clock that went back) are dropped.
        RateLimiter third;
        third.load(saved, t0 - 24 * 60 * 60 * 1000);
        QVERIFY(third.allowEvent(999, t0 - 24 * 60 * 60 * 1000).send);
    }

    void framesOfAnAnimationFillAWindow()
    {
        FrameSim sim;
        sim.animate(0, 10600);
        QCOMPARE(sim.windows.size(), 1);
        const auto &w = sim.windows.first();
        QVERIFY(w.windowMs >= 10000);
        QVERIFY(w.intervals.size() >= 595);
        QVERIFY(w.maxTimerHeartbeatDelayMs < 20);
        QCOMPARE(w.idleGaps, 0);
    }

    void sparseFramesAreIdleNotSlow()
    {
        // A screen that redraws at 10 Hz from sensor data, without an animation: no window, no timer.
        FrameSim sim;
        for (double t = 0; t < 60000; t += 100)
            sim.frame(t);
        QVERIFY(sim.windows.isEmpty());
        QCOMPARE(sim.heartbeats, 0);
        QVERIFY(!sim.collector.heartbeatRunning());
        // After an animation, 4 Hz redraws with the GUI thread free are idle gaps too.
        FrameSim after;
        double t = after.animate(0, 2000);
        for (const double end = t + 20000; t < end; t += 250)
            after.frame(t);
        t = after.animate(t, t + 9000);
        QCOMPARE(after.windows.size(), 1);
        for (double interval : after.windows.first().intervals)
            QVERIFY2(interval < 40, qPrintable(QString::number(interval)));
        QVERIFY(after.windows.first().idleGaps >= 70);
    }

    void idleTimeIsLeftOut()
    {
        FrameSim sim;
        double t = sim.animate(0, 3000);
        // A still Dial: the heartbeat stops shortly after the last frame.
        sim.runUntil(t + 1000);
        QVERIFY(!sim.armed);
        const int beatsBefore = sim.heartbeats;
        sim.runUntil(t + 5000);
        QCOMPARE(sim.heartbeats, beatsBefore);
        t = sim.animate(t + 5000, t + 5000 + 7500);
        QCOMPARE(sim.windows.size(), 1);
        double maxInterval = 0;
        for (double interval : sim.windows.first().intervals)
            maxInterval = qMax(maxInterval, interval);
        QVERIFY(maxInterval < 40);
        QCOMPARE(sim.windows.first().idleGaps, 1);
    }

    void aStallDuringAnAnimationCounts()
    {
        FrameSim sim;
        double t = sim.animate(0, 4000);
        // The GUI thread blocks for 1.5 s: no frames, the heartbeat fires late.
        sim.stalls.append({t, t + 1500});
        t = sim.animate(t + 1501, t + 9000);
        QCOMPARE(sim.windows.size(), 1);
        const auto &w = sim.windows.first();
        double maxInterval = 0;
        for (double interval : w.intervals)
            maxInterval = qMax(maxInterval, interval);
        QVERIFY2(maxInterval >= 1500, qPrintable(QString::number(maxInterval)));
        QVERIFY2(w.maxTimerHeartbeatDelayMs >= 1000, qPrintable(QString::number(w.maxTimerHeartbeatDelayMs)));
        // Shorter janks during an animation count as well (an 80 ms frame).
        FrameSim jank;
        double j = jank.animate(0, 1000);
        jank.stalls.append({j, j + 80});
        jank.animate(j + 81, 10500);
        QCOMPARE(jank.windows.size(), 1);
        bool found = false;
        for (double interval : jank.windows.first().intervals)
            found = found || interval >= 80;
        QVERIFY(found);
    }
};

QTEST_GUILESS_MAIN(TestSentryFilter)
#include "tst_sentry_filter.moc"
