#include "logfilter.h"

#include <QCryptographicHash>
#include <QJsonArray>
#include <QRegularExpression>

#include <algorithm>
#include <cstring>
#include <functional>

namespace dialsentry {

// ---- classification

namespace {

// "file:///usr/share/meticulous-dial-qt/qml/Dial/screens/x.qml:12: TypeError: Cannot read property ..."
// (the QML engine's uncaught exceptions and console.* of an Error), optionally ":<column>".
const QRegularExpression &locatedException()
{
    static const QRegularExpression re(
        QStringLiteral(R"(^((?:[a-z]+:)?[^\s]*?\.(?:qml|js|mjs)):(\d+)(?::\d+)?:\s+)"
                       R"(((?:Type|Reference|Syntax|Range|URI|Eval|Internal|Aggregate)?Error):\s?(.*)$)"),
        QRegularExpression::DotMatchesEverythingOption);
    return re;
}

const QRegularExpression &exceptionWords()
{
    static const QRegularExpression re(
        QStringLiteral(R"(\b(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError)\b|\bError:)"));
    return re;
}

} // namespace

QString relativeQmlPath(const QString &fileOrUrl)
{
    QString path = fileOrUrl;
    if (path.startsWith(QLatin1String("file://")))
        path = path.mid(7);
    else if (path.startsWith(QLatin1String("qrc:")))
        path = path.mid(4);
    const int root = path.lastIndexOf(QLatin1String("/qml/"));
    if (root >= 0)
        return path.mid(root + 5);
    return path;
}

Classification classify(QtMsgType type, const QString &message)
{
    Classification c;
    switch (type) {
    case QtDebugMsg:
    case QtInfoMsg:
        return c;
    case QtFatalMsg:
        c.kind = Kind::Fatal;
        c.level = "fatal";
        return c;
    case QtCriticalMsg:
        c.kind = Kind::Event;
        c.level = "error";
        break;
    case QtWarningMsg:
        c.kind = Kind::Breadcrumb;
        c.level = "warning";
        break;
    }
    const QRegularExpressionMatch located = locatedException().match(message);
    if (located.hasMatch()) {
        c.kind = Kind::Event;
        c.level = "error";
        c.exception = true;
        c.file = relativeQmlPath(located.captured(1));
        c.line = located.captured(2).toInt();
        c.exceptionType = located.captured(3);
        c.exceptionValue = located.captured(4).trimmed();
        return c;
    }
    if (type == QtWarningMsg && exceptionWords().match(message).hasMatch()) {
        c.kind = Kind::Event;
        c.level = "error";
    }
    return c;
}

// ---- personal data

namespace {

// src/sentryPrivacy.ts: sensitiveKeys.
const char *const kSensitiveKeys[] = {
    "password", "passwd", "secret", "token", "credential", "authorization", "cookie", "api_key", "auth_key",
    "root_password", "ssid", "apname", "knownwifis", "ip", "ip_address", "ipaddress", "client_ip",
    "remote_addr", "hostname", "machine_name", "email", "username",
};

bool containsPart(const char *normalized, size_t length, const char *part)
{
    const size_t n = std::strlen(part);
    if (length == n && std::memcmp(normalized, part, n) == 0)
        return true;
    // startsWith(`${part}_`)
    if (length > n && std::memcmp(normalized, part, n) == 0 && normalized[n] == '_')
        return true;
    // endsWith(`_${part}`)
    if (length > n && normalized[length - n - 1] == '_' && std::memcmp(normalized + length - n, part, n) == 0)
        return true;
    // includes(`_${part}_`)
    for (size_t i = 0; i + n + 2 <= length; ++i) {
        if (normalized[i] == '_' && std::memcmp(normalized + i + 1, part, n) == 0 && normalized[i + n + 1] == '_')
            return true;
    }
    return false;
}

// normalizedKey(): trim, lower case, '-' and ' ' to '_'. Into a fixed buffer: no allocation.
size_t normalizeKey(const char *key, char *out, size_t capacity)
{
    while (*key == ' ' || *key == '\t' || *key == '\n' || *key == '\r')
        ++key;
    size_t length = std::strlen(key);
    while (length > 0 && (key[length - 1] == ' ' || key[length - 1] == '\t' || key[length - 1] == '\n'
                          || key[length - 1] == '\r'))
        --length;
    if (length >= capacity)
        length = capacity - 1;
    for (size_t i = 0; i < length; ++i) {
        char ch = key[i];
        if (ch >= 'A' && ch <= 'Z')
            ch = char(ch - 'A' + 'a');
        else if (ch == '-' || ch == ' ')
            ch = '_';
        out[i] = ch;
    }
    out[length] = '\0';
    return length;
}

} // namespace

bool isSensitiveKey(const char *key)
{
    if (!key)
        return false;
    char normalized[256];
    const size_t length = normalizeKey(key, normalized, sizeof normalized);
    for (const char *part : kSensitiveKeys) {
        if (containsPart(normalized, length, part))
            return true;
    }
    return false;
}

bool isSensitiveKey(const QString &key)
{
    return isSensitiveKey(key.toUtf8().constData());
}

bool isDroppedTag(const char *key)
{
    if (!key)
        return false;
    char normalized[256];
    normalizeKey(key, normalized, sizeof normalized);
    return std::strcmp(normalized, "machine") == 0 || std::strcmp(normalized, "machine_name") == 0
        || std::strcmp(normalized, "hostname") == 0 || isSensitiveKey(key);
}

namespace {

QString replaceAll(const QString &text, const QRegularExpression &re,
                   const std::function<QString(const QRegularExpressionMatch &)> &replacement)
{
    QString out;
    qsizetype last = 0;
    QRegularExpressionMatchIterator it = re.globalMatch(text);
    if (!it.hasNext())
        return text;
    while (it.hasNext()) {
        const QRegularExpressionMatch m = it.next();
        out += QStringView(text).mid(last, m.capturedStart() - last);
        out += replacement(m);
        last = m.capturedEnd();
    }
    out += QStringView(text).mid(last);
    return out;
}

bool isLoopbackOrAny(int a, int b, int c, int d)
{
    return a == 127 || (a == 0 && b == 0 && c == 0 && d == 0);
}

const QStringList &genericMachineStrings()
{
    // Names that also appear in paths and messages of the Dial itself: never treated as identifying.
    static const QStringList names{QStringLiteral("meticulous"), QStringLiteral("meticulous espresso"),
                                   QStringLiteral("localhost"), QStringLiteral("espresso")};
    return names;
}

} // namespace

void Sanitizer::setMachineStrings(const QStringList &strings)
{
    m_machineStrings.clear();
    for (const QString &s : strings) {
        const QString trimmed = s.trimmed();
        if (trimmed.size() < 4 || genericMachineStrings().contains(trimmed.toLower()))
            continue;
        if (!m_machineStrings.contains(trimmed, Qt::CaseInsensitive))
            m_machineStrings << trimmed;
    }
}

QString Sanitizer::sanitize(const QString &input) const
{
    static const QString filtered = QStringLiteral("[Filtered]");
    QString text = input;

    // Credentials in URLs: scheme://user:password@host
    static const QRegularExpression userinfo(QStringLiteral(R"(\b([A-Za-z][A-Za-z0-9+.-]*://)[^\s/@]+@)"));
    text = replaceAll(text, userinfo, [](const QRegularExpressionMatch &m) {
        return m.captured(1) + QStringLiteral("[Filtered]@");
    });

    // Authorization schemes followed by a credential.
    static const QRegularExpression bearer(QStringLiteral(R"(\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,})"));
    text = replaceAll(text, bearer, [](const QRegularExpressionMatch &m) {
        return m.captured(1) + QStringLiteral(" [Filtered]");
    });

    // Values of sensitive keys: key: value, key=value, "key": "value", 'key': 'value' (also in URL queries).
    static const QRegularExpression keyValue(QStringLiteral(
        R"((?<![\w-])(["']?)([A-Za-z][\w-]{0,63})\1(\s*[:=]\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,;&)}\]"']+))"));
    text = replaceAll(text, keyValue, [](const QRegularExpressionMatch &m) {
        if (!isSensitiveKey(m.captured(2)) || m.captured(4) == QLatin1String("[Filtered]"))
            return m.captured(0);
        const QString value = m.captured(4);
        const QString quote = value.startsWith(QLatin1Char('"')) ? QStringLiteral("\"")
                            : value.startsWith(QLatin1Char('\'')) ? QStringLiteral("'")
                                                                    : QString();
        return m.captured(1) + m.captured(2) + m.captured(1) + m.captured(3) + quote + filtered + quote;
    });

