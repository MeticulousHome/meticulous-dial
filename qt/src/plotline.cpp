#include "plotline.h"

#include <QSGGeometryNode>
#include <QSGVertexColorMaterial>
#include <QtMath>

PlotLine::PlotLine(QQuickItem *parent) : QQuickItem(parent)
{
    setFlag(ItemHasContents, true);
}

QVariantList PlotLine::points() const
{
    QVariantList list;
    list.reserve(m_data.size());
    for (const QPointF &p : m_data)
        list.append(p);
    return list;
}

void PlotLine::setPoints(const QVariantList &points)
{
    m_data.clear();
    m_data.reserve(points.size());
    for (const QVariant &v : points) {
        if (v.canConvert<QPointF>()) {
            m_data.append(v.toPointF());
        } else {
            const QVariantMap m = v.toMap();
            m_data.append(QPointF(m.value(QStringLiteral("x")).toDouble(), m.value(QStringLiteral("y")).toDouble()));
        }
    }
    changed();
}

void PlotLine::setFlat(const QVariantList &xy)
{
    m_data.clear();
    m_data.reserve(xy.size() / 2);
    for (int i = 0; i + 1 < xy.size(); i += 2)
        m_data.append(QPointF(xy.at(i).toDouble(), xy.at(i + 1).toDouble()));
    changed();
}

void PlotLine::append(qreal x, qreal y)
{
    m_data.append(QPointF(x, y));
    changed();
}

void PlotLine::clear()
{
    if (m_data.isEmpty())
        return;
    m_data.clear();
    changed();
}

void PlotLine::changed()
{
    emit pointsChanged();
    update();
}

#define PLOT_SETTER(name, member, signal)                                                                    \
    void PlotLine::name(qreal v)                                                                             \
    {                                                                                                        \
        if (qFuzzyCompare(member, v))                                                                        \
            return;                                                                                          \
        member = v;                                                                                          \
        emit signal();                                                                                       \
        update();                                                                                            \
    }
PLOT_SETTER(setLineWidth, m_width, lineWidthChanged)
PLOT_SETTER(setDash, m_dash, lineWidthChanged)
PLOT_SETTER(setGap, m_gap, lineWidthChanged)
PLOT_SETTER(setXMin, m_xMin, rangeChanged)
PLOT_SETTER(setXMax, m_xMax, rangeChanged)
PLOT_SETTER(setYMin, m_yMin, rangeChanged)
PLOT_SETTER(setYMax, m_yMax, rangeChanged)
#undef PLOT_SETTER

void PlotLine::setColor(const QColor &c)
{
    if (c == m_color)
        return;
    m_color = c;
    emit colorChanged();
    update();
}

void PlotLine::setFillColor(const QColor &c)
{
    if (c == m_fill)
        return;
    m_fill = c;
    emit colorChanged();
    update();
}

void PlotLine::geometryChange(const QRectF &newGeometry, const QRectF &oldGeometry)
{
    QQuickItem::geometryChange(newGeometry, oldGeometry);
    if (newGeometry.size() != oldGeometry.size())
        update();
}

QPointF PlotLine::map(const QPointF &p) const
{
    const qreal sx = m_xMax > m_xMin ? width() / (m_xMax - m_xMin) : 0;
    const qreal sy = m_yMax > m_yMin ? height() / (m_yMax - m_yMin) : 0;
    return QPointF((p.x() - m_xMin) * sx, height() - (p.y() - m_yMin) * sy);
}

namespace {

struct Builder {
    QVector<QSGGeometry::ColoredPoint2D> v;

    static QSGGeometry::ColoredPoint2D vertex(const QPointF &p, const QColor &c, qreal alpha)
    {
        // The vertex color material wants premultiplied colors.
        const qreal a = c.alphaF() * alpha;
        QSGGeometry::ColoredPoint2D out;
        out.set(float(p.x()), float(p.y()), uchar(qRound(c.red() * a)), uchar(qRound(c.green() * a)),
                uchar(qRound(c.blue() * a)), uchar(qRound(255 * a)));
        return out;
    }

    void quad(const QSGGeometry::ColoredPoint2D &a, const QSGGeometry::ColoredPoint2D &b,
              const QSGGeometry::ColoredPoint2D &c, const QSGGeometry::ColoredPoint2D &d)
    {
        // a-b on one end, c-d on the other.
        v << a << b << c << b << d << c;
    }

