#pragma once

// The uploader's HTTP client: a blocking request on the calling (worker) thread, as reqwest's blocking
// client does in the Tauri Dial. It runs a local event loop around a QNetworkAccessManager owned by the
// calling thread, so it must not be used on the GUI thread.
//
// Matched to the reqwest client of community_upload.rs: 5 s to connect, 15 s for the whole request,
// User-Agent meticulous-dial-community-upload-v1, HTTP/1.1, no cookies, no compression, bodies read up
// to a bound (the caller decides what is too large).

#include <QByteArray>
#include <QHash>
#include <QUrl>
#include <QVector>

#include <atomic>
#include <memory>
#include <optional>

class QNetworkAccessManager;

namespace community {

struct HttpRequest {
    QByteArray method = "GET";
    QUrl url;
    QVector<QPair<QByteArray, QByteArray>> headers;
    QByteArray body;
    bool hasBody = false;
    // Read at most this many body bytes (+1, to tell "too large" apart); longer bodies are cut.
    qint64 maxBodyBytes = 0;
};

struct HttpResponse {
    // false: the request failed before a response arrived (DNS, connect, TLS, timeout): reqwest's
    // send() error.
    bool received = false;
    int status = 0;
    QHash<QByteArray, QByteArray> headers;   // lower-case names, first value
    std::optional<qint64> contentLength;
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
    ~QtHttpClient() override;
    HttpResponse send(const HttpRequest &request) override;

    // Timeouts, changeable for the tests.
    int connectTimeoutMs;
    int requestTimeoutMs;

private:
    std::unique_ptr<QNetworkAccessManager> m_manager;
    const std::atomic<bool> *m_stop;
};

}   // namespace community
