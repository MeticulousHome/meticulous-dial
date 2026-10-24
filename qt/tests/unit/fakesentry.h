#pragma once

// A local stand-in for Sentry for the tests: an HTTP server on 127.0.0.1 that accepts envelopes
// (POST /api/<project>/envelope/), records them and answers 200. It runs on its own thread, so a test can
// block in QProcess::waitForFinished while a child process reports to it. stop() closes the port (a send
// then fails as on a machine without network); start(port) opens the same port again.

#include <QElapsedTimer>
#include <QHash>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMutex>
#include <QPointer>
#include <QTcpServer>
#include <QTcpSocket>
#include <QThread>
#include <QVector>

#include <functional>

struct SentryItem {
    QJsonObject header;
    QByteArray payload;
    QString type() const { return header.value(QStringLiteral("type")).toString(); }
    QJsonObject json() const { return QJsonDocument::fromJson(payload).object(); }
};

struct SentryEnvelope {
    QByteArray body;   // as received
    QByteArray target;
    QHash<QByteArray, QByteArray> headers;
    QJsonObject header;
    QVector<SentryItem> items;

    const SentryItem *item(const QString &type) const
    {
        for (const SentryItem &i : items) {
            if (i.type() == type)
                return &i;
        }
        return nullptr;
    }
    QJsonObject event() const
    {
        const SentryItem *i = item(QStringLiteral("event"));
        return i ? i->json() : QJsonObject();
    }
    const SentryItem *minidump() const
    {
        for (const SentryItem &i : items) {
            if (i.type() == QLatin1String("attachment")
                && i.header.value(QStringLiteral("attachment_type")).toString() == QLatin1String("event.minidump"))
                return &i;
        }
        return nullptr;
    }
};

// The envelope format: a header line, then items (a header line with an optional length, the payload, '\n').
inline SentryEnvelope parseSentryEnvelope(const QByteArray &body)
{
    SentryEnvelope envelope;
    qsizetype pos = body.indexOf('\n');
    if (pos < 0)
        return envelope;
    envelope.header = QJsonDocument::fromJson(body.left(pos)).object();
    ++pos;
    while (pos < body.size()) {
        const qsizetype end = body.indexOf('\n', pos);
        const QByteArray headerLine = body.mid(pos, end < 0 ? -1 : end - pos);
        if (headerLine.trimmed().isEmpty()) {
            pos = end < 0 ? body.size() : end + 1;
            continue;
        }
        SentryItem item;
        item.header = QJsonDocument::fromJson(headerLine).object();
        pos = end < 0 ? body.size() : end + 1;
        if (item.header.contains(QStringLiteral("length"))) {
            const qsizetype length = qsizetype(item.header.value(QStringLiteral("length")).toDouble());
            item.payload = body.mid(pos, length);
            pos += length;
            if (pos < body.size() && body.at(pos) == '\n')
                ++pos;
        } else {
            const qsizetype payloadEnd = body.indexOf('\n', pos);
            item.payload = body.mid(pos, payloadEnd < 0 ? -1 : payloadEnd - pos);
            pos = payloadEnd < 0 ? body.size() : payloadEnd + 1;
        }
        envelope.items.append(item);
    }
    return envelope;
}

class FakeSentry
{
public:
    FakeSentry()
    {
        m_context = new QObject;
        m_context->moveToThread(&m_thread);
        m_thread.start();
    }
    ~FakeSentry()
    {
        stop();
        QMetaObject::invokeMethod(m_context, [this] {
            delete m_server;
            m_server = nullptr;
        }, Qt::BlockingQueuedConnection);
        m_thread.quit();
        m_thread.wait();
        delete m_context;
    }

