#pragma once

// A tiny HTTP/1.1 server for the tests: it parses one request per connection, answers through a
// handler and closes the connection. It runs on the thread that owns it (the test's), so whoever talks
// to it from the same thread must spin that thread's event loop (QtHttpClient does).

#include <QByteArray>
#include <QHash>
#include <QMutex>
#include <QTcpServer>
#include <QTcpSocket>
#include <QVector>

#include <functional>

struct MockRequest {
    QByteArray method;
    QByteArray target;   // path and query, as sent
    QHash<QByteArray, QByteArray> headers;   // lower-case names
    QByteArray body;
};

struct MockReply {
    int status = 200;
    QVector<QPair<QByteArray, QByteArray>> headers;
    QByteArray body;
    bool hang = false;           // accept the request and never answer
    bool hangAfterHeaders = false;   // send the headers (with a Content-Length) and stall the body
    bool omitContentLength = false;
};

class MockHttpServer : public QTcpServer
{
public:
    std::function<MockReply(const MockRequest &)> handler;

    MockHttpServer()
    {
        listen(QHostAddress::LocalHost, 0);
        connect(this, &QTcpServer::newConnection, this, [this] {
            while (QTcpSocket *socket = nextPendingConnection()) {
                connect(socket, &QTcpSocket::readyRead, socket, [this, socket] { onData(socket); });
                connect(socket, &QTcpSocket::disconnected, socket, &QObject::deleteLater);
            }
        });
    }

    QByteArray base() const { return "http://127.0.0.1:" + QByteArray::number(serverPort()); }

    QVector<MockRequest> requests() const
    {
        QMutexLocker locker(&m_mutex);
        return m_requests;
    }
    void clearRequests()
    {
        QMutexLocker locker(&m_mutex);
        m_requests.clear();
    }

private:
    void onData(QTcpSocket *socket)
    {
        QByteArray &buffer = m_buffers[socket];
        buffer += socket->readAll();
        const int end = buffer.indexOf("\r\n\r\n");
        if (end < 0)
            return;
        MockRequest request;
        const QList<QByteArray> lines = buffer.left(end).split('\n');
        const QList<QByteArray> first = lines.value(0).trimmed().split(' ');
        request.method = first.value(0);
        request.target = first.value(1);
        for (int i = 1; i < lines.size(); ++i) {
            const int colon = lines[i].indexOf(':');
            if (colon > 0)
                request.headers.insert(lines[i].left(colon).trimmed().toLower(), lines[i].mid(colon + 1).trimmed());
        }
        const int length = request.headers.value("content-length", "0").toInt();
        if (buffer.size() < end + 4 + length)
            return;
        request.body = buffer.mid(end + 4, length);
        m_buffers.remove(socket);
        {
            QMutexLocker locker(&m_mutex);
            m_requests.append(request);
        }
        const MockReply reply = handler ? handler(request) : MockReply{404, {}, {}};
        if (reply.hang)
            return;
        QByteArray out = "HTTP/1.1 " + QByteArray::number(reply.status) + " X\r\n";
        for (const auto &header : reply.headers)
            out += header.first + ": " + header.second + "\r\n";
        if (!reply.omitContentLength)
            out += "Content-Length: " + QByteArray::number(reply.body.size()) + "\r\n";
        out += "Connection: close\r\n\r\n";
        if (reply.hangAfterHeaders) {
            socket->write(out + reply.body.left(reply.body.size() / 2));
            socket->flush();
            return;
        }
        socket->write(out + reply.body);
        socket->flush();
        socket->disconnectFromHost();
    }

    QHash<QTcpSocket *, QByteArray> m_buffers;
    mutable QMutex m_mutex;
    QVector<MockRequest> m_requests;
};
