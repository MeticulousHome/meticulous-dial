#include "netguard.h"

#include <QNetworkRequest>
#include <QUrl>

LocalOnlyNetworkAccessManager::LocalOnlyNetworkAccessManager(const QSet<QString> &allowedHosts, QObject *parent)
    : QNetworkAccessManager(parent), m_allowed(allowedHosts)
{
}

QNetworkReply *LocalOnlyNetworkAccessManager::createRequest(Operation op, const QNetworkRequest &request,
                                                            QIODevice *outgoingData)
{
    const QUrl url = request.url();
    const bool network = url.scheme() == QLatin1String("http") || url.scheme() == QLatin1String("https");
    if (!network || m_allowed.contains(url.host().toLower()))
        return QNetworkAccessManager::createRequest(op, request, outgoingData);
    if (!m_reported.contains(url.host())) {
        m_reported.insert(url.host());
        qWarning("external services are off (DIAL_EXTERNAL_SERVICES): blocked a request to %s", qPrintable(url.host()));
    }
    QNetworkRequest dead(request);
    dead.setUrl(QUrl(QStringLiteral("http://127.0.0.1:9/blocked-external-service")));
    return QNetworkAccessManager::createRequest(op, dead, outgoingData);
}

QNetworkAccessManager *LocalOnlyNetworkAccessManagerFactory::create(QObject *parent)
{
    return new LocalOnlyNetworkAccessManager(m_allowed, parent);
}

namespace netguard {

bool externalServicesAllowed()
{
    return qEnvironmentVariable("DIAL_EXTERNAL_SERVICES") == QLatin1String("1");
}

QSet<QString> localHosts(const QString &apiHost)
{
    QSet<QString> hosts{QStringLiteral("localhost"), QStringLiteral("127.0.0.1"), QStringLiteral("::1"),
                        QStringLiteral("[::1]")};
    if (!apiHost.isEmpty())
        hosts.insert(apiHost.toLower());
    return hosts;
}

bool isLocalUrl(const QString &url)
{
    const QString host = QUrl(url).host().toLower();
    return host == QLatin1String("localhost") || host == QLatin1String("127.0.0.1") || host == QLatin1String("::1");
}

} // namespace netguard
