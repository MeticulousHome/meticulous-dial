#pragma once

// Frame timing for the slowdown monitor (useDialSlowdownMonitor.ts; the detector itself is the JS port in
// qml/Dial/Core/SlowdownDetector.js, which the React unit test runs against).
//
// The React monitor measures requestAnimationFrame intervals, which a browser fires every vsync even on a
// still screen. Qt Quick draws nothing when nothing changes (0 frames, ~0 % CPU on a still home), so a gap
// between two frames is usually just idle time, not a stall. The rules here:
//   - Frames are timed on the GUI thread (QQuickWindow::frameSwapped), like rAF callbacks on the main thread.
//   - A frame interval of up to two vsyncs (continuousMs) counts as it is.
//   - While frames come back to back, a GUI-thread heartbeat timer runs (every heartbeatMs, as React's 250 ms
//     timer heartbeat but finer). A longer interval counts only when the heartbeat was late by about as much
//     (the GUI thread was blocked, which in Qt's threaded render loop also covers a slow render thread);
//     otherwise it was idle time and is left out, with its duration.
//   - The heartbeat stops idleAfterMs after the last frame: a still Dial runs no timer at all.
//   - A window closes when its counted intervals add up to windowMs (10 s of drawing, React's window).
// So the monitor measures only while the Dial is actually animating. A GUI stall while nothing animates is
// not seen (React's rAF would see it); see docs/qt-migration/parity/sentry.md.

#include <QElapsedTimer>
#include <QObject>
#include <QPointer>
#include <QVector>

class QQuickWindow;
class QTimer;

namespace dialsentry {

class FrameWindowCollector
{
public:
    struct Settings {
        double windowMs = 10000;
        double heartbeatMs = 16;
        double continuousMs = 34;
        double idleAfterMs = 150;
    };
    struct Window {
        QVector<double> intervals;
        double windowMs = 0;
        double maxTimerHeartbeatDelayMs = 0;
        int idleGaps = 0;
    };

    FrameWindowCollector() = default;
    explicit FrameWindowCollector(const Settings &settings) : m_settings(settings) {}

    // A frame reached the screen at `now` (monotonic ms). Returns true when it closed a window (into *out).
    bool frame(double now, Window *out);
    // The heartbeat fired at `now`. Returns whether it should keep running (false: frames stopped, idle).
    bool heartbeat(double now);

    bool heartbeatRunning() const { return m_heartbeat; }
    double nextHeartbeatAt() const { return m_nextHeartbeatAt; }
    const Settings &settings() const { return m_settings; }

private:
    Settings m_settings;
    bool m_started = false;
    bool m_heartbeat = false;
    double m_previousFrameAt = 0;
    double m_nextHeartbeatAt = 0;
    double m_gapDelay = 0;          // the heartbeat's worst lateness since the previous frame
    bool m_gapWatched = false;      // the heartbeat ran during the current gap
    Window m_window;
};

// Drives a FrameWindowCollector from a QQuickWindow and a heartbeat QTimer on the GUI thread.
class FrameMonitor : public QObject
{
    Q_OBJECT
public:
    explicit FrameMonitor(QQuickWindow *window, QObject *parent = nullptr);
    ~FrameMonitor() override;

signals:
    void windowClosed(const QVector<double> &intervals, double windowMs, double maxTimerHeartbeatDelayMs);

private:
    void onFrameSwapped();
    void onHeartbeat();
    void armHeartbeat();
    double now() const { return m_clock.nsecsElapsed() / 1e6; }

    QPointer<QQuickWindow> m_window;
    QTimer *m_timer = nullptr;
    QElapsedTimer m_clock;
    FrameWindowCollector m_collector;
};

} // namespace dialsentry
