#include "lottieitem.h"

#include <QFile>
#include <QFileInfo>
#include <QQuickWindow>
#include <QSGSimpleTextureNode>
#include <QtConcurrent/QtConcurrentRun>
#include <QtMath>

#include <nlohmann/json.hpp>
#include <rlottie.h>

namespace {

using Json = nlohmann::ordered_json;

// Multiplies the time base of a Lottie document by k: keyframe times, layer in/out/start points, markers
// and the frame rate. Speeds stay the same; there are k times more frames. The key order is kept: rlottie's
// parser reads some objects in order ("ty" first), so a re-sorted document renders nothing.
void scaleTime(Json &value, double k, const std::string &key = std::string())
{
    if (value.is_object()) {
        for (const char *name : {"ip", "op", "st"}) {
            auto it = value.find(name);
            if (it != value.end() && it->is_number())
                *it = it->get<double>() * k;
        }
        for (auto it = value.begin(); it != value.end(); ++it) {
            if (it.key() == "ip" || it.key() == "op" || it.key() == "st")
                continue;
            scaleTime(it.value(), k, it.key());
        }
        return;
    }
    if (!value.is_array())
        return;
    // An animated property's keyframes: "k": [{ "t": ..., "s": ..., ...}, ...]
    const bool keyframes = key == "k" && !value.empty() && value.front().is_object()
                           && value.front().contains("t") && value.front()["t"].is_number();
    for (auto &element : value) {
        if (keyframes && element.is_object() && element.contains("t") && element["t"].is_number())
            element["t"] = element["t"].get<double>() * k;
        else
            scaleTime(element, k);
    }
}

std::string prepare(const QByteArray &json, int subframes, double *inPoint)
{
    Json doc = Json::parse(json.constData(), json.constData() + json.size(), nullptr, false);
    if (doc.is_discarded() || !doc.is_object())
        return json.toStdString();
    *inPoint = doc.value("ip", 0.0);
    if (subframes <= 1)
        return json.toStdString();
    const double fr = doc.value("fr", 30.0);
    scaleTime(doc, subframes);
    doc["fr"] = fr * subframes;
    if (doc.contains("markers") && doc["markers"].is_array()) {
        for (auto &m : doc["markers"]) {
            if (m.contains("tm") && m["tm"].is_number())
                m["tm"] = m["tm"].get<double>() * subframes;
            if (m.contains("dr") && m["dr"].is_number())
                m["dr"] = m["dr"].get<double>() * subframes;
        }
    }
    return doc.dump();
}

} // namespace

LottieItem::LottieItem(QQuickItem *parent) : QQuickItem(parent)
{
    setFlag(ItemHasContents, true);
    connect(&m_watcher, &QFutureWatcher<QImage>::finished, this, [this] {
        m_rendering = false;
        m_image = m_watcher.result();
        m_imageDirty = true;
        update();
        if (m_pendingFrame >= 0) {
            const qreal next = m_pendingFrame;
            m_pendingFrame = -1;
            requestRender(next);
        }
    });
}

LottieItem::~LottieItem()
{
    m_watcher.waitForFinished();
}

void LottieItem::setSource(const QUrl &source)
{
    if (source == m_source)
        return;
    m_source = source;
    emit sourceChanged();
    if (isComponentComplete())
        load();
    else
        QMetaObject::invokeMethod(this, &LottieItem::load, Qt::QueuedConnection);
}

void LottieItem::setSubframes(int s)
{
    s = qBound(1, s, 8);
    if (s == m_subframes)
        return;
    m_subframes = s;
    emit sourceChanged();
    if (m_animation)
        load();
}

void LottieItem::load()
{
    m_watcher.waitForFinished();
    m_animation.reset();
    m_image = QImage();
    m_imageDirty = true;
    m_renderedFrame = -1;
    m_size = QSize();
    if (m_source.isEmpty()) {
        emit loadedChanged();
        update();
        return;
    }
    const QString path = m_source.isLocalFile() ? m_source.toLocalFile() : m_source.toString();
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        qWarning("LottieItem: cannot open %s", qPrintable(path));
        emit loadedChanged();
        return;
    }
    double inPoint = 0;
    const std::string json = prepare(file.readAll(), m_subframes, &inPoint);
    m_inPoint = inPoint;
    const std::string key = path.toStdString() + "#" + std::to_string(m_subframes);
    m_animation = std::shared_ptr<rlottie::Animation>(
        rlottie::Animation::loadFromData(json, key, QFileInfo(path).absolutePath().toStdString() + "/", false));
    if (!m_animation) {
        qWarning("LottieItem: rlottie cannot read %s", qPrintable(path));
        emit loadedChanged();
        return;
    }
    size_t w = 0, h = 0;
    m_animation->size(w, h);
    m_size = QSize(int(w), int(h));
    if (width() <= 0 && height() <= 0) {
        setImplicitSize(w, h);
    }
    m_frame = segmentStart();
    emit frameChanged();
    requestRender(m_frame);
    emit loadedChanged();
    if (m_playing)
        play();
}

qreal LottieItem::frameRate() const
{
    return m_animation ? m_animation->frameRate() / m_subframes : 0;
}

qreal LottieItem::totalFrames() const
{
    return m_animation ? qreal(m_animation->totalFrame()) / m_subframes : 0;
}

// Frames are the file's (counted from 0, as lottie-web does); rlottie numbers them from 0 at the file's
// in point, times `subframes`.
qreal LottieItem::segmentStart() const
{
    if (!m_animation)
        return 0;
    return m_startFrame >= 0 ? qMax(m_startFrame, m_inPoint) : m_inPoint;
}

