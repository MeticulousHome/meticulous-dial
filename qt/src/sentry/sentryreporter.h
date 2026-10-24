#pragma once

// Sentry for the Qt Dial (sentry-native, built with the project: CMakeLists.txt, DIAL_WITH_SENTRY).
// What it sends, when and why: docs/qt-migration/parity/sentry.md. In short:
//   - On only with DIAL_EXTERNAL_SERVICES=1 (the machine's launcher), to the React Dial's DSN (project 8).
//     Tests and development never start it, except with DIAL_SENTRY_DSN pointing at this machine (a test's
//     fake Sentry). Off means off: no sentry_init, no handler, no files.
//   - Crashes: breakpad (in process) writes a minidump; it is sent on the next start.
//   - The Qt message handler: critical messages and QML/JS exceptions become events, warnings breadcrumbs,
//     with personal data stripped (logfilter.h) and rate limits that persist across restarts.
//   - Offline: failed sends wait on disk (<db>/cache) and are retried with backoff and at every start.
//   - QML: the `Sentry` singleton sets the device tags (Device.qml) and sends the slowdown report.

#include <QObject>
#include <QString>
#include <QVariantList>
#include <QVariantMap>

#include <functional>
#include <optional>

namespace dialsentry {

class FrameMonitor;

// The React Dial's DSN (src/sentryConfig.ts).
extern const char *const kDefaultDsn;

struct Config {
    bool enabled = false;
    QString dsn;
    QString databasePath;
    bool localOverride = false;   // DIAL_SENTRY_DSN on this machine (a test's fake Sentry)
    bool debug = false;           // DIAL_SENTRY_DEBUG=1: sentry-native's own log on stderr
    QString reason;               // why it is off, or a note about the configuration
};

using EnvReader = std::function<std::optional<QString>(const char *name)>;
// The decision, from the environment: DIAL_EXTERNAL_SERVICES, DIAL_SENTRY_DSN, DIAL_SENTRY_DATABASE,
// XDG_CACHE_HOME, HOME, DIAL_SENTRY_DEBUG.
Config resolveConfig(const EnvReader &env);
Config resolveConfigFromEnvironment();
bool isLocalDsn(const QString &dsn);

// Starts Sentry if the environment says so. Call first in main(), before QGuiApplication, so a crash during
// start-up is caught. `version` names the release (meticulous-dial-qt@<version>), `buildId` its dist.
bool start(const char *version, const char *buildId);
// Flushes (up to 2 s) and shuts sentry-native down; the message handler is put back.
void stop();
bool isEnabled();
// The configuration start() used.
const Config &config();

// /api/v1/machine: tags serial, build-version, build-channel (SentryRuntimeMetadata in App.tsx); its name and
// hostname are removed from messages from now on.
void setDeviceInfo(const QVariantMap &info);
// An event from QML: options { level, fingerprint: [..], tags: {..}, contexts: {name: {..}}, extra: {..} }.
// Counts against the event caps. Returns the event id, or "" when off or dropped.
QString captureMessage(const QString &message, const QVariantMap &options);

// For main(): start() now, stop() when main returns.
class Session
{
public:
    Session(const char *version, const char *buildId) { start(version, buildId); }
    ~Session() { stop(); }
    Session(const Session &) = delete;
    Session &operator=(const Session &) = delete;
};

} // namespace dialsentry

// The QML singleton `Sentry` (module Dial.Native).
class SentryBridge : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool enabled READ enabled CONSTANT)
    // useDialSlowdownMonitor's switches (src-tauri lib.rs): DIAL_PERFORMANCE_DISABLE, DIAL_PERFORMANCE_DEBUG.
    Q_PROPERTY(bool performanceMonitorEnabled READ performanceMonitorEnabled CONSTANT)
    Q_PROPERTY(bool performanceDebug READ performanceDebug CONSTANT)

public:
    explicit SentryBridge(QObject *parent = nullptr);
    ~SentryBridge() override;

    bool enabled() const;
    bool performanceMonitorEnabled() const;
    bool performanceDebug() const;

    Q_INVOKABLE void setDeviceInfo(const QVariantMap &info);
    Q_INVOKABLE QString captureMessage(const QString &message, const QVariantMap &options = QVariantMap());

    // Frame timing of the Dial's window for the slowdown monitor (framemonitor.h); frameWindow() is emitted
    // for every 10 s of drawing. Only while Sentry is on.
    Q_INVOKABLE bool startFrameMonitor();
    Q_INVOKABLE void stopFrameMonitor();

signals:
    void frameWindow(const QVariantList &intervals, double windowMs, double maxTimerHeartbeatDelayMs);

private:
    dialsentry::FrameMonitor *m_frames = nullptr;
};
