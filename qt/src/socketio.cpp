#include "socketio.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QUrlQuery>

SocketIO::SocketIO(QObject *parent) : QObject(parent)
{
    m_reconnect.setSingleShot(true);
    connect(&m_reconnect, &QTimer::timeout, this, [this] {
        if (m_wanted && m_socket.state() == QAbstractSocket::UnconnectedState)
            m_socket.open(engineUrl());
    });

    // The server pings every pingInterval; without one for pingInterval + pingTimeout the link is dead.
    m_pingWatchdog.setSingleShot(true);
    connect(&m_pingWatchdog, &QTimer::timeout, this, [this] { m_socket.abort(); });

    connect(&m_socket, &QWebSocket::textMessageReceived, this, &SocketIO::onText);
    connect(&m_socket, &QWebSocket::disconnected, this, [this] {
        m_pingWatchdog.stop();
        setConnected(false);
        scheduleReconnect();
    });
    // Qt 6.4 names it error(); errorOccurred() came in 6.5.
    connect(&m_socket, QOverload<QAbstractSocket::SocketError>::of(&QWebSocket::error), this, [this](QAbstractSocket::SocketError) {
        if (m_socket.state() == QAbstractSocket::UnconnectedState)
            scheduleReconnect();
    });
}

void SocketIO::setUrl(const QUrl &url)
{
    if (url == m_url)
        return;
    m_url = url;
    emit urlChanged();
    if (m_wanted) {
        m_socket.abort();
        m_socket.open(engineUrl());
    }
}

QUrl SocketIO::engineUrl() const
{
    QUrl u = m_url;
    u.setScheme(m_url.scheme() == QLatin1String("https") ? QStringLiteral("wss") : QStringLiteral("ws"));
    u.setPath(QStringLiteral("/socket.io/"));
    QUrlQuery q;
    q.addQueryItem(QStringLiteral("EIO"), QStringLiteral("4"));
    q.addQueryItem(QStringLiteral("transport"), QStringLiteral("websocket"));
    u.setQuery(q);
    return u;
}

void SocketIO::open()
{
    m_wanted = true;
    if (m_socket.state() == QAbstractSocket::UnconnectedState)
        m_socket.open(engineUrl());
}

void SocketIO::close()
{
    m_wanted = false;
    m_reconnect.stop();
    m_socket.close();
}

void SocketIO::scheduleReconnect()
{
    if (!m_wanted || m_reconnect.isActive())
        return;
    m_reconnect.start(m_backoffMs);
    m_backoffMs = qMin(m_backoffMs * 2, 5000);
}

void SocketIO::setConnected(bool connected)
{
    if (connected == m_connected)
        return;
    m_connected = connected;
    emit connectedChanged();
    if (connected)
        emit connectedToServer();
    else
        emit disconnectedFromServer();
}

void SocketIO::emitEvent(const QString &name, const QVariant &data)
{
    if (!m_connected)
        return;
    QJsonArray packet{name};
    if (data.isValid())
        packet.append(QJsonValue::fromVariant(data));
    m_socket.sendTextMessage(QStringLiteral("42") + QString::fromUtf8(QJsonDocument(packet).toJson(QJsonDocument::Compact)));
}

void SocketIO::onText(const QString &message)
{
    if (message.isEmpty())
        return;
    const QChar engine = message.at(0);
    if (engine == QLatin1Char('0')) {
        // Engine.IO open: {"sid", "pingInterval", "pingTimeout"}; then join the default namespace.
        const QJsonObject open = QJsonDocument::fromJson(message.mid(1).toUtf8()).object();
        const int interval = open.value(QStringLiteral("pingInterval")).toInt(25000);
        const int timeout = open.value(QStringLiteral("pingTimeout")).toInt(20000);
        m_pingWatchdog.setInterval(interval + timeout);
        m_pingWatchdog.start();
        m_socket.sendTextMessage(QStringLiteral("40"));
        return;
    }
    if (engine == QLatin1Char('2')) {
        m_pingWatchdog.start();
        m_socket.sendTextMessage(QStringLiteral("3"));
        return;
    }
    if (engine == QLatin1Char('1')) {
        m_socket.abort();
        return;
    }
    if (engine != QLatin1Char('4') || message.size() < 2)
        return;

    const QChar kind = message.at(1);
    if (kind == QLatin1Char('0')) {
        m_backoffMs = 500;
        setConnected(true);
        return;
    }
    if (kind == QLatin1Char('1')) {
        setConnected(false);
        m_socket.abort();
        return;
    }
    if (kind != QLatin1Char('2'))
        return;

    // 42["event", arg] (an ack id may sit between "42" and "[").
    const int start = message.indexOf(QLatin1Char('['), 2);
    if (start < 0)
        return;
    const QJsonArray packet = QJsonDocument::fromJson(message.mid(start).toUtf8()).array();
    if (packet.isEmpty())
        return;
    emit event(packet.at(0).toString(), packet.size() > 1 ? packet.at(1).toVariant() : QVariant());
}
