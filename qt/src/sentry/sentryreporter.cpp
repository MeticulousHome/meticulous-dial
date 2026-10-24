#include "sentryreporter.h"

#include "framemonitor.h"
#include "logfilter.h"

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QGuiApplication>
#include <QJsonDocument>
#include <QMutex>
#include <QQuickWindow>
#include <QRegularExpression>
#include <QSaveFile>
#include <QUrl>

#include <atomic>
#include <cstdio>
#include <cstring>

#if DIAL_HAVE_SENTRY
#include <sentry.h>
#endif

namespace dialsentry {

const char *const kDefaultDsn = "https://d958eb514629903cf133ad2b19e80ead@sentry.meticulousespresso.com/8";

bool isLocalDsn(const QString &dsn)
{
    const QUrl url(dsn, QUrl::StrictMode);
    if (!url.isValid() || (url.scheme() != QLatin1String("http") && url.scheme() != QLatin1String("https")))
        return false;
    const QString host = url.host().toLower();
    return host == QLatin1String("127.0.0.1") || host == QLatin1String("localhost") || host == QLatin1String("::1");
}

Config resolveConfig(const EnvReader &env)
{
    Config config;
    const bool external = env("DIAL_EXTERNAL_SERVICES").value_or(QString()) == QLatin1String("1");
    const std::optional<QString> override = env("DIAL_SENTRY_DSN");
    if (override && override->isEmpty()) {
        config.reason = QStringLiteral("DIAL_SENTRY_DSN is empty");
        return config;
    }
    if (override && isLocalDsn(*override)) {
        config.enabled = true;
        config.dsn = *override;
        config.localOverride = true;
    } else if (!external) {
        config.reason = override ? QStringLiteral("external services are off; DIAL_SENTRY_DSN is honoured only on this machine")
                                 : QStringLiteral("external services are off");
        return config;
    } else {
        config.enabled = true;
        config.dsn = QString::fromLatin1(kDefaultDsn);
        if (override)
            config.reason = QStringLiteral("DIAL_SENTRY_DSN ignored: not on this machine");
    }
    if (const auto db = env("DIAL_SENTRY_DATABASE"); db && !db->isEmpty()) {
        config.databasePath = *db;
    } else {
        QString cache = env("XDG_CACHE_HOME").value_or(QString());
        if (cache.isEmpty())
            cache = env("HOME").value_or(QStringLiteral("/tmp")) + QStringLiteral("/.cache");
        config.databasePath = cache + QStringLiteral("/meticulous-dial-qt/sentry");
    }
    config.debug = env("DIAL_SENTRY_DEBUG").value_or(QString()) == QLatin1String("1");
    return config;
}

Config resolveConfigFromEnvironment()
{
    return resolveConfig([](const char *name) -> std::optional<QString> {
        if (!qEnvironmentVariableIsSet(name))
            return std::nullopt;
        return qEnvironmentVariable(name);
    });
}

namespace {

struct State {
    std::atomic<bool> active{false};
    QtMessageHandler previous = nullptr;
    QMutex mutex;
    Sanitizer sanitizer;
    RateLimiter limiter;
    QString limitsPath;
    bool reportedDrop = false;
    Config config;
};

// Never destroyed: the message handler may still run while statics are torn down after main().
State &state()
{
    static State *s = new State;
    return *s;
}

[[maybe_unused]] thread_local bool t_inHandler = false;

[[maybe_unused]] qint64 wallMs()
{
    return QDateTime::currentMSecsSinceEpoch();
}

[[maybe_unused]] void saveLimits(State &s)
{
    if (s.limitsPath.isEmpty())
        return;
    QSaveFile file(s.limitsPath);
    if (!file.open(QIODevice::WriteOnly))
        return;
    file.write(QJsonDocument(s.limiter.save(wallMs())).toJson(QJsonDocument::Compact));
    file.commit();
}

[[maybe_unused]] QString logSource(const QString &category, const char *file)
{
    const QString path = file ? QString::fromUtf8(file) : QString();
    if (category == QLatin1String("qml") || category == QLatin1String("js") || path.endsWith(QLatin1String(".qml"))
        || path.endsWith(QLatin1String(".js")) || path.endsWith(QLatin1String(".mjs")))
        return QStringLiteral("qml");
    return QStringLiteral("native");
}

#if DIAL_HAVE_SENTRY

sentry_value_t str(const QString &s)
{
    const QByteArray utf8 = s.toUtf8();
    return sentry_value_new_string_n(utf8.constData(), size_t(utf8.size()));
}

sentry_level_t levelFrom(const QString &level)
{
    if (level == QLatin1String("debug"))
        return SENTRY_LEVEL_DEBUG;
    if (level == QLatin1String("warning"))
        return SENTRY_LEVEL_WARNING;
    if (level == QLatin1String("error"))
        return SENTRY_LEVEL_ERROR;
    if (level == QLatin1String("fatal"))
        return SENTRY_LEVEL_FATAL;
    return SENTRY_LEVEL_INFO;
}

sentry_value_t toValue(const QVariant &value, int depth = 0)
{
    if (depth > 8 || !value.isValid() || value.isNull())
        return sentry_value_new_null();
    switch (value.metaType().id()) {
    case QMetaType::Bool:
        return sentry_value_new_bool(value.toBool());
    case QMetaType::Int:
    case QMetaType::UInt:
    case QMetaType::Long:
    case QMetaType::LongLong:
    case QMetaType::Short:
    case QMetaType::UShort:
        return sentry_value_new_int64(value.toLongLong());
    case QMetaType::ULong:
    case QMetaType::ULongLong:
        return sentry_value_new_uint64(value.toULongLong());
    case QMetaType::Float:
    case QMetaType::Double: {
        const double d = value.toDouble();
        return qIsFinite(d) ? sentry_value_new_double(d) : sentry_value_new_null();
    }
    case QMetaType::QVariantList:
    case QMetaType::QStringList: {
        sentry_value_t list = sentry_value_new_list();
        for (const QVariant &item : value.toList())
            sentry_value_append(list, toValue(item, depth + 1));
        return list;
    }
    case QMetaType::QVariantMap:
    case QMetaType::QVariantHash: {
        sentry_value_t object = sentry_value_new_object();
        const QVariantMap map = value.toMap();
        for (auto it = map.cbegin(); it != map.cend(); ++it)
            sentry_value_set_by_key(object, it.key().toUtf8().constData(), toValue(it.value(), depth + 1));
        return object;
    }
    default:
        if (value.canConvert<QVariantMap>() && value.metaType().id() != QMetaType::QString)
            return toValue(value.toMap(), depth);
        return str(value.toString());
    }
}

// ---- before_send: src/sentryPrivacy.ts's sanitizeAutomaticSentryEvent (minus "no breadcrumbs": the Qt Dial
// sends its warnings as breadcrumbs, cleaned when they are added). It also runs for crash events inside the
// crash handler, so it only uses sentry_value_* and stack buffers.

void scrubValue(sentry_value_t value, int depth);

struct ObjectScrub {
    sentry_value_t object;
    int depth;
    bool tags;
};

int scrubPair(const char *key, sentry_value_t value, void *data)
{
    const auto *scrub = static_cast<const ObjectScrub *>(data);
    const bool drop = scrub->tags ? isDroppedTag(key) : isSensitiveKey(key);
    if (drop) {
        char copy[256];
        std::strncpy(copy, key, sizeof copy - 1);
        copy[sizeof copy - 1] = '\0';
        sentry_value_remove_by_key(scrub->object, copy);
        return 0;
    }
    if (!scrub->tags)
        scrubValue(value, scrub->depth + 1);
    return 0;
}

int scrubItem(sentry_value_t value, void *data)
{
    scrubValue(value, *static_cast<const int *>(data) + 1);
    return 0;
}

void scrubValue(sentry_value_t value, int depth)
{
    if (depth > 8)
        return;
    switch (sentry_value_get_type(value)) {
    case SENTRY_VALUE_TYPE_OBJECT: {
        ObjectScrub scrub{value, depth, false};
        sentry_value_foreach_key_value(value, scrubPair, &scrub);
        break;
    }
    case SENTRY_VALUE_TYPE_LIST:
        sentry_value_foreach_value(value, scrubItem, &depth);
        break;
    default:
        break;
    }
}

sentry_value_t beforeSend(sentry_value_t event, sentry_hint_t *, void *)
{
    sentry_value_remove_by_key(event, "user");   // sentry-native's installation id; React deletes `user`
    sentry_value_remove_by_key(event, "request");
    sentry_value_remove_by_key(event, "server_name");
    const sentry_value_t tags = sentry_value_get_by_key(event, "tags");
    if (sentry_value_get_type(tags) == SENTRY_VALUE_TYPE_OBJECT) {
        ObjectScrub scrub{tags, 0, true};
        sentry_value_foreach_key_value(tags, scrubPair, &scrub);
    }
    scrubValue(sentry_value_get_by_key(event, "contexts"), 0);
    scrubValue(sentry_value_get_by_key(event, "extra"), 0);
    return event;
}

void addBreadcrumb(const char *level, const QString &category, const QString &text)
{
    const QByteArray utf8 = text.toUtf8();
    sentry_value_t crumb = sentry_value_new_breadcrumb_n("default", 7, utf8.constData(), size_t(utf8.size()));
    sentry_value_set_by_key(crumb, "level", sentry_value_new_string(level));
    sentry_value_set_by_key(crumb, "category", str(category));
    sentry_add_breadcrumb(crumb);
}

sentry_value_t messageContext(const QString &category, const QMessageLogContext &context, int repeated)
{
    sentry_value_t qt = sentry_value_new_object();
    sentry_value_set_by_key(qt, "category", str(category));
    if (context.file)
        sentry_value_set_by_key(qt, "file", str(relativeQmlPath(QString::fromUtf8(context.file))));
    if (context.line > 0)
        sentry_value_set_by_key(qt, "line", sentry_value_new_int32(context.line));
    if (context.function)
        sentry_value_set_by_key(qt, "function", str(QString::fromUtf8(context.function).left(200)));
    if (repeated > 0)
        sentry_value_set_by_key(qt, "repeated", sentry_value_new_int32(repeated));
    return qt;
}

void captureLogEvent(const Classification &c, const QString &text, const QString &category,
                     const QMessageLogContext &context, int repeated)
{
    const QString logger = category.isEmpty() || category == QLatin1String("default") ? QStringLiteral("qt") : category;
    sentry_value_t event;
    sentry_value_t fingerprint = sentry_value_new_list();
    if (c.exception) {
        event = sentry_value_new_event();
        sentry_value_set_by_key(event, "level", sentry_value_new_string("error"));
        sentry_value_set_by_key(event, "logger", str(logger));
        const QByteArray type = c.exceptionType.toUtf8();
        const QByteArray value = c.exceptionValue.toUtf8();
        sentry_value_t exception = sentry_value_new_exception_n(type.constData(), size_t(type.size()),
                                                                value.constData(), size_t(value.size()));
        if (!c.file.isEmpty()) {
            // The QML location as the exception's one frame: Sentry shows it as the culprit.
            sentry_value_t frame = sentry_value_new_object();
            sentry_value_set_by_key(frame, "filename", str(c.file));
            sentry_value_set_by_key(frame, "lineno", sentry_value_new_int32(c.line));
            sentry_value_set_by_key(frame, "in_app", sentry_value_new_bool(true));
            sentry_value_t frames = sentry_value_new_list();
            sentry_value_append(frames, frame);
            sentry_value_t stacktrace = sentry_value_new_object();
            sentry_value_set_by_key(stacktrace, "frames", frames);
            sentry_value_set_by_key(exception, "stacktrace", stacktrace);
        }
        sentry_event_add_exception(event, exception);
        sentry_value_append(fingerprint, sentry_value_new_string("qml-exception"));
        sentry_value_append(fingerprint, str(c.exceptionType));
        sentry_value_append(fingerprint, str(c.file));
        sentry_value_append(fingerprint, str(normalizedKey(c.exceptionValue).left(200)));
    } else {
        const QByteArray loggerUtf8 = logger.toUtf8();
        const QByteArray utf8 = text.toUtf8();
        event = sentry_value_new_message_event_n(levelFrom(QString::fromLatin1(c.level)), loggerUtf8.constData(),
                                                 size_t(loggerUtf8.size()), utf8.constData(), size_t(utf8.size()));
        sentry_value_append(fingerprint, sentry_value_new_string("qt-log"));
        sentry_value_append(fingerprint, sentry_value_new_string(c.level));
        sentry_value_append(fingerprint, str(normalizedKey(text).left(200)));
    }
    sentry_value_set_by_key(event, "fingerprint", fingerprint);
    sentry_value_t extra = sentry_value_new_object();
    sentry_value_set_by_key(extra, "qt_message", messageContext(category, context, repeated));
    sentry_value_set_by_key(event, "extra", extra);
    sentry_value_t tags = sentry_value_new_object();
    sentry_value_set_by_key(tags, "log-source", str(logSource(category, context.file)));
    sentry_value_set_by_key(event, "tags", tags);
    sentry_capture_event(event);
}

void reportMessage(QtMsgType type, const QMessageLogContext &context, const QString &message)
{
    const Classification raw = classify(type, message);
    if (raw.kind == Kind::Ignore)
        return;
    State &s = state();
    const QString category = context.category ? QString::fromLatin1(context.category) : QString();
    const QString crumbCategory =
        category.isEmpty() || category == QLatin1String("default") ? QStringLiteral("qt") : category;
    const qint64 now = wallMs();

    QMutexLocker locker(&s.mutex);
    if (raw.kind == Kind::Fatal) {
        // Qt aborts after this message: breakpad turns the abort into the crash report, which carries the
        // message as its last breadcrumb and in its "qt_fatal" context.
        const QString text = s.sanitizer.sanitize(message);
        addBreadcrumb("fatal", crumbCategory, text);
        sentry_value_t fatal = messageContext(category, context, 0);
        sentry_value_set_by_key(fatal, "message", str(text));
        sentry_set_context("qt_fatal", fatal);
        return;
    }
    const quint64 key = keyHash(QString::number(int(type)) + QLatin1Char('|') + category + QLatin1Char('|')
                                + normalizedKey(message));
    if (raw.kind == Kind::Breadcrumb) {
        if (s.limiter.allowBreadcrumb(key, now))
            addBreadcrumb("warning", crumbCategory, s.sanitizer.sanitize(message));
        return;
    }
    const RateLimiter::EventDecision decision = s.limiter.allowEvent(key, now);
    if (!decision.send) {
        if (!decision.duplicate && !s.reportedDrop) {
            s.reportedDrop = true;
            qInfo("sentry: event limit reached (%d in 10 min, %d a day): further messages stay in the journal",
                  s.limiter.limits().eventsPerShortWindow, s.limiter.limits().eventsPerDay);
        }
        return;
    }
    s.reportedDrop = false;
    saveLimits(s);
    const QString text = s.sanitizer.sanitize(message);
    locker.unlock();
    Classification clean = classify(type, text);
    if (clean.kind != Kind::Event)
        clean = raw;
    captureLogEvent(clean, text, category, context, decision.repeated);
}

#endif // DIAL_HAVE_SENTRY

[[maybe_unused]] void messageHandler(QtMsgType type, const QMessageLogContext &context, const QString &message)
{
    State &s = state();
    // The journal (or the terminal) first, unchanged.
    if (s.previous)
        s.previous(type, context, message);
    else
        fprintf(stderr, "%s\n", qPrintable(qFormatLogMessage(type, context, message)));
#if DIAL_HAVE_SENTRY
    if (!s.active.load(std::memory_order_acquire) || t_inHandler)
        return;
    t_inHandler = true;
    reportMessage(type, context, message);
    t_inHandler = false;
#endif
}

// Envelopes whose retries ran out (sentry-native moves them to <db>/cache/<uuid>.envelope, where nothing sends
// them again) get a retry name back, so a machine that was offline for longer than the retry schedule still
// sends them at a later start. They stay bounded by cache_max_items / size / age.
[[maybe_unused]] int rearmCachedEnvelopes(const QString &cacheDir, qint64 nowMs)
{
    QDir dir(cacheDir);
    if (!dir.exists())
        return 0;
    static const QRegularExpression bare(
        QStringLiteral("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.envelope$"));
    int rearmed = 0;
    for (const QString &name : dir.entryList(QDir::Files)) {
        if (!bare.match(name).hasMatch())
            continue;
        if (dir.rename(name, QStringLiteral("%1-00-%2").arg(nowMs).arg(name)))
            ++rearmed;
    }
    return rearmed;
}

} // namespace

bool start(const char *version, const char *buildId)
{
    State &s = state();
    if (s.active)
        return true;
    s.config = resolveConfigFromEnvironment();
    if (!s.config.enabled) {
        qInfo("sentry: off (%s)", qPrintable(s.config.reason));
        return false;
    }
#if !DIAL_HAVE_SENTRY
    Q_UNUSED(version);
    Q_UNUSED(buildId);
    qInfo("sentry: off (built without sentry-native: DIAL_WITH_SENTRY=OFF)");
    s.config.enabled = false;
    return false;
#else
    const QString db = QDir::cleanPath(s.config.databasePath);
    if (!QDir().mkpath(db)) {
        qWarning("sentry: off (cannot create %s)", qPrintable(db));
        s.config.enabled = false;
        return false;
    }
    const qint64 now = wallMs();
    s.limitsPath = db + QStringLiteral("/dial-rate-limits.json");
    {
        QFile file(s.limitsPath);
        if (file.open(QIODevice::ReadOnly))
            s.limiter.load(QJsonDocument::fromJson(file.readAll()).object(), now);
    }
    // sentry_init consumes the marker breakpad leaves when it reports a crash.
    if (QFile::exists(db + QStringLiteral("/last_crash")))
        s.limiter.recordCrash(now);
    const bool crashHandler = s.limiter.crashReportsAllowed(now);
    saveLimits(s);
    const int rearmed = rearmCachedEnvelopes(db + QStringLiteral("/cache"), now);

    const QByteArray dsn = s.config.dsn.toUtf8();
    const QByteArray dbPath = db.toUtf8();
    const QByteArray release = QByteArray("meticulous-dial-qt@") + version;
    sentry_options_t *options = sentry_options_new();
    sentry_options_set_dsn(options, dsn.constData());
    sentry_options_set_database_path(options, dbPath.constData());
    sentry_options_set_release(options, release.constData());
    if (buildId && *buildId)
        sentry_options_set_dist(options, buildId);
    sentry_options_set_environment(options, "production");
    // sendDefaultPii: false. sentry-native has the option only on the Nintendo Switch; on Linux the only
    // identifying default is user.id (the installation id), which beforeSend removes.
    sentry_options_set_sample_rate(options, 1.0);
    sentry_options_set_traces_sample_rate(options, 0.0);
    // React sends no breadcrumbs (maxBreadcrumbs: 0); the Qt Dial keeps the last warnings (capped above).
    sentry_options_set_max_breadcrumbs(options, 40);
    // React drops BrowserSession: no release-health sessions either.
    sentry_options_set_auto_session_tracking(options, 0);
    sentry_options_set_before_send(options, beforeSend, nullptr);
    // Offline: a send that fails on the network is kept in <db>/cache and retried (after 15 min, doubling, 6
    // retries, and at every start); when they run out it stays in the cache (rearmed at the next start).
    sentry_options_set_http_retry(options, 1);
    sentry_options_set_cache_keep(options, SENTRY_CACHE_KEEP_OFFLINE);
    sentry_options_set_cache_max_items(options, 30);
    sentry_options_set_cache_max_size(options, 20 * 1024 * 1024);
    sentry_options_set_cache_max_age(options, 14 * 24 * 60 * 60);
    sentry_options_set_shutdown_timeout(options, 2000);
    sentry_options_set_transfer_timeout(options, 30000);
    sentry_options_set_debug(options, s.config.debug ? 1 : 0);
    // A crash loop (Restart=always restarts in 1 s): after crashesPerHour reports in an hour, runs start
    // without the crash handler until the hour has passed (systemd's crash-reporter still sees each crash).
    if (!crashHandler)
        sentry_options_set_backend(options, nullptr);
    if (sentry_init(options) != 0) {
        qWarning("sentry: off (sentry_init failed)");
        s.config.enabled = false;
        return false;
    }
    sentry_set_tag("dial-version", version);
    sentry_set_tag("dial-runtime", "qt");
    s.previous = qInstallMessageHandler(messageHandler);
    s.active.store(true, std::memory_order_release);
    qInfo("sentry: on, reporting to %s%s as %s (dist %s), database %s%s%s", qPrintable(QUrl(s.config.dsn).host()),
          s.config.localOverride ? " (DIAL_SENTRY_DSN)" : "", release.constData(), buildId && *buildId ? buildId : "-",
          qPrintable(db), crashHandler ? "" : ", crash reports paused (crash loop)",
          rearmed ? qPrintable(QStringLiteral(", %1 cached envelope(s) rearmed").arg(rearmed)) : "");
    if (!s.config.reason.isEmpty())
        qInfo("sentry: %s", qPrintable(s.config.reason));
    return true;
#endif
}

void stop()
{
    State &s = state();
    if (!s.active.exchange(false))
        return;
    qInstallMessageHandler(s.previous);
#if DIAL_HAVE_SENTRY
    sentry_close();
#endif
}

bool isEnabled()
{
    return state().active.load(std::memory_order_acquire);
}

const Config &config()
{
    return state().config;
}

void setDeviceInfo(const QVariantMap &info)
{
    if (!isEnabled())
        return;
#if DIAL_HAVE_SENTRY
    auto tag = [&info](const char *key, const char *field) {
        const QVariant value = info.value(QString::fromLatin1(field));
        const QString text = value.isNull() ? QString() : value.toString().trimmed();
        if (!text.isEmpty())
            sentry_set_tag(key, text.toUtf8().constData());
    };
    tag("serial", "serial");
    tag("build-version", "image_version");
    tag("build-channel", "image_build_channel");
    State &s = state();
    QMutexLocker locker(&s.mutex);
    s.sanitizer.setMachineStrings({info.value(QStringLiteral("name")).toString(),
                                   info.value(QStringLiteral("hostname")).toString()});
#else
    Q_UNUSED(info);
#endif
}

QString captureMessage(const QString &message, const QVariantMap &options)
{
    if (!isEnabled())
        return QString();
#if DIAL_HAVE_SENTRY
    State &s = state();
    QString text;
    {
        QMutexLocker locker(&s.mutex);
        const RateLimiter::EventDecision decision = s.limiter.allowEvent(keyHash(QStringLiteral("qml|") + message),
                                                                         wallMs(), false);
        if (!decision.send)
            return QString();
        saveLimits(s);
        text = s.sanitizer.sanitize(message);
    }
    const QByteArray utf8 = text.toUtf8();
    sentry_value_t event = sentry_value_new_message_event_n(levelFrom(options.value(QStringLiteral("level")).toString()),
                                                            "qml", 3, utf8.constData(), size_t(utf8.size()));
    const QVariantList fingerprint = options.value(QStringLiteral("fingerprint")).toList();
    if (!fingerprint.isEmpty()) {
        sentry_value_t list = sentry_value_new_list();
        for (const QVariant &part : fingerprint)
            sentry_value_append(list, str(part.toString()));
        sentry_value_set_by_key(event, "fingerprint", list);
    }
    const QVariantMap tags = options.value(QStringLiteral("tags")).toMap();
    if (!tags.isEmpty()) {
        sentry_value_t object = sentry_value_new_object();
        for (auto it = tags.cbegin(); it != tags.cend(); ++it)
            sentry_value_set_by_key(object, it.key().toUtf8().constData(), str(it.value().toString()));
        sentry_value_set_by_key(event, "tags", object);
    }
    const QVariant contexts = options.value(QStringLiteral("contexts"));
    if (contexts.isValid())
        sentry_value_set_by_key(event, "contexts", toValue(contexts));
    const QVariant extra = options.value(QStringLiteral("extra"));
    if (extra.isValid())
        sentry_value_set_by_key(event, "extra", toValue(extra));
    const sentry_uuid_t id = sentry_capture_event(event);
    char buffer[37];
    sentry_uuid_as_string(&id, buffer);
    return QString::fromLatin1(buffer);
#else
    Q_UNUSED(message);
    Q_UNUSED(options);
    return QString();
#endif
}

} // namespace dialsentry

