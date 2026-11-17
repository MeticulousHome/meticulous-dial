#pragma once

#include <QObject>
#include <QTimer>
#include <QUrl>
#include <QVariant>
#include <QWebSocket>

// A Socket.IO v5 client (Engine.IO v4, websocket transport only), enough for the machine's backend
// (python-socketio): the default namespace, events in both directions, ping/pong and reconnection.
// The React Dial used socket.io-client against the same server.
class SocketIO : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool connected READ connected NOTIFY connectedChanged)
    Q_PROPERTY(QUrl url READ url WRITE setUrl NOTIFY urlChanged)

public:
    explicit SocketIO(QObject *parent = nullptr);

    bool connected() const { return m_connected; }
    QUrl url() const { return m_url; }
    void setUrl(const QUrl &url);

    // Sends `42["name", data]`; with no data, `42["name"]`.
    Q_INVOKABLE void emitEvent(const QString &name, const QVariant &data = QVariant());
    Q_INVOKABLE void open();
    Q_INVOKABLE void close();

signals:
    void connectedChanged();
    void urlChanged();
    // Every event the server sends: its name and its first argument (as JSON: object, array, string, number).
    void event(const QString &name, const QVariant &data);
    void connectedToServer();
    void disconnectedFromServer();

private:
    void onText(const QString &message);
    void scheduleReconnect();
    void setConnected(bool connected);
    QUrl engineUrl() const;

    QWebSocket m_socket;
    QTimer m_reconnect;
    QTimer m_pingWatchdog;
    QUrl m_url;
    bool m_connected = false;
    bool m_wanted = false;
    int m_backoffMs = 500;
};
