#pragma once

#include <QNetworkAccessManager>
#include <QQmlNetworkAccessManagerFactory>
#include <QSet>
#include <QString>

// Keeps a Dial that runs for tests away from real services (the support ticket service, Sentry, Community):
// unless DIAL_EXTERNAL_SERVICES=1 (the machine's launcher sets it), every request the QML makes to a host other
// than the backend's or this machine's goes to a dead local port instead, and is logged once per host.
class LocalOnlyNetworkAccessManager : public QNetworkAccessManager
{
public:
    LocalOnlyNetworkAccessManager(const QSet<QString> &allowedHosts, QObject *parent = nullptr);

protected:
    QNetworkReply *createRequest(Operation op, const QNetworkRequest &request, QIODevice *outgoingData) override;

private:
    QSet<QString> m_allowed;
    QSet<QString> m_reported;
};

class LocalOnlyNetworkAccessManagerFactory : public QQmlNetworkAccessManagerFactory
{
public:
    explicit LocalOnlyNetworkAccessManagerFactory(const QSet<QString> &allowedHosts) : m_allowed(allowedHosts) {}
    QNetworkAccessManager *create(QObject *parent) override;

private:
    QSet<QString> m_allowed;
};

namespace netguard {
// Whether real external services may be reached (DIAL_EXTERNAL_SERVICES=1).
bool externalServicesAllowed();
// The hosts a guarded Dial may reach: the backend's and this machine's.
QSet<QString> localHosts(const QString &apiHost);
bool isLocalUrl(const QString &url);
}
