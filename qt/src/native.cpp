#include "native.h"

#include <QCoreApplication>
#include <QDebug>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QGuiApplication>
#include <QJsonDocument>
#include <QLoggingCategory>
#include <QSaveFile>
#include <QStandardPaths>

#include <ctime>
#include <sys/time.h>
#include <unistd.h>

Q_LOGGING_CATEGORY(lcDial, "dial")

static const char *kReadyMarker = "/run/meticulous-dial-ready";
static const char *kHomeReadyMarker = "/run/meticulous-dial-home-ready";

Native::Native(const Options &options, QObject *parent) : QObject(parent), m_options(options)
{
    m_clock.start();
    if (m_options.storagePath.isEmpty()) {
        const QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
        m_options.storagePath = dir + QStringLiteral("/storage.json");
    }
    loadStorage();
}

QString Native::version() const
{
    return QStringLiteral(DIAL_QT_VERSION);
}

QString Native::platformName() const
{
    return QGuiApplication::platformName();
}

QVariantMap Native::localTime() const
{
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    tzset();
    struct tm local;
    localtime_r(&tv.tv_sec, &local);
    return {
        {QStringLiteral("year"), local.tm_year + 1900},
        {QStringLiteral("month"), local.tm_mon + 1},
        {QStringLiteral("day"), local.tm_mday},
        {QStringLiteral("hour"), local.tm_hour},
        {QStringLiteral("minute"), local.tm_min},
        {QStringLiteral("second"), local.tm_sec},
        {QStringLiteral("millisecond"), int(tv.tv_usec / 1000)},
    };
}

void Native::ready()
{
    qCInfo(lcDial) << "QML is reporting ready!";
    QFile::remove(QString::fromLatin1(kHomeReadyMarker));
    writeTextFile(QString::fromLatin1(kReadyMarker), QStringLiteral("ready\n"));
}

void Native::homeReady()
{
    qCInfo(lcDial) << "QML profile home screen is reporting ready!";
    writeTextFile(QString::fromLatin1(kHomeReadyMarker), QStringLiteral("ready\n"));
}

void Native::loadStorage()
{
    QFile file(m_options.storagePath);
    if (!file.open(QIODevice::ReadOnly))
        return;
    const QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    if (doc.isObject())
        m_storage = doc.object();
}

void Native::saveStorage() const
{
    QDir().mkpath(QFileInfo(m_options.storagePath).absolutePath());
    QSaveFile file(m_options.storagePath);
    if (!file.open(QIODevice::WriteOnly)) {
        qCWarning(lcDial) << "cannot write storage" << m_options.storagePath;
        return;
    }
    file.write(QJsonDocument(m_storage).toJson(QJsonDocument::Compact));
    file.commit();
}

QVariant Native::storageGet(const QString &key, const QVariant &fallback) const
{
    const auto it = m_storage.constFind(key);
    return it == m_storage.constEnd() ? fallback : it->toVariant();
}

void Native::storageSet(const QString &key, const QVariant &value)
{
    m_storage.insert(key, QJsonValue::fromVariant(value));
    saveStorage();
}

void Native::storageRemove(const QString &key)
{
    if (!m_storage.contains(key))
        return;
    m_storage.remove(key);
    saveStorage();
}

QString Native::readTextFile(const QString &path) const
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly))
        return QString();
    return QString::fromUtf8(file.readAll());
}

bool Native::writeTextFile(const QString &path, const QString &text) const
{
    QFile file(path);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        qCWarning(lcDial) << "cannot write" << path << file.errorString();
        return false;
    }
    file.write(text.toUtf8());
    return true;
}

bool Native::fileExists(const QString &path) const
{
    return QFileInfo::exists(path);
}

QString Native::env(const QString &name, const QString &fallback) const
{
    const QByteArray value = qgetenv(name.toLocal8Bit().constData());
    return value.isNull() ? fallback : QString::fromLocal8Bit(value);
}

void Native::log(const QString &level, const QString &message) const
{
    if (level == QLatin1String("error"))
        qCCritical(lcDial).noquote() << message;
    else if (level == QLatin1String("warn"))
        qCWarning(lcDial).noquote() << message;
    else if (level == QLatin1String("debug"))
        qCDebug(lcDial).noquote() << message;
    else
        qCInfo(lcDial).noquote() << message;
}

static quint64 readSelfCpuTicks()
{
    QFile file(QStringLiteral("/proc/self/stat"));
    if (!file.open(QIODevice::ReadOnly))
        return 0;
    const QByteArray stat = file.readAll();
    // Fields after the command's closing parenthesis; utime and stime are the 14th and 15th.
    const int close = stat.lastIndexOf(')');
    const QList<QByteArray> fields = stat.mid(close + 2).split(' ');
    if (fields.size() < 13)
        return 0;
    return fields.at(11).toULongLong() + fields.at(12).toULongLong();
}

static quint64 readTotalTicks()
{
    QFile file(QStringLiteral("/proc/stat"));
    if (!file.open(QIODevice::ReadOnly))
        return 0;
    const QList<QByteArray> fields = file.readLine().simplified().split(' ');
    quint64 total = 0;
    for (int i = 1; i < fields.size(); ++i)
        total += fields.at(i).toULongLong();
    return total;
}

QVariantMap Native::resourceSnapshot()
{
    QVariantMap snapshot;
    QFile status(QStringLiteral("/proc/self/status"));
    if (status.open(QIODevice::ReadOnly)) {
        for (const QByteArray &line : status.readAll().split('\n')) {
            if (line.startsWith("VmRSS:"))
                snapshot.insert(QStringLiteral("dialMemoryMb"), line.mid(6).trimmed().split(' ').first().toDouble() / 1024.0);
        }
    }
    QFile meminfo(QStringLiteral("/proc/meminfo"));
    if (meminfo.open(QIODevice::ReadOnly)) {
        double total = 0, available = 0;
        for (const QByteArray &line : meminfo.readAll().split('\n')) {
            if (line.startsWith("MemTotal:"))
                total = line.mid(9).trimmed().split(' ').first().toDouble();
            else if (line.startsWith("MemAvailable:"))
                available = line.mid(13).trimmed().split(' ').first().toDouble();
        }
        snapshot.insert(QStringLiteral("systemMemoryUsedMb"), (total - available) / 1024.0);
        snapshot.insert(QStringLiteral("systemMemoryTotalMb"), total / 1024.0);
    }
    const quint64 cpu = readSelfCpuTicks();
    const quint64 total = readTotalTicks();
    if (m_lastTotalTicks && total > m_lastTotalTicks) {
        const long cores = sysconf(_SC_NPROCESSORS_ONLN);
        snapshot.insert(QStringLiteral("dialCpuPercent"),
                        100.0 * double(cpu - m_lastCpuTicks) * double(cores) / double(total - m_lastTotalTicks));
    }
    m_lastCpuTicks = cpu;
    m_lastTotalTicks = total;
    double load[3] = {0, 0, 0};
    if (getloadavg(load, 3) > 0)
        snapshot.insert(QStringLiteral("loadAverage1m"), load[0]);
    return snapshot;
}

void Native::quit(int code)
{
    QCoreApplication::exit(code);
}