    // A polyline `width` px wide with a 1 px fringe fading to transparent on each side.
    void stroke(const QVector<QPointF> &pts, const QColor &color, qreal width)
    {
        const int n = pts.size();
        if (n < 2)
            return;
        const qreal inner = qMax<qreal>(width / 2 - 0.5, 0);
        const qreal outer = width / 2 + 0.5;
        const qreal core = width < 1 ? width : 1;

        QVector<QPointF> normals(n);
        auto segNormal = [&](int i) {
            QPointF d = pts[i + 1] - pts[i];
            const qreal len = qSqrt(d.x() * d.x() + d.y() * d.y());
            return len > 0 ? QPointF(-d.y() / len, d.x() / len) : QPointF(0, 0);
        };
        for (int i = 0; i < n; ++i) {
            if (i == 0) {
                normals[i] = segNormal(0);
            } else if (i == n - 1) {
                normals[i] = segNormal(n - 2);
            } else {
                const QPointF a = segNormal(i - 1), b = segNormal(i);
                QPointF m = a + b;
                const qreal len = qSqrt(m.x() * m.x() + m.y() * m.y());
                if (len < 1e-6) {
                    normals[i] = b;
                } else {
                    m /= len;
                    const qreal dot = m.x() * b.x() + m.y() * b.y();
                    normals[i] = m / qMax<qreal>(dot, 0.5); // miter, limited to 2x
                }
            }
        }
        for (int i = 0; i + 1 < n; ++i) {
            const QPointF p0 = pts[i], p1 = pts[i + 1], n0 = normals[i], n1 = normals[i + 1];
            const auto lo0 = vertex(p0 + n0 * outer, color, 0), li0 = vertex(p0 + n0 * inner, color, core);
            const auto ri0 = vertex(p0 - n0 * inner, color, core), ro0 = vertex(p0 - n0 * outer, color, 0);
            const auto lo1 = vertex(p1 + n1 * outer, color, 0), li1 = vertex(p1 + n1 * inner, color, core);
            const auto ri1 = vertex(p1 - n1 * inner, color, core), ro1 = vertex(p1 - n1 * outer, color, 0);
            quad(lo0, li0, lo1, li1);
            if (inner > 0)
                quad(li0, ri0, li1, ri1);
            quad(ri0, ro0, ri1, ro1);
        }
    }
};

// Splits a polyline into dashes of `dash` px separated by `gap` px.
QVector<QVector<QPointF>> dashes(const QVector<QPointF> &pts, qreal dash, qreal gap)
{
    QVector<QVector<QPointF>> out;
    if (pts.size() < 2)
        return out;
    QVector<QPointF> current{pts.first()};
    bool on = true;
    qreal left = dash;
    for (int i = 0; i + 1 < pts.size(); ++i) {
        QPointF a = pts[i];
        const QPointF b = pts[i + 1];
        qreal seg = QLineF(a, b).length();
        while (seg > left) {
            const QPointF cut = a + (b - a) * (left / seg);
            if (on) {
                current << cut;
                out << current;
                current.clear();
            } else {
                current = {cut};
            }
            seg -= left;
            a = cut;
            on = !on;
            left = on ? dash : gap;
        }
        left -= seg;
        if (on)
            current << b;
    }
    if (on && current.size() > 1)
        out << current;
    return out;
}

} // namespace

QSGNode *PlotLine::updatePaintNode(QSGNode *old, UpdatePaintNodeData *)
{
    auto *node = static_cast<QSGGeometryNode *>(old);
    if (!node) {
        node = new QSGGeometryNode;
        auto *geometry = new QSGGeometry(QSGGeometry::defaultAttributes_ColoredPoint2D(), 0);
        geometry->setDrawingMode(QSGGeometry::DrawTriangles);
        node->setGeometry(geometry);
        node->setFlag(QSGNode::OwnsGeometry);
        node->setMaterial(new QSGVertexColorMaterial);
        node->setFlag(QSGNode::OwnsMaterial);
    }

    QVector<QPointF> pts;
    pts.reserve(m_data.size());
    for (const QPointF &p : m_data) {
        if (qIsFinite(p.x()) && qIsFinite(p.y()))
            pts.append(map(p));
    }

    Builder b;
    if (m_fill.alpha() > 0 && pts.size() > 1) {
        const qreal base = map(QPointF(m_xMin, m_yMin)).y();
        for (int i = 0; i + 1 < pts.size(); ++i) {
            b.quad(Builder::vertex(pts[i], m_fill, 1), Builder::vertex(QPointF(pts[i].x(), base), m_fill, 1),
                   Builder::vertex(pts[i + 1], m_fill, 1), Builder::vertex(QPointF(pts[i + 1].x(), base), m_fill, 1));
        }
    }
    if (m_color.alpha() > 0 && m_width > 0) {
        if (m_dash > 0 && m_gap > 0) {
            for (const auto &piece : dashes(pts, m_dash, m_gap))
                b.stroke(piece, m_color, m_width);
        } else {
            b.stroke(pts, m_color, m_width);
        }
    }

    QSGGeometry *geometry = node->geometry();
    geometry->allocate(b.v.size());
    if (!b.v.isEmpty())
        memcpy(geometry->vertexDataAsColoredPoint2D(), b.v.constData(), b.v.size() * sizeof(QSGGeometry::ColoredPoint2D));
    node->markDirty(QSGNode::DirtyGeometry);
    return node;
}
