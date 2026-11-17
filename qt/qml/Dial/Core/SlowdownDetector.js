.pragma library
// src/performance/slowdownDetector.ts and src/performance/slowdownMonitorConfig.ts, as they are: the React
// unit test tests/slowdownDetector.test.mts runs against this file (qt/scripts/js-tests.sh, qt/tests/js/map.json).
// The frame windows come from the C++ FrameMonitor (src/sentry/framemonitor.h) through SlowdownMonitor.qml.

var SLOWDOWN_MONITOR_CONFIG = Object.freeze({
    windowMs: 10000,
    warmupMs: 30000,
    degradedP95Ms: 45,
    severeFrameGapMs: 1000,
    immediateReportFrameGapMs: 5000,
    timerHeartbeatMs: 250,
    immediateReportTimerDelayMs: 1000,
    consecutiveDegradedWindows: 3,
    consecutiveHealthyWindowsToRecover: 3,
    reportCooldownMs: 30 * 60 * 1000
})

function resolveMaxTimerHeartbeatDelay(maxObservedDelayMs, now, nextTimerHeartbeatAt) {
    return Math.max(maxObservedDelayMs, Math.max(0, now - nextTimerHeartbeatAt))
}

function percentile(sortedValues, quantile) {
    if (sortedValues.length === 0) return 0
    const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * quantile) - 1))
    return sortedValues[index]
}

function summarizeFrameWindow(frameIntervals, windowMs, maxTimerHeartbeatDelayMs) {
    if (maxTimerHeartbeatDelayMs === undefined) maxTimerHeartbeatDelayMs = 0
    const intervals = Array.prototype.slice.call(frameIntervals)
    const sortedIntervals = intervals.slice().sort(function (a, b) { return a - b })
    const maxFrameGapMs = sortedIntervals.length > 0 ? sortedIntervals[sortedIntervals.length - 1] : 0
    const frameIntervalP95Ms = percentile(sortedIntervals, 0.95)
    const countAtLeast = function (limit) { return intervals.filter(function (i) { return i >= limit }).length }

    return {
        windowMs: windowMs,
        observedFps: windowMs > 0 ? (intervals.length * 1000) / windowMs : 0,
        frameIntervalP50Ms: percentile(sortedIntervals, 0.5),
        frameIntervalP95Ms: frameIntervalP95Ms,
        frameIntervalP99Ms: percentile(sortedIntervals, 0.99),
        framesOver50Ms: countAtLeast(50),
        framesOver100Ms: countAtLeast(100),
        framesOver250Ms: countAtLeast(250),
        framesOver1000Ms: countAtLeast(1000),
        maxFrameGapMs: maxFrameGapMs,
        maxTimerHeartbeatDelayMs: maxTimerHeartbeatDelayMs,
        degraded: frameIntervalP95Ms >= SLOWDOWN_MONITOR_CONFIG.degradedP95Ms
            || maxFrameGapMs >= SLOWDOWN_MONITOR_CONFIG.severeFrameGapMs
    }
}

// class SlowdownEpisodeDetector (a constructor function: the test runner exports top-level functions).
function SlowdownEpisodeDetector() {
    this.consecutiveDegradedWindows = 0
    this.consecutiveHealthyWindows = 0
    this.episodeActive = false
    this.lastReportAt = Number.NEGATIVE_INFINITY
    this.lastImmediateReportAt = Number.NEGATIVE_INFINITY
    this.episodeWindowCount = 0
    this.immediateReportedInDegradedRun = false
}

