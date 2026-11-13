#include "framemonitor.h"

#include <QQuickWindow>
#include <QTimer>

namespace dialsentry {

bool FrameWindowCollector::frame(double now, Window *out)
{
    if (!m_started) {
        m_started = true;
        m_previousFrameAt = now;
        m_gapDelay = 0;
        m_gapWatched = false;
        return false;
    }
    const double interval = now - m_previousFrameAt;
    // resolveMaxTimerHeartbeatDelay: a heartbeat still due when the frame came is already that late.
    double lateness = m_gapDelay;
    if (m_heartbeat)
        lateness = qMax(lateness, now - m_nextHeartbeatAt);
    lateness = qMax(0.0, lateness);
    const bool stalled = m_gapWatched && lateness >= interval - m_settings.continuousMs - m_settings.heartbeatMs;
    if (interval <= m_settings.continuousMs || stalled) {
        m_window.intervals.append(interval);
        m_window.windowMs += interval;
        m_window.maxTimerHeartbeatDelayMs = qMax(m_window.maxTimerHeartbeatDelayMs, lateness);
    } else {
        ++m_window.idleGaps;
    }
    m_previousFrameAt = now;
    m_gapDelay = 0;
    // Frames back to back: the Dial is animating, so the next gap is watched.
    if (interval <= m_settings.continuousMs && !m_heartbeat) {
        m_heartbeat = true;
        m_nextHeartbeatAt = now + m_settings.heartbeatMs;
    }
    m_gapWatched = m_heartbeat;
    if (m_window.windowMs >= m_settings.windowMs) {
        if (out)
            *out = m_window;
        m_window = Window();
        return true;
    }
    return false;
}

bool FrameWindowCollector::heartbeat(double now)
{
    if (!m_heartbeat)
        return false;
    const double lateness = qMax(0.0, now - m_nextHeartbeatAt);
    m_gapDelay = qMax(m_gapDelay, lateness);
    m_nextHeartbeatAt = now + m_settings.heartbeatMs;
    // No frame for idleAfterMs while the GUI thread was free: drawing stopped. The timer stops until frames
    // come back to back again, and the gap in progress is idle time.
    if (now - m_previousFrameAt - m_gapDelay > m_settings.idleAfterMs) {
        m_heartbeat = false;
        m_gapWatched = false;
        return false;
    }
    return true;
}

FrameMonitor::FrameMonitor(QQuickWindow *window, QObject *parent) : QObject(parent), m_window(window)
{
    m_clock.start();
    m_timer = new QTimer(this);
    m_timer->setSingleShot(true);
    m_timer->setTimerType(Qt::PreciseTimer);
    connect(m_timer, &QTimer::timeout, this, &FrameMonitor::onHeartbeat);
    // Emitted on the render thread with the threaded render loop: queued, so the time is taken on the GUI
    // thread, as rAF callbacks run on the browser's main thread.
    if (window)
        connect(window, &QQuickWindow::frameSwapped, this, &FrameMonitor::onFrameSwapped);
}

FrameMonitor::~FrameMonitor() = default;

void FrameMonitor::onFrameSwapped()
{
    const bool wasRunning = m_collector.heartbeatRunning();
    FrameWindowCollector::Window window;
    const bool closed = m_collector.frame(now(), &window);
    if (!wasRunning && m_collector.heartbeatRunning())
        armHeartbeat();
    if (closed)
        emit windowClosed(window.intervals, window.windowMs, window.maxTimerHeartbeatDelayMs);
}

void FrameMonitor::onHeartbeat()
{
    if (m_collector.heartbeat(now()))
        armHeartbeat();
}

void FrameMonitor::armHeartbeat()
{
    m_timer->start(qMax(1, int(m_collector.nextHeartbeatAt() - now() + 0.5)));
}

} // namespace dialsentry
