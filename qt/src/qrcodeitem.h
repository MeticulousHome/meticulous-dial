#pragma once

#include <QColor>
#include <QImage>
#include <QQuickItem>

// A QR code drawn crisp at any size (react-qr-code in the React Dial): one module per texel of a small
// texture, scaled with nearest filtering. Error correction level as react-qr-code's `level` (L, M, Q, H).
class QrCodeItem : public QQuickItem
{
    Q_OBJECT
    Q_PROPERTY(QString value READ value WRITE setValue NOTIFY changed)
    Q_PROPERTY(QString level READ level WRITE setLevel NOTIFY changed)
    Q_PROPERTY(QColor color READ color WRITE setColor NOTIFY changed)
    Q_PROPERTY(QColor background READ background WRITE setBackground NOTIFY changed)
    // Quiet zone around the code, in modules (react-qr-code draws none).
    Q_PROPERTY(int margin READ margin WRITE setMargin NOTIFY changed)
    Q_PROPERTY(int modules READ modules NOTIFY changed)

public:
    explicit QrCodeItem(QQuickItem *parent = nullptr);

    QString value() const { return m_value; }
    void setValue(const QString &v);
    QString level() const { return m_level; }
    void setLevel(const QString &l);
    QColor color() const { return m_color; }
    void setColor(const QColor &c);
    QColor background() const { return m_background; }
    void setBackground(const QColor &c);
    int margin() const { return m_margin; }
    void setMargin(int m);
    int modules() const { return m_image.width(); }

signals:
    void changed();

protected:
    QSGNode *updatePaintNode(QSGNode *old, UpdatePaintNodeData *) override;

private:
    void rebuild();

    QString m_value;
    QString m_level = QStringLiteral("L");
    QColor m_color{Qt::black};
    QColor m_background{Qt::white};
    int m_margin = 0;
    QImage m_image;
    bool m_dirty = true;
};
