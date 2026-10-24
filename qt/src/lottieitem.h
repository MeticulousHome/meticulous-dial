#pragma once

#include <QElapsedTimer>
#include <QFutureWatcher>
#include <QImage>
#include <QMutex>
#include <QQuickItem>
#include <QUrl>

#include <memory>

namespace rlottie {
class Animation;
}

// A Lottie animation rendered by rlottie (the React Dial plays its animations with lottie-web). Qt Lottie 6.4
// has no precompositions, mattes or expressions, which most of the Dial's animations use; rlottie has them.
// Frames are rendered on a worker thread into an image and shown as a texture.
//
// Like lottie-web with setSubframe(true), the time between the file's frames is interpolated: the file's
// time base is multiplied by `subframes` on load (keyframe times, in/out points, frame rate), so a 30 fps
// file plays 60 distinct pictures a second with subframes: 2.
class LottieItem : public QQuickItem
{
    Q_OBJECT
    Q_PROPERTY(QUrl source READ source WRITE setSource NOTIFY sourceChanged)
    Q_PROPERTY(bool playing READ playing WRITE setPlaying NOTIFY playingChanged)
    // -1 forever, else the number of plays
    Q_PROPERTY(int loops READ loops WRITE setLoops NOTIFY loopsChanged)
    Q_PROPERTY(qreal speed READ speed WRITE setSpeed NOTIFY speedChanged)
    // The segment to play, in the file's frames (-1: the file's in / out points).
    Q_PROPERTY(qreal startFrame READ startFrame WRITE setStartFrame NOTIFY segmentChanged)
    Q_PROPERTY(qreal endFrame READ endFrame WRITE setEndFrame NOTIFY segmentChanged)
    Q_PROPERTY(int subframes READ subframes WRITE setSubframes NOTIFY sourceChanged)
    Q_PROPERTY(qreal frame READ frame NOTIFY frameChanged)
    Q_PROPERTY(qreal frameRate READ frameRate NOTIFY loadedChanged)
    Q_PROPERTY(qreal totalFrames READ totalFrames NOTIFY loadedChanged)
    Q_PROPERTY(bool loaded READ loaded NOTIFY loadedChanged)
    Q_PROPERTY(QSize animationSize READ animationSize NOTIFY loadedChanged)

public:
    explicit LottieItem(QQuickItem *parent = nullptr);
    ~LottieItem() override;

    QUrl source() const { return m_source; }
    void setSource(const QUrl &source);
    bool playing() const { return m_playing; }
    void setPlaying(bool playing);
    int loops() const { return m_loops; }
    void setLoops(int loops);
    qreal speed() const { return m_speed; }
    void setSpeed(qreal speed);
    qreal startFrame() const { return m_startFrame; }
    void setStartFrame(qreal f);
    qreal endFrame() const { return m_endFrame; }
    void setEndFrame(qreal f);
    int subframes() const { return m_subframes; }
    void setSubframes(int s);
    qreal frame() const { return m_frame; }
    qreal frameRate() const;
    qreal totalFrames() const;
    bool loaded() const { return bool(m_animation); }
    QSize animationSize() const { return m_size; }

    // Plays from `frame` (the file's frames); stop() rests on the current picture.
    Q_INVOKABLE void play();
    Q_INVOKABLE void stop();
    Q_INVOKABLE void gotoAndPlay(qreal frame);
    Q_INVOKABLE void gotoAndStop(qreal frame);

signals:
    void sourceChanged();
    void playingChanged();
    void loopsChanged();
    void speedChanged();
    void segmentChanged();
    void frameChanged();
    void loadedChanged();
    void finished();
    void looped();

protected:
    QSGNode *updatePaintNode(QSGNode *old, UpdatePaintNodeData *) override;
    void geometryChange(const QRectF &newGeometry, const QRectF &oldGeometry) override;
    void itemChange(ItemChange change, const ItemChangeData &value) override;

private:
    void load();
    void tick();
    void requestRender(qreal fileFrame);
    qreal segmentStart() const;
    qreal segmentEnd() const;

    QUrl m_source;
    std::shared_ptr<rlottie::Animation> m_animation;
    QSize m_size;
    qreal m_inPoint = 0;      // the file's ip: rlottie counts frames from it
    bool m_playing = false;
    int m_loops = 1;
    int m_played = 0;
    qreal m_speed = 1;
    qreal m_startFrame = -1;
    qreal m_endFrame = -1;
    int m_subframes = 2;
    qreal m_frame = 0;
    qreal m_playFrom = 0;
    QElapsedTimer m_clock;

    // Rendering: one frame in flight on the worker; the last finished picture waits for the scene graph.
    QFutureWatcher<QImage> m_watcher;
    bool m_rendering = false;
    qreal m_pendingFrame = -1;
    qreal m_renderedFrame = -1;
    QImage m_image;
    bool m_imageDirty = false;
};
