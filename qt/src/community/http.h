#pragma once

// The uploader's HTTP client: a blocking request on the calling (worker) thread, as reqwest's blocking
// client does in the Tauri Dial. It runs a local event loop around a QTcpSocket / QSslSocket owned by
// the calling thread, so it must not be used on the GUI thread.
//
// HTTP/1.1 written here rather than through QNetworkAccessManager, so the requests are the ones reqwest
// (0.12, hyper 1, tower-http 0.6 redirects) puts on the wire, which the Community contract test
// (qt/tests/community-contract) compares byte for byte:
// - the request's headers (names in lower case), content-length, then reqwest's accept: */* and
//   user-agent: meticulous-dial-community-upload-v1, then host; nothing else (QNetworkAccessManager
//   always adds Connection, Accept-Language and Accept-Encoding, and Cache-Control/Pragma on GETs);
// - the request target exactly as the caller built it (QUrl would re-encode | and ^, and decode %7E);
// - a request that was written is never sent again: QNetworkAccessManager resends it, nonce and
//   signature included, when the server closes the connection before answering (hyper reports an
//   error, the uploader backs off and signs a new request);
// - redirects as reqwest follows them (at most 10; 301/302 turn a POST into a GET, 303 anything into a
//   GET, both without the body and its headers; 307/308 keep both; a Referer; no Authorization to
//   another host or port).
// 5 s to connect (TCP and TLS), 15 s for the whole request including the body, TLS 1.2+ with the system
// CA store and ALPN http/1.1, no proxy, no cookies, no compression, one connection per request, bodies
// read up to a bound (the caller decides what is too large).

#include <QByteArray>
#include <QHash>
#include <QUrl>
#include <QVector>

#include <atomic>
#include <optional>

namespace community {

struct HttpRequest {
    QByteArray method = "GET";
    QUrl url;   // scheme, host and port; also the path and query when target is empty
    // The origin-form target (path and query) exactly as sent; empty: url's path and query.
    QByteArray target;
    QVector<QPair<QByteArray, QByteArray>> headers;
    QByteArray body;
    bool hasBody = false;
    // Read at most this many body bytes (+1, to tell "too large" apart); longer bodies are cut.
    qint64 maxBodyBytes = 0;
};

struct HttpResponse {
    // false: the request failed before a response arrived (DNS, connect, TLS, timeout, the connection
    // closed before an answer, too many redirects): reqwest's send() error.
    bool received = false;
    int status = 0;
    QHash<QByteArray, QByteArray> headers;   // lower-case names, first value
    std::optional<qint64> contentLength;     // reqwest's content_length(): a Content-Length body, 0 for none
    QByteArray body;                         // at most maxBodyBytes + 1 bytes
    bool bodyFailed = false;                 // the connection failed while reading the body
    bool bodyCut = false;                    // the body was longer than maxBodyBytes + 1

    bool isSuccess() const { return status >= 200 && status < 300; }
    std::optional<QByteArray> header(const QByteArray &lowerName) const;
};

class HttpClient
{
public:
    virtual ~HttpClient() = default;
    virtual HttpResponse send(const HttpRequest &request) = 0;
};

class QtHttpClient final : public HttpClient
{
public:
    // stop: when it becomes true the request in flight is aborted (application shutdown).
    explicit QtHttpClient(const std::atomic<bool> *stop = nullptr);
    HttpResponse send(const HttpRequest &request) override;

    // Timeouts, changeable for the tests.
    int connectTimeoutMs;
    int requestTimeoutMs;

private:
    struct Hop;
    HttpResponse exchange(const Hop &hop, qint64 maxBodyBytes, qint64 deadlineMs);

    const std::atomic<bool> *m_stop;
};

// The HTTP/1.1 response reader of QtHttpClient (public for the unit tests): status line and headers as
// hyper accepts them, then the body by Content-Length, chunked or up to the end of the connection.
class HttpResponseReader
{
public:
    HttpResponseReader(bool headRequest, qint64 maxBodyBytes);
    void feed(const QByteArray &data);
    void endOfStream();   // the server closed the connection
    // Done: the response is complete, or cut at the bound. Otherwise the caller ends it with
    // result(): before the head it was not received, after it the body failed.
    bool done() const { return m_state == State::Done; }
    bool failed() const { return m_state == State::Failed; }
    HttpResponse result() const;

private:
    enum class State { Head, Body, Done, Failed };
    enum class Framing { None, Length, Chunked, Close };
    enum class Chunk { Size, Data, DataEnd, Trailer };
    bool readHead();
    bool readBody();
    void appendBody(const QByteArray &data);

    const bool m_headRequest;
    const qint64 m_maxBodyBytes;
    State m_state = State::Head;
    Framing m_framing = Framing::None;
    Chunk m_chunk = Chunk::Size;
    qint64 m_remaining = 0;
    QByteArray m_buffer;
    HttpResponse m_response;
};

}   // namespace community