qreal LottieItem::segmentEnd() const
{
    if (!m_animation)
        return 0;
    const qreal last = m_inPoint + qreal(m_animation->totalFrame()) / m_subframes;
    return m_endFrame >= 0 ? qMin(m_endFrame, last) : last;
}

void LottieItem::setPlaying(bool playing)
{
    if (playing == m_playing)
        return;
    if (playing)
        play();
    else
        stop();
}

void LottieItem::setLoops(int loops)
{
    if (loops == m_loops)
        return;
    m_loops = loops;
    emit loopsChanged();
}

void LottieItem::setSpeed(qreal speed)
{
    if (qFuzzyCompare(speed, m_speed))
        return;
    m_playFrom = m_frame;
    m_clock.restart();
    m_speed = speed;
    emit speedChanged();
}

void LottieItem::setStartFrame(qreal f)
{
    if (qFuzzyCompare(f, m_startFrame))
        return;
    m_startFrame = f;
    emit segmentChanged();
}

void LottieItem::setEndFrame(qreal f)
{
    if (qFuzzyCompare(f, m_endFrame))
        return;
    m_endFrame = f;
    emit segmentChanged();
}

void LottieItem::play()
{
    if (m_frame >= segmentEnd() || m_frame < segmentStart())
        m_frame = segmentStart();
    m_playFrom = m_frame;
    m_played = 0;
    m_clock.restart();
    if (!m_playing) {
        m_playing = true;
        emit playingChanged();
    }
    update();
}

void LottieItem::stop()
{
    if (!m_playing)
        return;
    m_playing = false;
    emit playingChanged();
}

void LottieItem::gotoAndPlay(qreal frame)
{
    m_frame = frame;
    m_playFrom = frame;
    m_played = 0;
    m_clock.restart();
    if (!m_playing) {
        m_playing = true;
        emit playingChanged();
    }
    requestRender(frame);
    update();
}

void LottieItem::gotoAndStop(qreal frame)
{
    stop();
    m_frame = frame;
    emit frameChanged();
    requestRender(frame);
}

void LottieItem::tick()
{
    if (!m_playing || !m_animation)
        return;
    const qreal start = segmentStart(), end = segmentEnd();
    qreal f = m_playFrom + m_clock.nsecsElapsed() / 1e9 * frameRate() * m_speed;
    if (f >= end) {
        const qreal length = qMax<qreal>(end - start, 1e-6);
        const int wraps = int((f - start) / length);
        if (m_loops < 0 || m_played + wraps < m_loops) {
            m_played += wraps;
            f = start + std::fmod(f - start, length);
            m_playFrom = f;
            m_clock.restart();
            emit looped();
        } else {
            f = end;
            m_frame = f;
            emit frameChanged();
            requestRender(f);
            m_playing = false;
            emit playingChanged();
            emit finished();
            return;
        }
    }
    m_frame = f;
    emit frameChanged();
    requestRender(f);
    update();
}

void LottieItem::requestRender(qreal fileFrame)
{
    if (!m_animation)
        return;
    const QSize size(qMax(1, qRound(width())), qMax(1, qRound(height())));
    const qreal scaled = qBound<qreal>(0, qRound((fileFrame - m_inPoint) * m_subframes), qreal(m_animation->totalFrame()));
    if (scaled == m_renderedFrame && m_image.size() == size)
        return;
    if (m_rendering) {
        m_pendingFrame = fileFrame;
        return;
    }
    m_rendering = true;
    m_renderedFrame = scaled;
    auto animation = m_animation;
    m_watcher.setFuture(QtConcurrent::run([animation, size, scaled]() {
        QImage image(size, QImage::Format_ARGB32_Premultiplied);
        image.fill(Qt::transparent);
        rlottie::Surface surface(reinterpret_cast<uint32_t *>(image.bits()), size_t(size.width()), size_t(size.height()),
                                 size_t(image.bytesPerLine()));
        animation->renderSync(size_t(scaled), surface);
        return image;
    }));
}

void LottieItem::geometryChange(const QRectF &newGeometry, const QRectF &oldGeometry)
{
    QQuickItem::geometryChange(newGeometry, oldGeometry);
    if (newGeometry.size() != oldGeometry.size() && m_animation) {
        m_renderedFrame = -1;
        requestRender(m_frame);
    }
}

void LottieItem::itemChange(ItemChange change, const ItemChangeData &value)
{
    QQuickItem::itemChange(change, value);
    if (change == ItemSceneChange && value.window)
        connect(value.window, &QQuickWindow::afterAnimating, this, &LottieItem::tick, Qt::UniqueConnection);
}

QSGNode *LottieItem::updatePaintNode(QSGNode *old, UpdatePaintNodeData *)
{
    auto *node = static_cast<QSGSimpleTextureNode *>(old);
    if (m_image.isNull()) {
        delete node;
        return nullptr;
    }
    if (!node) {
        node = new QSGSimpleTextureNode;
        node->setOwnsTexture(true);
        node->setFiltering(QSGTexture::Linear);
    }
    if (m_imageDirty || !node->texture()) {
        node->setTexture(window()->createTextureFromImage(m_image, QQuickWindow::TextureHasAlphaChannel));
        m_imageDirty = false;
    }
    node->setRect(boundingRect());
    if (m_playing)
        update();
    return node;
}
