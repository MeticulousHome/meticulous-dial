pragma Singleton
// useDialSlowdownMonitor (App.tsx's DialSlowdownMonitor): reports a sustained UI slowdown to Sentry as
// "Dial UI sustained slowdown". On only where Sentry is (the machine) and not DIAL_PERFORMANCE_DISABLE.
// The frame windows come from the C++ FrameMonitor, which times frames only while the Dial draws: a still
// Dial runs no timer and costs nothing (src/sentry/framemonitor.h). The detector is SlowdownDetector.js.
import QtQuick
import Dial.Native
import "SlowdownDetector.js" as Detector

QtObject {
    id: monitor

    property bool running: false
    property var _detector: null
    property real _startedAt: 0

    // Called once from main.qml.
    function start() {
        if (running || typeof Sentry === "undefined" || !Sentry.enabled) return
        if (!Detector.resolveDialPerformanceMonitorEnabled(Sentry.performanceMonitorEnabled)) return
        _detector = new Detector.SlowdownEpisodeDetector()
        _startedAt = Native.monotonicMs()
        running = Sentry.startFrameMonitor()
    }

    function _state() {
        const info = Device.info
        const serial = info && info.serial !== undefined && info.serial !== null ? String(info.serial).trim() : ""
        return { screen: Nav.screen, serial: serial, isExtracting: Stats.extracting }
    }

    function _resources() {
        const started = Native.monotonicMs()
        const snapshot = Native.resourceSnapshot()
        snapshot.collectionDurationMs = Native.monotonicMs() - started
        snapshot.collectedAtMs = started
        return Detector.finiteResourceContext(snapshot, Native.monotonicMs())
    }

    function evaluate(intervals, windowMs, maxTimerHeartbeatDelayMs) {
        const summary = Detector.summarizeFrameWindow(intervals, windowMs, maxTimerHeartbeatDelayMs)
        const warmupComplete = Native.monotonicMs() - _startedAt >= Detector.SLOWDOWN_MONITOR_CONFIG.warmupMs
        const resources = _resources()
        const state = _state()
        if (warmupComplete && Sentry.performanceDebug) {
            console.info("Dial performance sample " + JSON.stringify({
                screen: state.screen,
                isExtracting: state.isExtracting,
                observedFps: Number(summary.observedFps.toFixed(1)),
                frameIntervalP95Ms: Number(summary.frameIntervalP95Ms.toFixed(1)),
                maxFrameGapMs: Number(summary.maxFrameGapMs.toFixed(1)),
                maxTimerHeartbeatDelayMs: Number(summary.maxTimerHeartbeatDelayMs.toFixed(1)),
                degraded: summary.degraded,
                resources: resources
            }))
        }
        const decision = warmupComplete ? _detector.evaluate(summary, Date.now()) : null
        if (decision)
            Sentry.captureMessage("Dial UI sustained slowdown", Detector.slowdownReport(summary, decision, state, resources))
        return decision
    }

    property Connections _frames: Connections {
        target: typeof Sentry === "undefined" ? null : Sentry
        enabled: monitor.running
        function onFrameWindow(intervals, windowMs, maxTimerHeartbeatDelayMs) {
            monitor.evaluate(intervals, windowMs, maxTimerHeartbeatDelayMs)
        }
    }
}
