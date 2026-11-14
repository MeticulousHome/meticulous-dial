#include "community.h"

#include "community/diagnostics.h"
#include "community/http.h"
#include "community/model.h"
#include "community/service.h"

#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QMutex>
#include <QThread>
#include <QWaitCondition>

using namespace community;

// CommunityUploadService::start: the uploader thread. Every 500 ms it runs a tick when the backoff
// allows it, writes the diagnostics snapshot (at most every 30 s) and tells the GUI when the status
// changed. Its HTTP client lives on this thread.
class CommunityWorker final : public QThread
{
public:
    CommunityWorker(UploadService *service, const std::atomic<bool> *stop, std::function<void()> statusChanged)
        : m_service(service), m_stop(stop), m_statusChanged(std::move(statusChanged))
    {
        setObjectName(QStringLiteral("community-upload"));
    }

    void wake()
    {
        QMutexLocker locker(&m_waitMutex);
        m_wait.wakeAll();
    }

protected:
    void run() override
    {
        QtHttpClient http(m_stop);
        diagnostics::Reporter reporter;
        std::optional<UploadStatus> reported;
        while (!m_stop->load()) {
            if (m_service->workerIsReady()) {
                const auto failure = m_service->workerTick(http);
                if (m_stop->load())
                    break;   // the shutdown aborted the request: nothing to record
                if (failure)
                    m_service->recordWorkerFailure(*failure);
                else
                    m_service->clearWorkerFailureCount();
            }
            const UploadStatus status = m_service->status();
            reporter.observe(status.toJson(), m_service->diagnosticsPath());
            if (!reported || *reported != status) {
                reported = status;
                m_statusChanged();
            }
            // Objects Qt deletes later (socket internals) go now; this thread has no event loop of its own.
            QCoreApplication::sendPostedEvents(nullptr, QEvent::DeferredDelete);
            QMutexLocker locker(&m_waitMutex);
            if (!m_stop->load())
                m_wait.wait(&m_waitMutex, 500);
        }
    }

private:
    UploadService *m_service;
    const std::atomic<bool> *m_stop;
    std::function<void()> m_statusChanged;
    QMutex m_waitMutex;
    QWaitCondition m_wait;
};

namespace {
// The live instance, stopped from the QCoreApplication destructor (before Qt tears itself down) when
// the application ends without aboutToQuit, e.g. when main.qml fails to load.
Community *s_running = nullptr;

QVariant nullable(const std::optional<qint64> &value)
{
    return value ? QVariant::fromValue(*value) : QVariant::fromValue(nullptr);
}

QVariant nullable(const std::optional<QString> &value)
{
    return value ? QVariant(*value) : QVariant::fromValue(nullptr);
}

QVariantMap toVariant(const UploadStatus &status)
{
    return {
        {QStringLiteral("state"), status.state},
        {QStringLiteral("connected"), status.connected},
        {QStringLiteral("paused"), status.paused},
        {QStringLiteral("pendingCount"), status.pendingCount},
        {QStringLiteral("lastSuccessAt"), nullable(status.lastSuccessAt)},
        {QStringLiteral("lastError"), nullable(status.lastError)},
        {QStringLiteral("lastRetryAt"), nullable(status.lastRetryAt)},
        {QStringLiteral("enrollmentExpiresAt"), nullable(status.enrollmentExpiresAt)},
    };
}
}   // namespace

QString Community::storageRoot()
{
    QString config;
    if (qEnvironmentVariableIsSet("CONFIG_PATH"))
        config = qEnvironmentVariable("CONFIG_PATH");
    else if (QFileInfo(QStringLiteral("/meticulous-user")).isDir())
        config = QStringLiteral("/meticulous-user/config");
    else
        config = QDir::tempPath() + QStringLiteral("/meticulous-dial-config");   // as the Rust debug build
    if (config.isEmpty())
        return QStringLiteral("community-upload");
    return QDir::cleanPath(config + QStringLiteral("/community-upload"));
}

Community::Community(const QUrl &defaultMachineBase, QObject *parent) : QObject(parent)
{
    m_commands = std::make_unique<QThreadPool>();
    m_commands->setMaxThreadCount(1);   // commands run one after the other, in order

    UploadService::Config config;
    config.root = storageRoot();
    if (qEnvironmentVariableIsSet("COMMUNITY_API_BASE"))
        config.communityBase = qEnvironmentVariable("COMMUNITY_API_BASE");
    if (qEnvironmentVariableIsSet("MACHINE_API_BASE"))
        config.machineBase = qEnvironmentVariable("MACHINE_API_BASE");
    else if (defaultMachineBase.isValid() && !defaultMachineBase.isEmpty())
        config.machineBase = defaultMachineBase.toString();
    QString error;
    m_service = UploadService::create(config, &error);
    if (!m_service) {
        qCritical("[CommunityUpload] initialization_failed");
        m_unavailableError = error;
    } else {
        qInfo("[CommunityUpload] storage %s, community %s, machine %s", qPrintable(config.root),
              qPrintable(config.communityBase), qPrintable(config.machineBase));
    }
    refreshStatus();

    m_refreshTimer.setInterval(1000);
    connect(&m_refreshTimer, &QTimer::timeout, this, &Community::refreshStatus);
    m_refreshTimer.start();

    if (m_service) {
        m_worker = new CommunityWorker(m_service.get(), &m_stop, [this] {
            QMetaObject::invokeMethod(this, &Community::refreshStatus, Qt::QueuedConnection);
        });
        m_worker->start(QThread::LowPriority);
    }
    if (QCoreApplication::instance())
        connect(QCoreApplication::instance(), &QCoreApplication::aboutToQuit, this, &Community::stop);
    static bool postRoutineAdded = false;
    if (!postRoutineAdded) {
        qAddPostRoutine(&Community::stopAtExit);
        postRoutineAdded = true;
    }
    s_running = this;
}