    static const QRegularExpression email(
        QStringLiteral(R"([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})"));
    text.replace(email, QStringLiteral("[email]"));

    // MAC addresses, then IPv6 (full, and compressed with a digit in it: not C++'s "a::b"), then IPv4.
    static const QRegularExpression mac(
        QStringLiteral(R"((?<![\w:])[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}(?![\w:]))"));
    text.replace(mac, QStringLiteral("[mac]"));
    static const QRegularExpression ipv6Full(
        QStringLiteral(R"((?<![\w:])(?:[0-9A-Fa-f]{1,4}:){4,7}[0-9A-Fa-f]{1,4}(?![\w:]))"));
    text.replace(ipv6Full, QStringLiteral("[ip]"));
    static const QRegularExpression ipv6Compressed(QStringLiteral(
        R"((?<![\w:])(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6})?::(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6})?(?![\w:]))"));
    text = replaceAll(text, ipv6Compressed, [](const QRegularExpressionMatch &m) {
        const QString s = m.captured(0);
        static const QRegularExpression digit(QStringLiteral("[0-9]"));
        if (s == QLatin1String("::1") || s == QLatin1String("::") || !s.contains(digit))
            return s;
        return QStringLiteral("[ip]");
    });
    static const QRegularExpression ipv4(
        QStringLiteral(R"((?<![\w.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\.?\d))"));
    text = replaceAll(text, ipv4, [](const QRegularExpressionMatch &m) {
        int parts[4];
        for (int i = 0; i < 4; ++i) {
            parts[i] = m.captured(i + 1).toInt();
            if (parts[i] > 255)
                return m.captured(0);
        }
        if (isLoopbackOrAny(parts[0], parts[1], parts[2], parts[3]))
            return m.captured(0);
        return QStringLiteral("[ip]");
    });

