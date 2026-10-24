// The Meticulous Dial in Qt Quick: the C++ host. It parses the launch options, exposes the native
// helpers (Native), the Socket.IO client (Socket) and the plot item (PlotLine) to QML as the
// `Dial.Native` module, and loads qml/main.qml.
//
// On the machine it runs straight on DRM/KMS (eglfs_kms, no Weston); see packaging/meticulous-dial-qt.sh.

#include <QCommandLineParser>
#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickWindow>
#include <QSocketNotifier>
#include <QSurfaceFormat>

#include <csignal>
#include <cstdio>
#include <sys/socket.h>
#include <unistd.h>

#include "community.h"
#include "lottieitem.h"
#include "native.h"
#include "netguard.h"
#include "plotline.h"
#include "qrcodeitem.h"
#include "socketio.h"

static void journalMessageHandler(QtMsgType type, const QMessageLogContext &context, const QString &message)
{
    // systemd reads <N> as the syslog priority of the line.
    const char *priority = "<6>";
    switch (type) {
    case QtDebugMsg: priority = "<7>"; break;
    case QtInfoMsg: priority = "<6>"; break;
    case QtWarningMsg: priority = "<4>"; break;
    case QtCriticalMsg: priority = "<3>"; break;
    case QtFatalMsg: priority = "<2>"; break;
    }
    const QByteArray text = message.toUtf8();
    if (context.category && qstrcmp(context.category, "default") != 0 && qstrcmp(context.category, "dial") != 0)
        fprintf(stderr, "%s[%s] %s\n", priority, context.category, text.constData());
    else
        fprintf(stderr, "%s%s\n", priority, text.constData());
    fflush(stderr);
}

static QString findQmlDir(const QString &requested)
{
    QStringList candidates;
    if (!requested.isEmpty())
        candidates << requested;
    if (qEnvironmentVariableIsSet("DIAL_QML_DIR"))
        candidates << qEnvironmentVariable("DIAL_QML_DIR");
    const QString appDir = QCoreApplication::applicationDirPath();
    candidates << appDir + QStringLiteral("/../share/meticulous-dial-qt/qml")
               << QStringLiteral(DIAL_QML_INSTALL_DIR)
               << appDir + QStringLiteral("/../qml")      // build tree next to the sources
               << appDir + QStringLiteral("/../../qml");
    for (const QString &dir : candidates) {
        if (QFileInfo::exists(dir + QStringLiteral("/main.qml")))
            return QDir(dir).canonicalPath();
    }
    return QString();
}

static int quitSignalFds[2] = {-1, -1};

static void onQuitSignal(int)
{
    // If the event loop is stuck, SIGALRM ends the process in 10 s rather than leaving systemd to time out.
    alarm(10);
    const char byte = 1;
    const ssize_t written = ::write(quitSignalFds[0], &byte, 1);
    (void)written;
}

// systemd stops the service with SIGTERM. eglfs's VT handler answers SIGTERM and SIGINT with _exit(1), which
// systemd counts as a failure and hands to OnFailure= (the crash reporter). Quit the event loop instead: a stop
// exits 0, and the VT handler still restores the tty when the platform integration is torn down.
// Called after QGuiApplication exists, so it replaces the handlers the platform plugin installed.
static void quitOnStopSignals(QCoreApplication &app)
{
    if (::socketpair(AF_UNIX, SOCK_STREAM, 0, quitSignalFds) != 0) {
        qWarning("socketpair failed: SIGTERM keeps Qt's default handling");
        return;
    }
    auto *notifier = new QSocketNotifier(quitSignalFds[1], QSocketNotifier::Read, &app);
    QObject::connect(notifier, &QSocketNotifier::activated, &app, [notifier] {
        notifier->setEnabled(false);
        qInfo("stop requested: quitting");
        QCoreApplication::quit();
    });
    struct sigaction action = {};
    action.sa_handler = onQuitSignal;
    sigemptyset(&action.sa_mask);
    action.sa_flags = SA_RESTART;
    sigaction(SIGTERM, &action, nullptr);
    sigaction(SIGINT, &action, nullptr);
}

