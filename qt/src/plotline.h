#pragma once

#include <QColor>
#include <QQuickItem>
#include <QVector>
#include <QPointF>

// An antialiased polyline drawn by the scene graph (one vertex-colored triangle mesh, no offscreen pass):
// the extraction graph and other plots. Canvas (QPainter) costs ~10 ms a frame on the i.MX8M Nano and
// Shapes is not antialiased with this GPU; this costs a vertex buffer upload when the data changes.
//
// Data are in plot units; xMin..xMax and yMin..yMax map them onto the item (y grows upwards).
class PlotLine : public QQuickItem
{
    Q_OBJECT
    Q_PROPERTY(QVariantList points READ points WRITE setPoints NOTIFY pointsChanged)
    Q_PROPERTY(QColor color READ color WRITE setColor NOTIFY colorChanged)
    Q_PROPERTY(qreal lineWidth READ lineWidth WRITE setLineWidth NOTIFY lineWidthChanged)
    Q_PROPERTY(qreal xMin READ xMin WRITE setXMin NOTIFY rangeChanged)
    Q_PROPERTY(qreal xMax READ xMax WRITE setXMax NOTIFY rangeChanged)
    Q_PROPERTY(qreal yMin READ yMin WRITE setYMin NOTIFY rangeChanged)
    Q_PROPERTY(qreal yMax READ yMax WRITE setYMax NOTIFY rangeChanged)
    Q_PROPERTY(int count READ count NOTIFY pointsChanged)
    // Fill the area between the line and yMin with this color (transparent: no fill).
    Q_PROPERTY(QColor fillColor READ fillColor WRITE setFillColor NOTIFY colorChanged)
    // Dash pattern in pixels (dash, gap); 0 for a solid line.
    Q_PROPERTY(qreal dash READ dash WRITE setDash NOTIFY lineWidthChanged)
    Q_PROPERTY(qreal gap READ gap WRITE setGap NOTIFY lineWidthChanged)

public:
    explicit PlotLine(QQuickItem *parent = nullptr);

    QVariantList points() const;
    void setPoints(const QVariantList &points);
    QColor color() const { return m_color; }
    void setColor(const QColor &c);
    QColor fillColor() const { return m_fill; }
    void setFillColor(const QColor &c);
    qreal lineWidth() const { return m_width; }
    void setLineWidth(qreal w);
    qreal dash() const { return m_dash; }
    void setDash(qreal d);
    qreal gap() const { return m_gap; }
    void setGap(qreal g);
    qreal xMin() const { return m_xMin; }
    void setXMin(qreal v);
    qreal xMax() const { return m_xMax; }
    void setXMax(qreal v);
    qreal yMin() const { return m_yMin; }
    void setYMin(qreal v);
    qreal yMax() const { return m_yMax; }
    void setYMax(qreal v);
    int count() const { return m_data.size(); }

    Q_INVOKABLE void append(qreal x, qreal y);
    Q_INVOKABLE void clear();
    // [x0, y0, x1, y1, ...]: faster than a list of points for long series.
    Q_INVOKABLE void setFlat(const QVariantList &xy);

signals:
    void pointsChanged();
    void colorChanged();
    void lineWidthChanged();
    void rangeChanged();

protected:
    QSGNode *updatePaintNode(QSGNode *old, UpdatePaintNodeData *) override;
    void geometryChange(const QRectF &newGeometry, const QRectF &oldGeometry) override;

private:
    QPointF map(const QPointF &p) const;
    void changed();

    QVector<QPointF> m_data;
    QColor m_color{Qt::white};
    QColor m_fill{Qt::transparent};
    qreal m_width = 2;
    qreal m_dash = 0;
    qreal m_gap = 0;
    qreal m_xMin = 0, m_xMax = 1, m_yMin = 0, m_yMax = 1;
};
