#pragma once

// The pure rules of the Qt Dial's Sentry reports (see sentryreporter.h): which Qt messages become events or
// breadcrumbs, how their text is stripped of personal data (src/sentryPrivacy.ts's keys, plus addresses and
// the machine's own name), and the rate limits that keep a repeating message from flooding Sentry. No
// sentry-native in here, so the unit tests check it without a network (tests/unit/tst_sentry_filter.cpp).

#include <QHash>
#include <QJsonObject>
#include <QString>
#include <QStringList>
#include <QVector>
#include <QtGlobal>

namespace dialsentry {

// ---- which messages are reported

enum class Kind {
    Ignore,       // debug and info
    Breadcrumb,   // warnings: kept on the scope, sent with the next event
    Event,        // critical, and warnings that carry a QML/JS exception
    Fatal,        // qFatal: Qt aborts right after, so it rides on the crash report
};

struct Classification {
    Kind kind = Kind::Ignore;
    const char *level = "info";   // Sentry level: "warning", "error", "fatal"
    // A located QML/JS exception ("file:///.../X.qml:12: TypeError: ..."): sent as an exception, so Sentry
    // titles it "TypeError: ..." with the QML file as its frame.
    bool exception = false;
    QString exceptionType;    // TypeError, ReferenceError, Error, ...
    QString exceptionValue;   // the text after "<Type>: "
    QString file;             // "Dial/screens/brew/Barometer.qml" (relative to the QML root when it can)
    int line = 0;
};

Classification classify(QtMsgType type, const QString &message);

// A QML/JS source path as reported: the part from the QML root on ("Dial/...", "main.qml"), else the path.
QString relativeQmlPath(const QString &fileOrUrl);

// ---- personal data (src/sentryPrivacy.ts)

// The React sanitizer's sensitive keys and its matching rule (normalized key equals one, or contains it as
// a `_`-separated part). The `const char *` form allocates nothing: it also runs inside the crash handler.
bool isSensitiveKey(const char *key);
bool isSensitiveKey(const QString &key);
// Tags React's sanitizer drops besides the sensitive ones.
bool isDroppedTag(const char *key);

class Sanitizer
{
public:
    // What names this machine (its name and hostname from /api/v1/machine): replaced in messages.
    void setMachineStrings(const QStringList &strings);
    // Values of sensitive keys ("password: x", "ssid=x", {"token":"x"}), credentials in URLs, bearer
    // tokens, e-mail addresses, IP and MAC addresses (not loopback), *.local host names, the machine's name.
    QString sanitize(const QString &text) const;

    static constexpr int maxLength = 4096;

private:
    QStringList m_machineStrings;
};

// ---- rate limits

// The message with what varies between repeats collapsed (numbers, hex ids): "retry 3 in 500 ms" and
// "retry 4 in 1000 ms" are the same message.
QString normalizedKey(const QString &message);
// A stable 64-bit id of a normalized message (kept on disk instead of the text).
quint64 keyHash(const QString &normalized);

struct Limits {
    qint64 dedupeMs = 60 * 60 * 1000;          // an identical event at most once an hour
    int eventsPerShortWindow = 10;              // at most 10 events in any 10 minutes
    qint64 shortWindowMs = 10 * 60 * 1000;
    int eventsPerDay = 50;                      // and at most 50 in 24 hours
    qint64 dayMs = 24 * 60 * 60 * 1000;
    qint64 breadcrumbDedupeMs = 60 * 1000;     // an identical breadcrumb at most once a minute
    int breadcrumbsPerMinute = 30;
    int crashesPerHour = 3;                     // crash reports in an hour (a crash loop restarts every second)
};

class RateLimiter
{
public:
    explicit RateLimiter(const Limits &limits = Limits()) : m_limits(limits) {}

    struct EventDecision {
        bool send = false;
        int repeated = 0;       // identical events dropped since this one was last sent
        bool duplicate = false; // dropped as a duplicate (else, when !send, by the caps)
    };
    // `dedupe` false: the caller has its own cooldown (the slowdown monitor); only the caps apply.
    EventDecision allowEvent(quint64 key, qint64 nowMs, bool dedupe = true);
    bool allowBreadcrumb(quint64 key, qint64 nowMs);

    void recordCrash(qint64 nowMs);
    // Whether a crash of this run may be reported (fewer than crashesPerHour reports in the last hour).
    bool crashReportsAllowed(qint64 nowMs) const;

    int droppedEvents() const { return m_dropped; }
    const Limits &limits() const { return m_limits; }

    // Kept under the Sentry database, so a restart (or a crash loop) does not reset the windows.
    QJsonObject save(qint64 nowMs);
    void load(const QJsonObject &state, qint64 nowMs);

private:
    void prune(qint64 nowMs);

    Limits m_limits;
    QVector<qint64> m_events;            // send times within the last day
    QHash<quint64, qint64> m_lastSent;   // key -> last send
    QHash<quint64, int> m_repeated;      // key -> duplicates dropped since
    QVector<qint64> m_breadcrumbs;       // breadcrumb times within the last minute
    QHash<quint64, qint64> m_lastBreadcrumb;
    QVector<qint64> m_crashes;           // crash times within the last hour
    int m_dropped = 0;
};

} // namespace dialsentry
