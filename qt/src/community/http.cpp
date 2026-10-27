#include "http.h"

#include "model.h"

#include <QElapsedTimer>
#include <QEventLoop>
#include <QList>
#include <QNetworkProxy>
#include <QSslConfiguration>
#include <QSslSocket>
#include <QTcpSocket>
#include <QTimer>

#include <algorithm>
#include <cstring>
#include <initializer_list>
#include <limits>
#include <memory>

namespace community {

std::optional<QByteArray> HttpResponse::header(const QByteArray &lowerName) const
{
    const auto it = headers.constFind(lowerName);
    if (it == headers.constEnd())
        return std::nullopt;
    return it.value();
}

namespace {
using HeaderList = QVector<QPair<QByteArray, QByteArray>>;

constexpr int kMaxRedirects = 10;                      // reqwest's redirect::Policy::default()
constexpr int kMaxHeaders = 100;                       // hyper's default
constexpr qint64 kMaxHeadBytes = 8192 + 4096 * 100;    // hyper's default read buffer
constexpr qint64 kMaxChunkLine = 4096;

// http::HeaderValue::from_str: visible ASCII, space and tab. reqwest reports another value as a send()
// error.
bool validHeader(const QByteArray &value)
{
    for (const char ch : value) {
        const auto c = static_cast<unsigned char>(ch);
        if (!(c == '\t' || (c >= 0x20 && c < 0x7f)))
            return false;
    }
    return true;
}

// RFC 9110 token characters (httparse's header names).
bool isToken(const QByteArray &name)
{
    if (name.isEmpty())
        return false;
    for (const char c : name) {
        const bool alnum = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
        if (!alnum && !std::strchr("!#$%&'*+-.^_`|~", c))
            return false;
    }
    return true;
}

std::optional<qint64> parseDigits(const QByteArray &text, int base)
{
    if (text.isEmpty())
        return std::nullopt;
    qint64 value = 0;
    for (const char c : text) {
        int digit = -1;
        if (c >= '0' && c <= '9')
            digit = c - '0';
        else if (base == 16 && c >= 'a' && c <= 'f')
            digit = c - 'a' + 10;
        else if (base == 16 && c >= 'A' && c <= 'F')
            digit = c - 'A' + 10;
        if (digit < 0)
            return std::nullopt;
        if (value > (std::numeric_limits<qint64>::max() - digit) / base)
            return std::nullopt;
        value = value * base + digit;
    }
    return value;
}

int defaultPort(const QUrl &url)
{
    if (url.scheme() == QLatin1String("https"))
        return 443;
    if (url.scheme() == QLatin1String("http"))
        return 80;
    return -1;
}

// The host header (and the authority of the url crate's serialization): the port only when it is not
// the scheme's default.
QByteArray authority(const QUrl &url)
{
    QByteArray host = url.host(QUrl::FullyEncoded).toLatin1();
    if (host.contains(':'))
        host = '[' + host + ']';
    const int port = url.port();
    if (port != -1 && port != defaultPort(url))
        host += ':' + QByteArray::number(port);
    return host;
}

QByteArray originForm(const QUrl &url)
{
    QByteArray target = url.path(QUrl::FullyEncoded).toLatin1();
    if (target.isEmpty())
        target = "/";
    if (url.hasQuery())
        target += '?' + url.query(QUrl::FullyEncoded).toLatin1();
    return target;
}

// The hop's URL as the url crate serializes it (no user info, no fragment): the base a Location resolves
// against and the Referer of the next hop.
QByteArray absoluteUrl(const QUrl &url, const QByteArray &target)
{
    return url.scheme().toLatin1() + "://" + authority(url) + target;
}

void removeHeaders(HeaderList &headers, std::initializer_list<const char *> names)
{
    headers.erase(std::remove_if(headers.begin(), headers.end(),
                                 [&](const QPair<QByteArray, QByteArray> &header) {
                                     return std::any_of(names.begin(), names.end(),
                                                        [&](const char *name) { return header.first == name; });
                                 }),
                  headers.end());
}

bool hasHeader(const HeaderList &headers, const char *name)
{
    return std::any_of(headers.begin(), headers.end(),
                       [&](const QPair<QByteArray, QByteArray> &header) { return header.first == name; });
}
}   // namespace

// --- the response reader --------------------------------------------------------------------------

HttpResponseReader::HttpResponseReader(bool headRequest, qint64 maxBodyBytes)
    : m_headRequest(headRequest), m_maxBodyBytes(maxBodyBytes)
{
}

void HttpResponseReader::feed(const QByteArray &data)
{
    if (m_state == State::Done || m_state == State::Failed)
        return;
    m_buffer += data;
    while (m_state == State::Head ? readHead() : (m_state == State::Body && readBody())) {
    }
}

void HttpResponseReader::endOfStream()
{
    if (m_state == State::Body && m_framing == Framing::Close)
        m_state = State::Done;
    else if (m_state == State::Head || m_state == State::Body)
        m_state = State::Failed;
}

HttpResponse HttpResponseReader::result() const
{
    if (!m_response.received)
        return HttpResponse();
    HttpResponse response = m_response;
    if (m_state != State::Done)
        response.bodyFailed = true;   // timed out, stopped or the connection failed in the body
    return response;
}

bool HttpResponseReader::readHead()
{
    // The head ends at the first empty line; httparse takes LF line ends as well as CRLF.
    int end = -1;
    int skip = 0;
    for (int i = 0; i + 1 < m_buffer.size() && i <= kMaxHeadBytes; ++i) {
        if (m_buffer[i] != '\n')
            continue;
        if (m_buffer[i + 1] == '\n') {
            end = i;
            skip = 2;
            break;
        }
        if (i + 2 < m_buffer.size() && m_buffer[i + 1] == '\r' && m_buffer[i + 2] == '\n') {
            end = i;
            skip = 3;
            break;
        }
    }
    if (end < 0) {
        if (m_buffer.size() > kMaxHeadBytes)
            m_state = State::Failed;   // hyper: message head is too large
        return false;
    }
    QList<QByteArray> lines = m_buffer.left(end).split('\n');
    m_buffer.remove(0, end + skip);
    for (QByteArray &line : lines) {
        if (line.endsWith('\r'))
            line.chop(1);
    }
    const auto fail = [this] {
        m_state = State::Failed;
        return false;
    };
    // HTTP/1.x SP 3DIGIT [SP reason-phrase]
    const QByteArray &statusLine = lines.first();
    if (!(statusLine.startsWith("HTTP/1.1 ") || statusLine.startsWith("HTTP/1.0 ")) || statusLine.size() < 12 ||
        (statusLine.size() > 12 && statusLine[12] != ' '))
        return fail();
    const auto status = parseDigits(statusLine.mid(9, 3), 10);
    if (!status || *status < 100)
        return fail();
    if (lines.size() - 1 > kMaxHeaders)
        return fail();
    QHash<QByteArray, QByteArray> headers;
    QList<QByteArray> contentLengths;
    QByteArray transferEncoding;
    for (int i = 1; i < lines.size(); ++i) {
        const QByteArray &line = lines[i];
        const int colon = line.indexOf(':');
        if (colon <= 0 || !isToken(line.left(colon)))
            return fail();   // obs-fold, no colon, a bad name
        const QByteArray name = line.left(colon).toLower();
        const QByteArray value = line.mid(colon + 1).trimmed();
        if (!headers.contains(name))
            headers.insert(name, value);
        if (name == "content-length")
            contentLengths += value.split(',');
        else if (name == "transfer-encoding")
            transferEncoding += (transferEncoding.isEmpty() ? "" : ",") + value;
    }
    const int code = int(*status);
    if (code < 200 && code != 101)
        return true;   // an interim response (100 Continue, 103): hyper reads on to the final one

    if (m_headRequest || code < 200 || code == 204 || code == 304) {
        m_framing = Framing::None;
    } else if (!transferEncoding.isEmpty()) {
        m_framing = transferEncoding.split(',').last().trimmed().toLower() == "chunked" ? Framing::Chunked
                                                                                         : Framing::Close;
    } else if (!contentLengths.isEmpty()) {
        std::optional<qint64> length;
        for (const QByteArray &text : contentLengths) {
            const auto value = parseDigits(text.trimmed(), 10);
            if (!value || (length && *length != *value))
                return fail();   // hyper rejects an invalid or contradictory Content-Length
            length = value;
        }
        m_framing = Framing::Length;
        m_remaining = *length;
    } else {
        m_framing = Framing::Close;
    }
    m_response.received = true;
    m_response.status = code;
    m_response.headers = headers;
    if (m_framing == Framing::None)
        m_response.contentLength = 0;
    else if (m_framing == Framing::Length)
        m_response.contentLength = m_remaining;
    if (m_framing == Framing::Length && m_remaining > m_maxBodyBytes) {
        m_response.bodyCut = true;   // a declared length past the bound: too large without downloading it
        m_state = State::Done;
        return false;
    }
    if (m_framing == Framing::None || (m_framing == Framing::Length && m_remaining == 0)) {
        m_state = State::Done;
        return false;
    }
    m_state = State::Body;
    return true;
}

bool HttpResponseReader::readBody()
{
    if (m_framing == Framing::Length) {
        const qint64 take = std::min<qint64>(m_remaining, m_buffer.size());
        appendBody(m_buffer.left(int(take)));
        m_buffer.remove(0, int(take));
        m_remaining -= take;
        if (m_state == State::Body && m_remaining == 0)
            m_state = State::Done;
        return false;
    }
    if (m_framing == Framing::Close) {
        appendBody(m_buffer);
        m_buffer.clear();
        return false;
    }
    // Chunked.
    const auto line = [this](QByteArray *out) {
        const int newline = m_buffer.indexOf('\n');
        if (newline < 0) {
            if (m_buffer.size() > kMaxChunkLine)
                m_state = State::Failed;
            return false;
        }
        *out = m_buffer.left(newline);
        m_buffer.remove(0, newline + 1);
        if (out->endsWith('\r'))
            out->chop(1);
        return true;
    };
    switch (m_chunk) {
    case Chunk::Size: {
        QByteArray size;
        if (!line(&size))
            return false;
        const int extension = size.indexOf(';');
        const auto value = parseDigits((extension < 0 ? size : size.left(extension)).trimmed(), 16);
        if (!value) {
            m_state = State::Failed;
            return false;
        }
        m_remaining = *value;
        m_chunk = m_remaining == 0 ? Chunk::Trailer : Chunk::Data;
        return true;
    }
    case Chunk::Data: {
        const qint64 take = std::min<qint64>(m_remaining, m_buffer.size());
        if (take == 0)
            return false;
        appendBody(m_buffer.left(int(take)));
        m_buffer.remove(0, int(take));
        m_remaining -= take;
        if (m_state != State::Body || m_remaining > 0)
            return false;
        m_chunk = Chunk::DataEnd;
        return true;
    }
    case Chunk::DataEnd:
        if (m_buffer.startsWith("\r\n")) {
            m_buffer.remove(0, 2);
        } else if (m_buffer.startsWith('\n')) {
            m_buffer.remove(0, 1);
        } else {
            if (!(m_buffer.isEmpty() || m_buffer == "\r"))
                m_state = State::Failed;
            return false;
        }
        m_chunk = Chunk::Size;
        return true;
    case Chunk::Trailer: {
        QByteArray trailer;
        if (!line(&trailer))
            return false;
        if (trailer.isEmpty()) {
            m_state = State::Done;
            return false;
        }
        return true;   // a trailer field: ignored, as reqwest does
    }
    }
    return false;
}

void HttpResponseReader::appendBody(const QByteArray &data)
{
    const qint64 room = m_maxBodyBytes + 1 - m_response.body.size();
    if (room > 0)
        m_response.body += data.left(int(std::min<qint64>(room, data.size())));
    if (m_response.body.size() > m_maxBodyBytes) {
        m_response.bodyCut = true;
        m_state = State::Done;
    }
}

// --- the client -------------------------------------------------------------------------------------

struct QtHttpClient::Hop {
    QUrl url;
    QByteArray target;
    QByteArray method;
    HeaderList headers;   // lower-case names
    QByteArray body;
    bool hasBody = false;
};

QtHttpClient::QtHttpClient(const std::atomic<bool> *stop)
    : connectTimeoutMs(kConnectTimeoutMs), requestTimeoutMs(kRequestTimeoutMs), m_stop(stop)
{
}

HttpResponse QtHttpClient::send(const HttpRequest &request)
{
    for (const auto &header : request.headers) {
        if (!validHeader(header.second))
            return HttpResponse();
    }
    if (m_stop && m_stop->load())
        return HttpResponse();
    QElapsedTimer clock;
    clock.start();

    Hop hop;
    hop.url = request.url;
    hop.target = request.target.isEmpty() ? originForm(request.url) : request.target;
    hop.method = request.method;
    hop.body = request.body;
    hop.hasBody = request.hasBody;
    for (const auto &header : request.headers)
        hop.headers.append({header.first.toLower(), header.second});
    // tower-http 0.6's FollowRedirect: every hop starts from the original headers (without the payload
    // ones once the body is dropped); the cross-host and Referer changes apply to that hop only.
    HeaderList carried = hop.headers;
    int redirects = 0;
    for (;;) {
        const QString scheme = hop.url.scheme();
        if ((scheme != QLatin1String("http") && scheme != QLatin1String("https")) || hop.url.host().isEmpty())
            return HttpResponse();
        const HttpResponse response = exchange(hop, request.maxBodyBytes, requestTimeoutMs - clock.elapsed());
        const int status = response.status;
        if (!response.received || !(status == 301 || status == 302 || status == 303 || status == 307 || status == 308))
            return response;

        Hop next = hop;
        if (((status == 301 || status == 302) && hop.method == "POST") || status == 303) {
            if (hop.method != "HEAD")
                next.method = "GET";
            next.body.clear();
            next.hasBody = false;
            removeHeaders(carried, {"content-type", "content-length", "content-encoding", "transfer-encoding"});
        }
        const auto location = response.header("location");
        if (!location)
            return response;
        const QUrl resolved = QUrl::fromEncoded(absoluteUrl(hop.url, hop.target)).resolved(QUrl::fromEncoded(*location));
        if (!resolved.isValid() || resolved.host().isEmpty())
            return response;   // reqwest returns the redirect itself when the Location is unusable
        if (++redirects > kMaxRedirects)
            return HttpResponse();   // TooManyRedirects
        if (resolved.scheme() != QLatin1String("http") && resolved.scheme() != QLatin1String("https"))
            return HttpResponse();   // url_bad_scheme
        next.url = resolved;
        next.target = originForm(resolved);
        next.headers = carried;
        if (resolved.host() != hop.url.host() || resolved.port(defaultPort(resolved)) != hop.url.port(defaultPort(hop.url)))
            removeHeaders(next.headers, {"authorization", "cookie", "cookie2", "proxy-authorization", "www-authenticate"});
        if (!(resolved.scheme() == QLatin1String("http") && scheme == QLatin1String("https"))) {
            removeHeaders(next.headers, {"referer"});
            next.headers.append({"referer", absoluteUrl(hop.url, hop.target)});
        }
        hop = next;
    }
}

HttpResponse QtHttpClient::exchange(const Hop &hop, qint64 maxBodyBytes, qint64 remainingMs)
{
    if (remainingMs <= 0 || (m_stop && m_stop->load()))
        return HttpResponse();
    const bool tls = hop.url.scheme() == QLatin1String("https");
    std::unique_ptr<QTcpSocket> socket(tls ? new QSslSocket : new QTcpSocket);
    socket->setProxy(QNetworkProxy::NoProxy);
    if (tls) {
        auto *ssl = static_cast<QSslSocket *>(socket.get());
        QSslConfiguration configuration = ssl->sslConfiguration();   // the system CA store
        configuration.setProtocol(QSsl::TlsV1_2OrLater);
        configuration.setPeerVerifyMode(QSslSocket::VerifyPeer);
        configuration.setAllowedNextProtocols({QByteArray(QSslConfiguration::NextProtocolHttp1_1)});
        ssl->setSslConfiguration(configuration);
    }

    // What hyper writes for reqwest: the request's headers, content-length, the client's defaults, host.
    QByteArray wire = hop.method + ' ' + hop.target + " HTTP/1.1\r\n";
    for (const auto &header : hop.headers)
        wire += header.first + ": " + header.second + "\r\n";
    if (hop.hasBody && !hasHeader(hop.headers, "content-length"))
        wire += "content-length: " + QByteArray::number(hop.body.size()) + "\r\n";
    if (!hasHeader(hop.headers, "accept"))
        wire += "accept: */*\r\n";
    if (!hasHeader(hop.headers, "user-agent"))
        wire += QByteArray("user-agent: ") + kUserAgent + "\r\n";
    if (!hasHeader(hop.headers, "host"))
        wire += "host: " + authority(hop.url) + "\r\n";
    wire += "\r\n";
    if (hop.hasBody)
        wire += hop.body;

    HttpResponseReader reader(hop.method == "HEAD", maxBodyBytes);
    bool over = false;
    QEventLoop loop;
    QTimer connectTimer;
    connectTimer.setSingleShot(true);
    QTimer totalTimer;
    totalTimer.setSingleShot(true);
    QTimer stopPoll;
    const auto end = [&] {
        if (!over) {
            over = true;
            loop.quit();
        }
    };
    const auto read = [&] {
        if (over)
            return;
        reader.feed(socket->readAll());
        if (reader.done() || reader.failed())
            end();
    };
    // The end of the connection: whatever arrived with it first. A request that got no answer is a
    // send() error; it is never written again.
    const auto closed = [&] {
        if (over)
            return;
        reader.feed(socket->readAll());
        reader.endOfStream();
        end();
    };
    const auto connected = [&] {
        connectTimer.stop();
        socket->write(wire);
    };
    QObject::connect(socket.get(), &QIODevice::readyRead, &loop, read);
    if (tls)
        QObject::connect(static_cast<QSslSocket *>(socket.get()), &QSslSocket::encrypted, &loop, connected);
    else
        QObject::connect(socket.get(), &QAbstractSocket::connected, &loop, connected);
    QObject::connect(socket.get(), &QAbstractSocket::disconnected, &loop, closed);
    QObject::connect(socket.get(), &QAbstractSocket::errorOccurred, &loop, [&](QAbstractSocket::SocketError error) {
        if (error == QAbstractSocket::RemoteHostClosedError)
            closed();
        else
            end();   // refused, unreachable, TLS handshake or a reset: no answer, or the body failed
    });
    QObject::connect(&connectTimer, &QTimer::timeout, &loop, end);
    QObject::connect(&totalTimer, &QTimer::timeout, &loop, end);
    QObject::connect(&stopPoll, &QTimer::timeout, &loop, [&] {
        if (m_stop->load())
            end();
    });

    connectTimer.start(int(std::min<qint64>(connectTimeoutMs, remainingMs)));
    totalTimer.start(int(std::min<qint64>(remainingMs, std::numeric_limits<int>::max())));
    if (m_stop)
        stopPoll.start(100);
    const quint16 port = quint16(hop.url.port(defaultPort(hop.url)));
    if (tls)
        static_cast<QSslSocket *>(socket.get())->connectToHostEncrypted(hop.url.host(), port);
    else
        socket->connectToHost(hop.url.host(), port);
    if (!over)
        loop.exec(QEventLoop::ExcludeUserInputEvents);
    connectTimer.stop();
    totalTimer.stop();
    stopPoll.stop();
    socket->disconnect();
    socket->abort();
    return reader.result();
}

}   // namespace community