// ---- the QML singleton

namespace {
bool envFlag(const char *name)
{
    const QString value = qEnvironmentVariable(name);
    return value == QLatin1String("1") || value.compare(QLatin1String("true"), Qt::CaseInsensitive) == 0;
}
} // namespace

SentryBridge::SentryBridge(QObject *parent) : QObject(parent) {}

SentryBridge::~SentryBridge() = default;

bool SentryBridge::enabled() const
{
    return dialsentry::isEnabled();
}

bool SentryBridge::performanceMonitorEnabled() const
{
    return !envFlag("DIAL_PERFORMANCE_DISABLE");
}

bool SentryBridge::performanceDebug() const
{
    return envFlag("DIAL_PERFORMANCE_DEBUG");
}

void SentryBridge::setDeviceInfo(const QVariantMap &info)
{
    dialsentry::setDeviceInfo(info);
}

QString SentryBridge::captureMessage(const QString &message, const QVariantMap &options)
{
    return dialsentry::captureMessage(message, options);
}

bool SentryBridge::startFrameMonitor()
{
    if (m_frames)
        return true;
    if (!dialsentry::isEnabled())
        return false;
    QQuickWindow *window = nullptr;
    for (QWindow *candidate : QGuiApplication::topLevelWindows()) {
        if ((window = qobject_cast<QQuickWindow *>(candidate)))
            break;
    }
    if (!window)
        return false;
    m_frames = new dialsentry::FrameMonitor(window, this);
    connect(m_frames, &dialsentry::FrameMonitor::windowClosed, this,
            [this](const QVector<double> &intervals, double windowMs, double maxTimerHeartbeatDelayMs) {
                QVariantList list;
                list.reserve(intervals.size());
                for (double interval : intervals)
                    list.append(interval);
                emit frameWindow(list, windowMs, maxTimerHeartbeatDelayMs);
            });
    return true;
}

void SentryBridge::stopFrameMonitor()
{
    delete m_frames;
    m_frames = nullptr;
}
