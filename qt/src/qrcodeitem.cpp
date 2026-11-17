#include "qrcodeitem.h"

#include <QQuickWindow>
#include <QSGSimpleTextureNode>

#include <qrcodegen.hpp>

QrCodeItem::QrCodeItem(QQuickItem *parent) : QQuickItem(parent)
{
    setFlag(ItemHasContents, true);
}

void QrCodeItem::setValue(const QString &v)
{
    if (v == m_value)
        return;
    m_value = v;
    rebuild();
}

void QrCodeItem::setLevel(const QString &l)
{
    if (l == m_level)
        return;
    m_level = l;
    rebuild();
}

void QrCodeItem::setColor(const QColor &c)
{
    if (c == m_color)
        return;
    m_color = c;
    rebuild();
}

void QrCodeItem::setBackground(const QColor &c)
{
    if (c == m_background)
        return;
    m_background = c;
    rebuild();
}

void QrCodeItem::setMargin(int m)
{
    if (m == m_margin)
        return;
    m_margin = qMax(0, m);
    rebuild();
}

void QrCodeItem::rebuild()
{
    m_image = QImage();
    if (!m_value.isEmpty()) {
        qrcodegen::QrCode::Ecc ecc = qrcodegen::QrCode::Ecc::LOW;
        if (m_level == QLatin1String("M"))
            ecc = qrcodegen::QrCode::Ecc::MEDIUM;
        else if (m_level == QLatin1String("Q"))
            ecc = qrcodegen::QrCode::Ecc::QUARTILE;
        else if (m_level == QLatin1String("H"))
            ecc = qrcodegen::QrCode::Ecc::HIGH;
        try {
            const qrcodegen::QrCode qr = qrcodegen::QrCode::encodeText(m_value.toUtf8().constData(), ecc);
            const int size = qr.getSize() + 2 * m_margin;
            m_image = QImage(size, size, QImage::Format_ARGB32_Premultiplied);
            m_image.fill(m_background);
            const QRgb fg = m_color.rgba();
            for (int y = 0; y < qr.getSize(); ++y) {
                for (int x = 0; x < qr.getSize(); ++x) {
                    if (qr.getModule(x, y))
                        m_image.setPixel(x + m_margin, y + m_margin, fg);
                }
            }
        } catch (const std::exception &e) {
            qWarning("QrCodeItem: %s", e.what());
        }
    }
    m_dirty = true;
    emit changed();
    update();
}

QSGNode *QrCodeItem::updatePaintNode(QSGNode *old, UpdatePaintNodeData *)
{
    auto *node = static_cast<QSGSimpleTextureNode *>(old);
    if (m_image.isNull()) {
        delete node;
        return nullptr;
    }
    if (!node) {
        node = new QSGSimpleTextureNode;
        node->setOwnsTexture(true);
        node->setFiltering(QSGTexture::Nearest);
    }
    if (m_dirty || !node->texture()) {
        node->setTexture(window()->createTextureFromImage(m_image));
        m_dirty = false;
    }
    node->setRect(boundingRect());
    return node;
}