SlowdownEpisodeDetector.prototype.evaluate = function (summary, now) {
    const config = SLOWDOWN_MONITOR_CONFIG
    if (summary.degraded) {
        this.consecutiveHealthyWindows = 0
        this.consecutiveDegradedWindows += 1
        if (this.episodeActive) {
            this.episodeWindowCount += 1
            if (now - this.lastReportAt >= config.reportCooldownMs) {
                this.lastReportAt = now
                return { episodeWindowCount: this.episodeWindowCount, kind: "heartbeat" }
            }
            return null
        }

        const immediateReport = summary.maxFrameGapMs >= config.immediateReportFrameGapMs
            && summary.maxTimerHeartbeatDelayMs >= config.immediateReportTimerDelayMs
        const sustainedReport = this.consecutiveDegradedWindows >= config.consecutiveDegradedWindows

        if (immediateReport && !this.immediateReportedInDegradedRun && !sustainedReport
                && now - this.lastImmediateReportAt >= config.reportCooldownMs) {
            this.immediateReportedInDegradedRun = true
            this.lastImmediateReportAt = now
            return { episodeWindowCount: this.consecutiveDegradedWindows, kind: "immediate" }
        }

        if (sustainedReport && now - this.lastReportAt >= config.reportCooldownMs) {
            this.episodeActive = true
            this.episodeWindowCount = this.consecutiveDegradedWindows
            this.lastReportAt = now
            return { episodeWindowCount: this.episodeWindowCount, kind: "sustained" }
        }

        return null
    }

    this.consecutiveDegradedWindows = 0
    this.immediateReportedInDegradedRun = false
    this.consecutiveHealthyWindows += 1
    if (this.consecutiveHealthyWindows >= config.consecutiveHealthyWindowsToRecover) {
        this.episodeActive = false
        this.episodeWindowCount = 0
    }
    return null
}

// slowdownMonitorConfig.ts: the native kill switch (DIAL_PERFORMANCE_DISABLE) fails open.
function resolveDialPerformanceMonitorEnabled(configuredValue) {
    return configuredValue === undefined || configuredValue === null ? true : configuredValue
}

// ---- useDialSlowdownMonitor.ts's report context, from Native.resourceSnapshot() (the Qt Dial's snapshot has
// no process ranking: top_processes_by_cpu / _by_memory are not sent).

function finiteResourceContext(snapshot, now) {
    if (!snapshot) return {}
    const context = {}
    const setFinite = function (key, value) {
        if (typeof value === "number" && isFinite(value)) context[key] = Number(value.toFixed(1))
    }
    setFinite("memory_current_mb", snapshot.dialMemoryMb)
    setFinite("cpu_percent", snapshot.dialCpuPercent)
    setFinite("available_cpu_count", snapshot.availableCpuCount)
    if (typeof snapshot.systemMemoryTotalMb === "number" && typeof snapshot.systemMemoryUsedMb === "number")
        setFinite("system_memory_available_mb", snapshot.systemMemoryTotalMb - snapshot.systemMemoryUsedMb)
    setFinite("system_load_1m", snapshot.loadAverage1m)
    setFinite("collection_duration_ms", snapshot.collectionDurationMs)
    if (typeof snapshot.collectedAtMs === "number") setFinite("snapshot_age_ms", Math.max(0, now - snapshot.collectedAtMs))
    return context
}

function performanceContext(summary, decision) {
    return {
        window_ms: Math.round(summary.windowMs),
        observed_fps: Number(summary.observedFps.toFixed(1)),
        frame_interval_p50_ms: Number(summary.frameIntervalP50Ms.toFixed(1)),
        frame_interval_p95_ms: Number(summary.frameIntervalP95Ms.toFixed(1)),
        frame_interval_p99_ms: Number(summary.frameIntervalP99Ms.toFixed(1)),
        frames_over_50_ms: summary.framesOver50Ms,
        frames_over_100_ms: summary.framesOver100Ms,
        frames_over_250_ms: summary.framesOver250Ms,
        frames_over_1000_ms: summary.framesOver1000Ms,
        max_frame_gap_ms: Number(summary.maxFrameGapMs.toFixed(1)),
        max_timer_heartbeat_delay_ms: Number(summary.maxTimerHeartbeatDelayMs.toFixed(1)),
        episode_window_count: decision.episodeWindowCount
    }
}

// captureSlowdown's scope as Sentry.captureMessage options.
function slowdownReport(summary, decision, state, resourceContext) {
    const tags = {
        "performance-detector-version": "4",
        "slowdown-report-kind": decision.kind,
        "screen": String(state.screen),
        "is-extracting": String(!!state.isExtracting)
    }
    if (state.serial) tags["machine-serial"] = state.serial
    const contexts = { dial_performance: performanceContext(summary, decision) }
    if (resourceContext && Object.keys(resourceContext).length > 0) contexts.dial_resources = resourceContext
    return { level: "warning", fingerprint: ["dial-ui-sustained-slowdown"], tags: tags, contexts: contexts }
}
