#pragma once

#include <QElapsedTimer>
#include <QJsonObject>
#include <QObject>
#include <QUrl>
#include <QVariant>

// What the React Dial got from Tauri (src-tauri/src/lib.rs) and the browser: the OS local time, the
// "ready" markers, persistent storage (localStorage / IndexedDB), logging to the journal, files, and the
// launch options. Exposed to QML as the `Native` singleton.
class Native : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QUrl apiUrl READ apiUrl CONSTANT)
    Q_PROPERTY(int rotation READ rotation CONSTANT)
    Q_PROPERTY(int testPort READ testPort CONSTANT)
    Q_PROPERTY(QString startScreen READ startScreen CONSTANT)
    Q_PROPERTY(QString version READ version CONSTANT)
    Q_PROPERTY(bool showCircle READ showCircle CONSTANT)
    Q_PROPERTY(QString platformName READ platformName CONSTANT)

public:
    struct Options {
        QUrl apiUrl{QStringLiteral("http://localhost:8080")};
        int rotation = -90;
        int testPort = 0;
        QString startScreen;
        QString storagePath;
        bool showCircle = false;
    };

    explicit Native(const Options &options, QObject *parent = nullptr);

    QUrl apiUrl() const { return m_options.apiUrl; }
    int rotation() const { return m_options.rotation; }
    int testPort() const { return m_options.testPort; }
    QString startScreen() const { return m_options.startScreen; }
    QString version() const;
    bool showCircle() const { return m_options.showCircle; }
    QString platformName() const;

    // get_os_local_time: {year, month, day, hour, minute, second, millisecond} in the OS time zone,
    // read again on every call so a time zone change shows without a restart.
    Q_INVOKABLE QVariantMap localTime() const;
    Q_INVOKABLE double monotonicMs() const { return m_clock.nsecsElapsed() / 1e6; }

    // ready / home_ready: the markers other services wait for.
    Q_INVOKABLE void ready();
    Q_INVOKABLE void homeReady();

    // Persistent key/value storage (JSON values), kept in one file written atomically.
    Q_INVOKABLE QVariant storageGet(const QString &key, const QVariant &fallback = QVariant()) const;
    Q_INVOKABLE void storageSet(const QString &key, const QVariant &value);
    Q_INVOKABLE void storageRemove(const QString &key);

    Q_INVOKABLE QString readTextFile(const QString &path) const;
    Q_INVOKABLE bool writeTextFile(const QString &path, const QString &text) const;
    Q_INVOKABLE bool fileExists(const QString &path) const;
    Q_INVOKABLE QString env(const QString &name, const QString &fallback = QString()) const;

    // console.* reaches the journal through the message handler; this tags the source.
    Q_INVOKABLE void log(const QString &level, const QString &message) const;

    // get_dial_resource_snapshot: memory and CPU of this process and the system, from /proc.
    Q_INVOKABLE QVariantMap resourceSnapshot();

    Q_INVOKABLE void quit(int code = 0);

private:
    void loadStorage();
    void saveStorage() const;

    Options m_options;
    QJsonObject m_storage;
    QElapsedTimer m_clock;
    quint64 m_lastCpuTicks = 0;
    quint64 m_lastTotalTicks = 0;
};