int main(int argc, char *argv[])
{
    if (qEnvironmentVariableIsSet("INVOCATION_ID") || qEnvironmentVariableIsSet("JOURNAL_STREAM"))
        qInstallMessageHandler(journalMessageHandler);

    // 480x480 pixels are 480x480 pixels: no scaling from the panel's reported size.
    qputenv("QT_ENABLE_HIGHDPI_SCALING", "0");
    QGuiApplication::setHighDpiScaleFactorRoundingPolicy(Qt::HighDpiScaleFactorRoundingPolicy::Floor);

    QSurfaceFormat format = QSurfaceFormat::defaultFormat();
    format.setSwapInterval(1);
    format.setAlphaBufferSize(0);
    format.setDepthBufferSize(0);
    format.setStencilBufferSize(8);
    QSurfaceFormat::setDefaultFormat(format);

    QGuiApplication app(argc, argv);
    quitOnStopSignals(app);
    QCoreApplication::setOrganizationName(QStringLiteral("meticulous"));
    QCoreApplication::setApplicationName(QStringLiteral("meticulous-dial-qt"));
    QCoreApplication::setApplicationVersion(QStringLiteral(DIAL_QT_VERSION));

    QCommandLineParser parser;
    parser.setApplicationDescription(QStringLiteral("The Meticulous Dial (Qt Quick)"));
    parser.addHelpOption();
    parser.addVersionOption();
    QCommandLineOption apiOption(QStringLiteral("api"), QStringLiteral("Backend URL."), QStringLiteral("url"),
                                 qEnvironmentVariable("DIAL_API_URL", QStringLiteral("http://localhost:8080")));
    QCommandLineOption rotationOption(QStringLiteral("rotation"),
                                      QStringLiteral("Rotation of the picture in degrees (the panel is mounted turned)."),
                                      QStringLiteral("degrees"), qEnvironmentVariable("DIAL_ROTATION", QStringLiteral("-90")));
    QCommandLineOption qmlOption(QStringLiteral("qml-dir"), QStringLiteral("Directory with main.qml and the Dial module."),
                                 QStringLiteral("dir"));
    QCommandLineOption testPortOption(QStringLiteral("test-port"),
                                      QStringLiteral("Listen for test commands on ws://127.0.0.1:<port>."),
                                      QStringLiteral("port"), qEnvironmentVariable("DIAL_TEST_PORT", QStringLiteral("0")));
    QCommandLineOption screenOption(QStringLiteral("screen"), QStringLiteral("Screen to start on (development)."),
                                    QStringLiteral("name"));
    QCommandLineOption storageOption(QStringLiteral("storage"), QStringLiteral("Storage file."), QStringLiteral("path"),
                                     qEnvironmentVariable("DIAL_STORAGE"));
    QCommandLineOption circleOption(QStringLiteral("show-circle"), QStringLiteral("Draw the round display's outline."));
    parser.addOptions({apiOption, rotationOption, qmlOption, testPortOption, screenOption, storageOption, circleOption});
    parser.process(app);

    Native::Options options;
    options.apiUrl = QUrl(parser.value(apiOption));
    options.rotation = parser.value(rotationOption).toInt();
    options.testPort = parser.value(testPortOption).toInt();
    options.startScreen = parser.value(screenOption);
    options.storagePath = parser.value(storageOption);
    options.showCircle = parser.isSet(circleOption) || qEnvironmentVariableIsSet("DIAL_SHOW_CIRCLE");

    auto *native = new Native(options, &app);
    auto *socket = new SocketIO(&app);
    socket->setUrl(options.apiUrl);

    qmlRegisterSingletonInstance("Dial.Native", 1, 0, "Native", native);
    qmlRegisterSingletonInstance("Dial.Native", 1, 0, "Socket", socket);
    // Tests never reach real services: unless DIAL_EXTERNAL_SERVICES=1 (the machine's launcher sets it), the
    // Community uploader talks to a dead local port and the QML only to the backend (netguard.h).
    const bool external = netguard::externalServicesAllowed();
    if (!external) {
        if (!netguard::isLocalUrl(qEnvironmentVariable("COMMUNITY_API_BASE")))
            qputenv("COMMUNITY_API_BASE", "http://127.0.0.1:9");
        qInfo("external services are off: only %s and this machine are reached (DIAL_EXTERNAL_SERVICES=1 enables them)",
              qPrintable(options.apiUrl.host()));
    }
    // The Community uploader (community_upload.rs); its worker thread starts here.
    auto *community = new Community(options.apiUrl, &app);
    qmlRegisterSingletonInstance("Dial.Native", 1, 0, "Community", community);
    qmlRegisterType<PlotLine>("Dial.Native", 1, 0, "PlotLine");
    qmlRegisterType<LottieItem>("Dial.Native", 1, 0, "LottieItem");
    qmlRegisterType<QrCodeItem>("Dial.Native", 1, 0, "QrCode");

    const QString qmlDir = findQmlDir(parser.value(qmlOption));
    if (qmlDir.isEmpty()) {
        qCritical("main.qml not found; pass --qml-dir");
        return 2;
    }
    qInfo("meticulous-dial-qt %s, QML from %s, backend %s, platform %s", DIAL_QT_VERSION, qPrintable(qmlDir),
          qPrintable(options.apiUrl.toString()), qPrintable(QGuiApplication::platformName()));

    QQmlApplicationEngine engine;
    if (!external)
        engine.setNetworkAccessManagerFactory(new LocalOnlyNetworkAccessManagerFactory(netguard::localHosts(options.apiUrl.host())));
    engine.addImportPath(qmlDir);
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed, &app,
                     [] { QCoreApplication::exit(1); }, Qt::QueuedConnection);
    engine.load(QUrl::fromLocalFile(qmlDir + QStringLiteral("/main.qml")));
    if (engine.rootObjects().isEmpty())
        return 1;

    socket->open();
    return app.exec();
}