    // mDNS host names: someones-machine.local
    static const QRegularExpression localHost(QStringLiteral(R"(\b[A-Za-z0-9][A-Za-z0-9-]*\.local\b)"));
    text.replace(localHost, QStringLiteral("[host].local"));

    for (const QString &name : m_machineStrings) {
        const QRegularExpression re(QStringLiteral("(?<![A-Za-z0-9])") + QRegularExpression::escape(name)
                                        + QStringLiteral("(?![A-Za-z0-9])"),
                                    QRegularExpression::CaseInsensitiveOption);
        text.replace(re, QStringLiteral("[machine]"));
    }

    if (text.size() > maxLength) {
        text.truncate(maxLength - 1);
        text += QChar(0x2026);
    }
    return text;
}

// ---- rate limits

QString normalizedKey(const QString &message)
{
    // Runs of hex digits (ids, addresses) of 8+ characters with a digit, and any run of decimal digits,
    // become '#'.
    QString out;
    const qsizetype n = qMin<qsizetype>(message.size(), 1024);
    out.reserve(n);
    qsizetype i = 0;
    auto isHex = [](QChar ch) {
        return (ch >= QLatin1Char('0') && ch <= QLatin1Char('9')) || (ch >= QLatin1Char('a') && ch <= QLatin1Char('f'))
            || (ch >= QLatin1Char('A') && ch <= QLatin1Char('F')) || ch == QLatin1Char('-');
    };
    while (i < n) {
        const QChar ch = message.at(i);
        if (isHex(ch)) {
            qsizetype j = i;
            bool digit = false;
            while (j < n && isHex(message.at(j))) {
                digit = digit || message.at(j).isDigit();
                ++j;
            }
            const bool wordStart = i == 0 || !message.at(i - 1).isLetterOrNumber();
            const bool wordEnd = j == n || !message.at(j).isLetterOrNumber();
            if (digit && j - i >= 8 && wordStart && wordEnd) {
                out += QLatin1Char('#');
                i = j;
                continue;
            }
        }
        if (ch.isDigit()) {
            while (i < n && message.at(i).isDigit())
                ++i;
            out += QLatin1Char('#');
            continue;
        }
        out += ch;
        ++i;
    }
    return out.simplified();
}

quint64 keyHash(const QString &normalized)
{
    const QByteArray digest = QCryptographicHash::hash(normalized.toUtf8(), QCryptographicHash::Sha1);
    quint64 value = 0;
    for (int i = 0; i < 8; ++i)
        value = (value << 8) | quint8(digest.at(i));
    return value;
}

