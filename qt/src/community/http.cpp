#include "http.h"

#include "model.h"

#include <QCoreApplication>
#include <QEventLoop>
#include <QNetworkAccessManager>
#include <QNetworkCookie>
#include <QNetworkCookieJar>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QTimer>

namespace community {

std::optional<QByteArray> HttpResponse::header(const QByteArray &lowerName) const
{
    const auto it = headers.constFind(lowerName);
    if (it == headers.constEnd())
        return std::nullopt;
    return it.value();
}

namespace {
// reqwest is built without its cookie store: nothing is kept or sent.
class NoCookieJar final : public QNetworkCookieJar
{
public:
    QList<QNetworkCookie> cookiesForUrl(const QUrl &) const override { return {}; }
    bool setCookiesFromUrl(const QList<QNetworkCookie> &, const QUrl &) override { return false; }
};

bool isTransportError(QNetworkReply::NetworkError error)
{
    // 1-99 network layer, 101-199 proxy, 399 protocol failure. The 2xx/4xx codes mirror HTTP statuses.
    const int code = int(error);
    return (code >= 1 && code <= 199) || error == QNetworkReply::ProtocolFailure;
}

bool validHeader(const QByteArray &value)
{
    for (const char ch : value) {
        const auto c = static_cast<unsigned char>(ch);
        if (!(c == '\t' || (c >= 0x20 && c < 0x7f)))
            return false;
    }
    return true;
}
}   // namespace

QtHttpClient::QtHttpClient(const std::atomic<bool> *stop)
    : connectTimeoutMs(kConnectTimeoutMs), requestTimeoutMs(kRequestTimeoutMs),
      m_manager(std::make_unique<QNetworkAccessManager>()), m_stop(stop)
{
    m_manager->setCookieJar(new NoCookieJar);   // the manager takes ownership
    m_manager->setRedirectPolicy(QNetworkRequest::NoLessSafeRedirectPolicy);
    m_manager->setAutoDeleteReplies(false);
}

QtHttpClient::~QtHttpClient()
{
    m_manager.reset();
    QCoreApplication::sendPostedEvents(nullptr, QEvent::DeferredDelete);
}

HttpResponse QtHttpClient::send(const HttpRequest &request)
{
    HttpResponse response;
    for (const auto &header : request.headers) {
        if (!validHeader(header.second))
            return response;   // reqwest reports an invalid header value as a send() error
    }
    if (m_stop && m_stop->load())
        return response;

    QNetworkRequest networkRequest(request.url);
    networkRequest.setAttribute(QNetworkRequest::Http2AllowedAttribute, false);
    networkRequest.setAttribute(QNetworkRequest::CacheLoadControlAttribute, QNetworkRequest::AlwaysNetwork);
    networkRequest.setAttribute(QNetworkRequest::CacheSaveControlAttribute, false);
    networkRequest.setMaximumRedirectsAllowed(10);
    networkRequest.setRawHeader("User-Agent", kUserAgent);
    networkRequest.setRawHeader("Accept", "*/*");
    // reqwest (without its gzip feature) asks for no encoding; Qt would ask for gzip and inflate it.
    networkRequest.setRawHeader("Accept-Encoding", "identity");
    for (const auto &header : request.headers)
        networkRequest.setRawHeader(header.first, header.second);

    QNetworkReply *reply = nullptr;
    if (request.method == "GET" && !request.hasBody)
        reply = m_manager->get(networkRequest);
    else if (request.hasBody)
        reply = m_manager->sendCustomRequest(networkRequest, request.method, request.body);
    else
        reply = m_manager->sendCustomRequest(networkRequest, request.method);

    const qint64 limit = request.maxBodyBytes + 1;
    bool timedOut = false;
    bool interrupted = false;
    bool cut = false;
    bool tooManyRedirects = false;
    QByteArray body;

    QEventLoop loop;
    QTimer connectTimer;
    connectTimer.setSingleShot(true);
    QTimer totalTimer;
    totalTimer.setSingleShot(true);
    QTimer stopPoll;

    const auto abortWith = [&](bool &flag) {
        flag = true;
        reply->abort();
    };
    const auto readBody = [&] {
        connectTimer.stop();
        if (cut)
            return;
        const qint64 room = limit - body.size();
        if (room > 0)
            body.append(reply->read(room));
        if (body.size() >= limit && body.size() > request.maxBodyBytes)
            abortWith(cut);
    };
    QObject::connect(&connectTimer, &QTimer::timeout, reply, [&] { abortWith(timedOut); });
    QObject::connect(&totalTimer, &QTimer::timeout, reply, [&] { abortWith(timedOut); });
    QObject::connect(&stopPoll, &QTimer::timeout, reply, [&] {
        if (m_stop && m_stop->load())
            abortWith(interrupted);
    });
    // The connection is up once bytes go out or a response comes in.
    QObject::connect(reply, &QNetworkReply::requestSent, &connectTimer, &QTimer::stop);
    QObject::connect(reply, &QNetworkReply::encrypted, &connectTimer, &QTimer::stop);
    QObject::connect(reply, &QNetworkReply::uploadProgress, &connectTimer, [&](qint64 sent, qint64) {
        if (sent > 0)
            connectTimer.stop();
    });
    QObject::connect(reply, &QNetworkReply::metaDataChanged, reply, [&] {
        connectTimer.stop();
        // A declared length past the bound is "too large" without downloading it.
        const QVariant length = reply->header(QNetworkRequest::ContentLengthHeader);
        if (length.isValid() && length.toLongLong() > request.maxBodyBytes &&
            reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).isValid())
            abortWith(cut);
    });
    QObject::connect(reply, &QNetworkReply::readyRead, reply, readBody);
    QObject::connect(reply, &QNetworkReply::errorOccurred, reply, [&](QNetworkReply::NetworkError error) {
        if (error == QNetworkReply::TooManyRedirectsError || error == QNetworkReply::InsecureRedirectError)
            tooManyRedirects = true;
    });
    QObject::connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);

    connectTimer.start(connectTimeoutMs);
    totalTimer.start(requestTimeoutMs);
    if (m_stop)
        stopPoll.start(100);
    if (!reply->isFinished())
        loop.exec(QEventLoop::ExcludeUserInputEvents);
    connectTimer.stop();
    totalTimer.stop();
    stopPoll.stop();
    if (!cut && !timedOut && !interrupted)
        readBody();   // whatever arrived with finished()

    const QVariant status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute);
    if (status.isValid() && !tooManyRedirects) {
        response.received = true;
        response.status = status.toInt();
        for (const auto &pair : reply->rawHeaderPairs()) {
            const QByteArray name = pair.first.toLower();
            if (!response.headers.contains(name))
                response.headers.insert(name, pair.second.trimmed());
        }
        if (const auto length = response.header("content-length")) {
            bool ok = false;
            const qint64 value = length->toLongLong(&ok);
            if (ok && value >= 0)
                response.contentLength = value;
        }
        response.body = body;
        response.bodyCut = cut;
        response.bodyFailed = !cut && (timedOut || interrupted || isTransportError(reply->error()));
    }
    reply->disconnect();
    delete reply;
    return response;
}

}   // namespace community