Community::~Community()
{
    stop();
    if (s_running == this)
        s_running = nullptr;
}

void Community::stopAtExit()
{
    if (s_running)
        s_running->stop();
}

void Community::stop()
{
    if (m_stop.exchange(true))
        return;
    m_refreshTimer.stop();
    bool workerStopped = true;
    if (m_worker) {
        m_worker->wake();
        workerStopped = m_worker->wait(5000);
        if (workerStopped)
            delete m_worker;
        m_worker = nullptr;
    }
    const bool commandsStopped = m_commands->waitForDone(5000);
    if (!workerStopped || !commandsStopped) {
        // A thread is still inside the service (a write that does not return): leave them to the exit.
        qWarning("[CommunityUpload] the uploader did not stop in time");
        (void)m_service.release();
        (void)m_commands.release();
    }
}

void Community::refreshStatus()
{
    const UploadStatus status = m_service ? m_service->status() : unavailableStatus(m_unavailableError);
    if (m_lastStatus && *m_lastStatus == status)
        return;
    m_lastStatus = std::make_unique<UploadStatus>(status);
    m_status = toVariant(status);
    emit statusChanged();
}

void Community::runCommand(std::function<void()> task)
{
    m_commands->start(std::move(task));
}

void Community::beginEnrollment(const QString &machineSerial)
{
    if (!m_service || m_stop.load()) {
        QMetaObject::invokeMethod(
            this, [this] { emit enrollmentResult({{QStringLiteral("error"), QString::fromLatin1(kUnavailableMessage)}}); },
            Qt::QueuedConnection);
        return;
    }
    UploadService *service = m_service.get();
    const std::optional<QString> serial = machineSerial.isEmpty() ? std::nullopt : std::optional<QString>(machineSerial);
    runCommand([this, service, serial] {
        QString error;
        const auto enrollment = service->beginEnrollment(serial, &error);
        QVariantMap result;
        if (enrollment) {
            result.insert(QStringLiteral("qrUrl"), enrollment->qrUrl);
            result.insert(QStringLiteral("expiresAt"), QVariant::fromValue(enrollment->expiresAt));
        } else {
            result.insert(QStringLiteral("error"), error);
        }
        QMetaObject::invokeMethod(
            this,
            [this, result] {
                refreshStatus();
                emit enrollmentResult(result);
            },
            Qt::QueuedConnection);
    });
}

void Community::setUploadPaused(bool paused)
{
    if (!m_service || m_stop.load()) {
        QMetaObject::invokeMethod(
            this,
            [this] { emit operationFinished(QStringLiteral("setUploadPaused"), QString::fromLatin1(kUnavailableMessage)); },
            Qt::QueuedConnection);
        return;
    }
    UploadService *service = m_service.get();
    runCommand([this, service, paused] {
        const QString error = service->setPaused(paused);
        QMetaObject::invokeMethod(
            this,
            [this, error] {
                refreshStatus();
                emit operationFinished(QStringLiteral("setUploadPaused"), error);
            },
            Qt::QueuedConnection);
    });
}

void Community::disconnect()
{
    if (!m_service || m_stop.load()) {
        QMetaObject::invokeMethod(
            this,
            [this] { emit operationFinished(QStringLiteral("disconnect"), QString::fromLatin1(kUnavailableMessage)); },
            Qt::QueuedConnection);
        return;
    }
    UploadService *service = m_service.get();
    runCommand([this, service] {
        QString error;
        {
            QtHttpClient http(&m_stop);
            error = service->disconnect(http);
        }
        QCoreApplication::sendPostedEvents(nullptr, QEvent::DeferredDelete);
        QMetaObject::invokeMethod(
            this,
            [this, error] {
                refreshStatus();
                emit operationFinished(QStringLiteral("disconnect"), error);
            },
            Qt::QueuedConnection);
    });
}

QString Community::factoryResetLocal()
{
    if (!m_service)
        return QString::fromLatin1(kUnavailableMessage);
    const QString error = m_service->factoryResetLocal();
    refreshStatus();
    return error;
}

QString Community::scanHistory()
{
    if (!m_service)
        return QString::fromLatin1(kUnavailableMessage);
    return m_service->requestHistoryScan();
}
