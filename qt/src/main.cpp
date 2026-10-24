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
#include <QSurfaceFormat>

#include <cstdio>

#include "lottieitem.h"
#include "native.h"
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
    engine.addImportPath(qmlDir);
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed, &app,
                     [] { QCoreApplication::exit(1); }, Qt::QueuedConnection);
    engine.load(QUrl::fromLocalFile(qmlDir + QStringLiteral("/main.qml")));
    if (engine.rootObjects().isEmpty())
        return 1;

    socket->open();
    return app.exec();
}