    // Listens on 127.0.0.1:port (0: any free port, kept for later starts).
    bool start(quint16 port = 0)
    {
        bool ok = false;
        QMetaObject::invokeMethod(m_context, [&] {
            if (!m_server) {
                m_server = new QTcpServer(m_context);
                QObject::connect(m_server, &QTcpServer::newConnection, m_context, [this] {
                    while (QTcpSocket *socket = m_server->nextPendingConnection()) {
                        m_sockets.append(socket);
                        QObject::connect(socket, &QTcpSocket::readyRead, socket, [this, socket] { onData(socket); });
                        QObject::connect(socket, &QTcpSocket::disconnected, socket, &QObject::deleteLater);
                    }
                });
            }
            ok = m_server->listen(QHostAddress::LocalHost, port ? port : m_port);
            if (ok)
                m_port = m_server->serverPort();
        }, Qt::BlockingQueuedConnection);
        return ok;
    }
    // Closes the port and drops open connections: a send fails as on a machine without network.
    void stop()
    {
        QMetaObject::invokeMethod(m_context, [this] {
            if (m_server)
                m_server->close();
            for (const QPointer<QTcpSocket> &socket : std::as_const(m_sockets)) {
                if (socket)
                    socket->abort();
            }
            m_sockets.clear();
        }, Qt::BlockingQueuedConnection);
    }

    quint16 port() const { return m_port; }
    QString dsn(int project = 8) const
    {
        return QStringLiteral("http://0123456789abcdef0123456789abcdef@127.0.0.1:%1/%2").arg(m_port).arg(project);
    }

    QVector<SentryEnvelope> envelopes() const
    {
        QMutexLocker locker(&m_mutex);
        return m_envelopes;
    }
    QVector<QJsonObject> events() const
    {
        QVector<QJsonObject> out;
        for (const SentryEnvelope &e : envelopes()) {
            if (e.item(QStringLiteral("event")))
                out.append(e.event());
        }
        return out;
    }
    int requests() const
    {
        QMutexLocker locker(&m_mutex);
        return m_requests;
    }
    void clear()
    {
        QMutexLocker locker(&m_mutex);
        m_envelopes.clear();
        m_requests = 0;
    }
    bool waitForEvents(int count, int timeoutMs) const
    {
        QElapsedTimer timer;
        timer.start();
        while (events().size() < count && timer.elapsed() < timeoutMs)
            QThread::msleep(20);
        return events().size() >= count;
    }

private:
    void onData(QTcpSocket *socket)
    {
        QByteArray &buffer = m_buffers[socket];
        buffer += socket->readAll();
        const qsizetype end = buffer.indexOf("\r\n\r\n");
        if (end < 0)
            return;
        const QList<QByteArray> lines = buffer.left(end).split('\n');
        const QList<QByteArray> first = lines.value(0).trimmed().split(' ');
        QHash<QByteArray, QByteArray> headers;
        for (int i = 1; i < lines.size(); ++i) {
            const qsizetype colon = lines[i].indexOf(':');
            if (colon > 0)
                headers.insert(lines[i].left(colon).trimmed().toLower(), lines[i].mid(colon + 1).trimmed());
        }
        if (headers.value("expect").toLower() == "100-continue" && !m_continued.contains(socket)) {
            m_continued.insert(socket, true);
            socket->write("HTTP/1.1 100 Continue\r\n\r\n");
            socket->flush();
        }
        const qsizetype length = headers.value("content-length", "0").toLongLong();
        if (buffer.size() < end + 4 + length)
            return;
        const QByteArray body = buffer.mid(end + 4, length);
        m_buffers.remove(socket);
        m_continued.remove(socket);
        {
            QMutexLocker locker(&m_mutex);
            ++m_requests;
            if (first.value(1).contains("/envelope/")) {
                SentryEnvelope envelope = parseSentryEnvelope(body);
                envelope.body = body;
                envelope.target = first.value(1);
                envelope.headers = headers;
                m_envelopes.append(envelope);
            }
        }
        const QByteArray reply = "{}";
        socket->write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                      + QByteArray::number(reply.size()) + "\r\nConnection: close\r\n\r\n" + reply);
        socket->flush();
        socket->disconnectFromHost();
    }

    QThread m_thread;
    QObject *m_context = nullptr;
    QTcpServer *m_server = nullptr;
    QVector<QPointer<QTcpSocket>> m_sockets;
    QHash<QTcpSocket *, QByteArray> m_buffers;
    QHash<QTcpSocket *, bool> m_continued;
    quint16 m_port = 0;
    mutable QMutex m_mutex;
    QVector<SentryEnvelope> m_envelopes;
    int m_requests = 0;
};