void RateLimiter::prune(qint64 nowMs)
{
    // Times in the future (the clock went back, e.g. before NTP at boot) are dropped too.
    auto keep = [nowMs](qint64 t, qint64 window) { return t <= nowMs + 60 * 1000 && nowMs - t < window; };
    m_events.erase(std::remove_if(m_events.begin(), m_events.end(),
                                  [&](qint64 t) { return !keep(t, m_limits.dayMs); }),
                   m_events.end());
    m_crashes.erase(std::remove_if(m_crashes.begin(), m_crashes.end(),
                                   [&](qint64 t) { return !keep(t, 60 * 60 * 1000); }),
                    m_crashes.end());
    m_breadcrumbs.erase(std::remove_if(m_breadcrumbs.begin(), m_breadcrumbs.end(),
                                       [&](qint64 t) { return !keep(t, 60 * 1000); }),
                        m_breadcrumbs.end());
    for (auto it = m_lastSent.begin(); it != m_lastSent.end();) {
        if (!keep(it.value(), m_limits.dedupeMs))
            it = m_lastSent.erase(it);
        else
            ++it;
    }
    // Repeat counts wait for the next send of their message; bounded in case it never comes.
    if (m_repeated.size() > 1024)
        m_repeated.clear();
    if (m_lastBreadcrumb.size() > 256) {
        for (auto it = m_lastBreadcrumb.begin(); it != m_lastBreadcrumb.end();) {
            if (!keep(it.value(), m_limits.breadcrumbDedupeMs))
                it = m_lastBreadcrumb.erase(it);
            else
                ++it;
        }
    }
}

RateLimiter::EventDecision RateLimiter::allowEvent(quint64 key, qint64 nowMs, bool dedupe)
{
    prune(nowMs);
    EventDecision decision;
    if (dedupe && m_lastSent.contains(key)) {
        ++m_repeated[key];
        decision.duplicate = true;
        return decision;
    }
    const qint64 shortStart = nowMs - m_limits.shortWindowMs;
    const int recent = int(std::count_if(m_events.cbegin(), m_events.cend(), [&](qint64 t) { return t > shortStart; }));
    if (recent >= m_limits.eventsPerShortWindow || m_events.size() >= m_limits.eventsPerDay) {
        ++m_dropped;
        return decision;
    }
    decision.send = true;
    decision.repeated = m_repeated.take(key);
    m_events.append(nowMs);
    if (dedupe)
        m_lastSent.insert(key, nowMs);
    return decision;
}

bool RateLimiter::allowBreadcrumb(quint64 key, qint64 nowMs)
{
    prune(nowMs);
    const auto last = m_lastBreadcrumb.constFind(key);
    if (last != m_lastBreadcrumb.cend() && nowMs - last.value() < m_limits.breadcrumbDedupeMs && last.value() <= nowMs)
        return false;
    if (m_breadcrumbs.size() >= m_limits.breadcrumbsPerMinute)
        return false;
    m_breadcrumbs.append(nowMs);
    m_lastBreadcrumb.insert(key, nowMs);
    return true;
}

void RateLimiter::recordCrash(qint64 nowMs)
{
    prune(nowMs);
    m_crashes.append(nowMs);
}

bool RateLimiter::crashReportsAllowed(qint64 nowMs) const
{
    const int recent = int(std::count_if(m_crashes.cbegin(), m_crashes.cend(),
                                         [&](qint64 t) { return nowMs - t < 60 * 60 * 1000 && t <= nowMs + 60 * 1000; }));
    return recent < m_limits.crashesPerHour;
}

QJsonObject RateLimiter::save(qint64 nowMs)
{
    prune(nowMs);
    QJsonArray events;
    for (qint64 t : std::as_const(m_events))
        events.append(double(t));
    QJsonArray crashes;
    for (qint64 t : std::as_const(m_crashes))
        crashes.append(double(t));
    QJsonObject sent;
    for (auto it = m_lastSent.cbegin(); it != m_lastSent.cend(); ++it)
        sent.insert(QString::number(it.key(), 16), double(it.value()));
    return QJsonObject{{QStringLiteral("version"), 1}, {QStringLiteral("events"), events},
                       {QStringLiteral("crashes"), crashes}, {QStringLiteral("sent"), sent}};
}

void RateLimiter::load(const QJsonObject &state, qint64 nowMs)
{
    if (state.value(QStringLiteral("version")).toInt() != 1)
        return;
    m_events.clear();
    m_crashes.clear();
    m_lastSent.clear();
    for (const QJsonValue &v : state.value(QStringLiteral("events")).toArray())
        m_events.append(qint64(v.toDouble()));
    for (const QJsonValue &v : state.value(QStringLiteral("crashes")).toArray())
        m_crashes.append(qint64(v.toDouble()));
    const QJsonObject sent = state.value(QStringLiteral("sent")).toObject();
    for (auto it = sent.constBegin(); it != sent.constEnd(); ++it) {
        bool ok = false;
        const quint64 key = it.key().toULongLong(&ok, 16);
        if (ok)
            m_lastSent.insert(key, qint64(it.value().toDouble()));
    }
    prune(nowMs);
}

} // namespace dialsentry
