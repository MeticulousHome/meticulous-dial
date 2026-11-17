// The Qt side of the Community contract test (see ../run.sh and ../contract.py).
//
// Runs the Qt Dial's Community uploader as the Dial does (main.cpp: `new Community(apiUrl)`, whose worker
// thread starts at once; QML calls its methods) on $CONFIG_PATH/community-upload with COMMUNITY_API_BASE
// and MACHINE_API_BASE. Same line protocol as the Rust driver (../rust/src/main.rs): one command per line
// on stdin, one "@@ <json>" answer per command on stdout ({"ok": value} or {"error": message}); the
// uploader's log lines go to stderr as "LOG <level> <message>".
//
//   status | enroll <json string or null> | pause <true|false> | disconnect | reset | scan | quit

#include "community.h"

#include <QCoreApplication>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonValue>
#include <QQueue>

#include <cstdio>
#include <iostream>
#include <string>
#include <thread>

namespace {

void reply(const QJsonObject &answer)
{
    const QByteArray line = "@@ " + QJsonDocument(answer).toJson(QJsonDocument::Compact) + "\n";
    std::fwrite(line.constData(), 1, size_t(line.size()), stdout);
    std::fflush(stdout);
}

QJsonObject result(const QString &error)
{
    if (error.isEmpty())
        return {{QStringLiteral("ok"), QJsonValue::Null}};
    return {{QStringLiteral("error"), error}};
}

void logHandler(QtMsgType type, const QMessageLogContext &, const QString &message)
{
    const char *level = "debug";
    switch (type) {
    case QtInfoMsg: level = "info"; break;
    case QtWarningMsg: level = "warn"; break;
    case QtCriticalMsg: level = "error"; break;
    case QtFatalMsg: level = "fatal"; break;
    case QtDebugMsg: level = "debug"; break;
    }
    std::fprintf(stderr, "LOG %s %s\n", level, qUtf8Printable(message));
    std::fflush(stderr);
}

// Runs the commands one at a time, in order; an asynchronous one (a QML call answered by a signal)
// finishes before the next starts, as the orchestrator waits for every answer.
class Driver : public QObject
{
public:
    explicit Driver(Community *community) : m_community(community)
    {
        connect(community, &Community::enrollmentResult, this, [this](const QVariantMap &value) {
            if (value.contains(QStringLiteral("error")))
                finish({{QStringLiteral("error"), value.value(QStringLiteral("error")).toString()}});
            else
                finish({{QStringLiteral("ok"), QJsonObject::fromVariantMap(value)}});
        });
        connect(community, &Community::operationFinished, this,
                [this](const QString &, const QString &error) { finish(result(error)); });
    }

    void enqueue(const QString &line)
    {
        m_lines.enqueue(line);
        next();
    }

private:
    void next()
    {
        if (m_busy || m_lines.isEmpty())
            return;
        const QString line = m_lines.dequeue();
        const int space = line.indexOf(QLatin1Char(' '));
        const QString command = space < 0 ? line : line.left(space);
        const QString argument = space < 0 ? QString() : line.mid(space + 1);
        m_busy = true;
        if (command == QLatin1String("status")) {
            finish({{QStringLiteral("ok"), QJsonObject::fromVariantMap(m_community->status())}});
        } else if (command == QLatin1String("enroll")) {
            // QML: uploader.beginEnrollment(serial or ""), "" = none (React: machineSerial || null).
            const QJsonValue serial = QJsonDocument::fromJson("[" + argument.toUtf8() + "]").array().at(0);
            m_community->beginEnrollment(serial.isString() ? serial.toString() : QString());
        } else if (command == QLatin1String("pause")) {
            m_community->setUploadPaused(argument == QLatin1String("true"));
        } else if (command == QLatin1String("disconnect")) {
            m_community->disconnect();
        } else if (command == QLatin1String("reset")) {
            finish(result(m_community->factoryResetLocal()));
        } else if (command == QLatin1String("scan")) {
            finish(result(m_community->scanHistory()));
        } else if (command == QLatin1String("quit")) {
            reply({{QStringLiteral("ok"), QJsonValue::Null}});
            QCoreApplication::quit();
        } else {
            finish({{QStringLiteral("error"), QStringLiteral("unknown command ") + command}});
        }
    }

    void finish(const QJsonObject &answer)
    {
        reply(answer);
        m_busy = false;
        QMetaObject::invokeMethod(this, [this] { next(); }, Qt::QueuedConnection);
    }

    Community *m_community;
    QQueue<QString> m_lines;
    bool m_busy = false;
};

}   // namespace

int main(int argc, char **argv)
{
    // Never the production server: the contract test always points both bases at its local fakes.
    for (const char *name : {"COMMUNITY_API_BASE", "MACHINE_API_BASE"}) {
        if (!qEnvironmentVariable(name).startsWith(QLatin1String("http://127.0.0.1:"))) {
            std::fprintf(stderr, "%s must point at the local fake server (got \"%s\")\n", name,
                         qPrintable(qEnvironmentVariable(name)));
            return 2;
        }
    }
    qInstallMessageHandler(logHandler);
    QCoreApplication app(argc, argv);

    // main.cpp: new Community(options.apiUrl, &app); MACHINE_API_BASE is set, so the API URL is unused.
    Community community{QUrl()};
    Driver driver(&community);
    reply({{QStringLiteral("ready"), true}});

    std::thread([&driver] {
        std::string line;
        while (std::getline(std::cin, line)) {
            const QString text = QString::fromStdString(line);
            QMetaObject::invokeMethod(&driver, [&driver, text] { driver.enqueue(text); }, Qt::QueuedConnection);
        }
    }).detach();

    return app.exec();
}
