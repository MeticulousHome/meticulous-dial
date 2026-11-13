.pragma library
// The sleep clocks' time (src/components/IdleScreen/analogClockTime.ts, digitalClockTime.ts and
// src/utils/localTime.ts): the OS local time (Native.localTime(), the Tauri get_os_local_time) read once a
// second, advanced between reads with a monotonic clock, as milliseconds since local midnight. Every
// function takes its clocks and timers as arguments, so the cases of tests/analogClockTime.test.mts and
// tests/digitalClockTime.test.mts run against it (qt/tests/e2e/test_idle.py).

var MILLISECONDS_PER_DAY = 86400000
// Often enough for the shown minute to turn over on time between native reads.
var DIGITAL_REFRESH_MS = 250

function millisecondsSinceMidnight(sample) {
    return sample.hour * 3600000 + sample.minute * 60000 + sample.second * 1000 + sample.millisecond
}

function advanceLocalTime(sampleMs, elapsedMs) {
    return (((sampleMs + elapsedMs) % MILLISECONDS_PER_DAY) + MILLISECONDS_PER_DAY) % MILLISECONDS_PER_DAY
}

// Until the settings load, or with a backend that does not send it, the clock follows the backend's
// default for clock_format_24_hour: 24-hour.
function uses24HourClock(settings) {
    if (settings === undefined || settings === null) return true
    const value = settings.clock_format_24_hour
    return value === undefined || value === null ? true : value
}

// Takes the milliseconds since local midnight of the OS time rather than a Date.
function formatTime(use24Hour, milliseconds) {
    const seconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(seconds / 3600)
    return {
        hours: use24Hour ? hours : ((hours + 11) % 12) + 1,
        minutes: Math.floor(seconds / 60) % 60,
        seconds: seconds % 60,
        midday: use24Hour ? "" : hours < 12 ? "AM" : "PM"
    }
}

// Number.toString().padStart(2, "0")
function pad2(n) {
    const s = String(n)
    return s.length >= 2 ? s : "0" + s
}

// subscribeLocalTime({ onTime(sample, sampledAt), readTime, onError, now, setTimer, clearTimer }): reads now
// and then 1 s after each read completes (a slow read never overlaps the next). The sample's instant is the
// midpoint of the read. A failed read keeps the last sample and is reported once until a read succeeds.
// readTime may return the sample or a promise of it. Returns the unsubscribe function.
function subscribeLocalTime(o) {
    let active = true
    let timerId
    let reportedError = false

    function fail(error) {
        if (active && !reportedError) {
            reportedError = true
            o.onError(error)
        }
    }
    function schedule() {
        if (active) timerId = o.setTimer(sync, 1000)
    }
    function received(sample, requestedAt) {
        if (!active) return
        o.onTime(sample, (requestedAt + o.now()) / 2)
        reportedError = false
    }
    function sync() {
        const requestedAt = o.now()
        let result
        try {
            result = o.readTime()
        } catch (error) {
            fail(error)
            schedule()
            return
        }
        if (result && typeof result.then === "function") {
            result.then(sample => { received(sample, requestedAt); schedule() },
                        error => { fail(error); schedule() })
            return
        }
        received(result, requestedAt)
        schedule()
    }

    sync()
    return function () {
        active = false
        if (timerId !== undefined) o.clearTimer(timerId)
    }
}

// startAnalogClock({ renderTime(ms), now, requestFrame(cb), cancelFrame(id), readTime, onError, setTimer,
// clearTimer }): renders the OS local time on every frame with numeric arithmetic only (no Date).
function startAnalogClock(o) {
    let active = true
    let sampleMs = null
    let sampledAt = 0
    let frameId

    const unsubscribe = subscribeLocalTime({
        readTime: o.readTime,
        onError: o.onError,
        now: o.now,
        setTimer: o.setTimer,
        clearTimer: o.clearTimer,
        onTime: function (sample, timestamp) {
            sampleMs = millisecondsSinceMidnight(sample)
            sampledAt = timestamp
        }
    })

    function animate() {
        if (!active) return
        if (sampleMs !== null) o.renderTime(advanceLocalTime(sampleMs, o.now() - sampledAt))
        frameId = o.requestFrame(animate)
    }
    frameId = o.requestFrame(animate)
    return function () {
        active = false
        o.cancelFrame(frameId)
        unsubscribe()
    }
}

// The digital clock: the same time source, redrawn every 250 ms instead of every frame (the caller passes
// requestFrame / cancelFrame as a 250 ms timer, or its own for tests).
function startDigitalClock(o) {
    return startAnalogClock(o)
}

// CSS "ease" (cubic-bezier(0.25, 0.1, 0.25, 1)) at progress x.
function cssEase(x) {
    return cubicBezier(0.25, 0.1, 0.25, 1, x)
}
function cubicBezier(x1, y1, x2, y2, x) {
    if (x <= 0) return 0
    if (x >= 1) return 1
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    let t = x
    for (let i = 0; i < 8; i++) {
        const fx = ((ax * t + bx) * t + cx) * t - x
        const d = (3 * ax * t + 2 * bx) * t + cx
        if (Math.abs(fx) < 1e-7) break
        if (Math.abs(d) < 1e-6) break
        t -= fx / d
    }
    t = Math.min(1, Math.max(0, t))
    return ((ay * t + by) * t + cy) * t
}

// IdleScreen.tsx pixelShift: rotateZ 0 → -0.5° → 0 → 0.5° → 0 over 3600 s, "ease" between keyframes.
function pixelShift(elapsedMs) {
    const period = 3600000
    const p = ((elapsedMs % period) + period) % period / period * 4
    const segment = Math.min(3, Math.floor(p))
    const values = [0, -0.5, 0, 0.5, 0]
    const k = cssEase(p - segment)
    return values[segment] + (values[segment + 1] - values[segment]) * k
}
