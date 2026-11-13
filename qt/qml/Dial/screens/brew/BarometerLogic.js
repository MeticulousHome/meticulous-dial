.pragma library
// The barometer's pure modules: src/components/Barometer/meterGeometry.ts, manualTarget.ts and
// trailGeometry.ts. The e2e test runs the cases of tests/meterGeometry, manualTarget and trailGeometry
// .test.mts against this file.

// ---- meterGeometry.ts
const CIRCLE = Math.PI * 2
const CIRCLE_DEG = 360
const CIRCLE_BOTTOM_ANGLE = 0.25 * CIRCLE
// 300 degrees of the circle, open at the bottom
const ARC_FILL_RATIO = (CIRCLE_DEG - 60) / CIRCLE_DEG
const ARC_START_ANGLE = CIRCLE_BOTTOM_ANGLE + ((1 - ARC_FILL_RATIO) * CIRCLE) / 2
const ARC_END_ANGLE = ARC_START_ANGLE + ARC_FILL_RATIO * CIRCLE
const ARC_SIZE = 478
const ARC_RADIUS = ARC_SIZE / 2
const STEP_LENGTH = 13
const STEP_EDGE_OFFSET = 19
const NEEDLE_LENGTH = ARC_RADIUS - STEP_LENGTH - STEP_EDGE_OFFSET - 10
const TARGET_TICK_OUTER_RADIUS = ARC_RADIUS - STEP_EDGE_OFFSET + 3
const TARGET_TICK_LENGTH = STEP_LENGTH + 6
const TARGET_TICK_INNER_RADIUS = TARGET_TICK_OUTER_RADIUS - TARGET_TICK_LENGTH

function valueToAngleRad(value, min, max) {
    const range = max - min
    const clampedValue = Math.max(min, Math.min(value, max))
    const relativeValue = (clampedValue - min) / range
    return ARC_START_ANGLE + relativeValue * (ARC_END_ANGLE - ARC_START_ANGLE)
}
function toDeg(radians) { return radians * (CIRCLE_DEG / CIRCLE) }

// The printed steps (Meter.tsx): [x1, y1, x2, y2] per step, in the 478 px square.
function stepLines(min, max, step) {
    const steps = (max - min) / step + 1
    const out = []
    for (let i = 0; i < steps; i++) {
        const angle = ARC_START_ANGLE + (i / (steps - 1)) * (ARC_END_ANGLE - ARC_START_ANGLE)
        const start = ARC_RADIUS - STEP_EDGE_OFFSET
        const end = start - STEP_LENGTH
        out.push([ARC_RADIUS + Math.cos(angle) * start, ARC_RADIUS + Math.sin(angle) * start,
                  ARC_RADIUS + Math.cos(angle) * end, ARC_RADIUS + Math.sin(angle) * end])
    }
    return out
}

// ---- manualTarget.ts
const MANUAL_MIN_TENTHS = 0
const MANUAL_MAX_TENTHS = 120
const TRAIL_WINDOW_MS = 400
const TRAIL_HISTORY_MS = 2000

function clampTenths(tenths) { return Math.max(MANUAL_MIN_TENTHS, Math.min(MANUAL_MAX_TENTHS, tenths)) }
function toTenths(bar) { return Math.round(bar * 10) }
function toBar(tenths) { return tenths / 10 }

// Appends a sample, ignoring repeats, and trims history older than TRAIL_HISTORY_MS; the most recent
// sample always stays.
function pushSample(history, tenths, now) {
    const last = history[history.length - 1]
    const next = last && last.tenths === tenths ? history.slice() : history.concat([{ tenths: tenths, t: now }])
    const cutoff = now - TRAIL_HISTORY_MS
    const trimmed = next.filter(sample => sample.t >= cutoff)
    return trimmed.length > 0 ? trimmed : next.slice(-1)
}

// The sweep behind the tick: from the last sample at or before the window start (or the oldest), to the
// latest. null once they are the same (the tail retracts into the marker; it never fades).
function computeTrail(history, now) {
    if (history.length === 0) return null
    const last = history[history.length - 1]
    const toTenthsValue = last.tenths
    const windowStart = now - TRAIL_WINDOW_MS
    let fromTenths = history[0].tenths
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].t <= windowStart) {
            fromTenths = history[i].tenths
            break
        }
    }
    if (fromTenths === toTenthsValue) return null
    return { fromTenths: fromTenths, toTenths: toTenthsValue }
}

// ---- trailGeometry.ts: the comet in the marker's frame (head at local angle 0, the tip at -delta), as
// the SVG path React draws. The Qt trail (TrailArc.qml) draws the same shape with a shader from `delta`;
// this is kept for the tests and as the reference.
const TRAIL_SEGMENT_RAD = Math.PI / 180

function pointAt(angle, radius) { return [ARC_RADIUS + Math.cos(angle) * radius, ARC_RADIUS + Math.sin(angle) * radius] }
function fmt(value) { return value.toFixed(2) }

function buildTrailGeometry(deltaRad) {
    if (!isFinite(deltaRad) || deltaRad === 0) return null
    const outer = TARGET_TICK_OUTER_RADIUS
    const inner = TARGET_TICK_INNER_RADIUS
    const tipAngle = -deltaRad
    const tip = pointAt(tipAngle, outer)
    const headOuter = pointAt(0, outer)
    const headInner = pointAt(0, inner)
    const largeArc = Math.abs(deltaRad) > Math.PI ? 1 : 0
    const sweep = deltaRad > 0 ? 1 : 0
    const segments = Math.max(2, Math.ceil(Math.abs(deltaRad) / TRAIL_SEGMENT_RAD))
    const taper = []
    for (let k = 1; k <= segments; k++) {
        const angle = tipAngle * (k / segments)
        const remaining = 1 - k / segments
        const radius = outer - (outer - inner) * remaining
        const p = pointAt(angle, radius)
        taper.push("L" + fmt(p[0]) + " " + fmt(p[1]))
    }
    const path = ["M" + fmt(tip[0]) + " " + fmt(tip[1]),
                  "A" + outer + " " + outer + " 0 " + largeArc + " " + sweep + " " + fmt(headOuter[0]) + " " + fmt(headOuter[1]),
                  "L" + fmt(headInner[0]) + " " + fmt(headInner[1])].concat(taper).concat(["Z"]).join(" ")
    return { path: path, gradient: { x1: tip[0], y1: tip[1], x2: headOuter[0], y2: headOuter[1] } }
}
