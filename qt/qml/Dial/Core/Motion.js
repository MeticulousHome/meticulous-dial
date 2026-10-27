.pragma library
// The Dial's motion curves, as the React Dial computes them (src/navigation/spring-physics-plugin.js and the
// keyframes in navigation.less / bubble.less). CSS keyframe animations there sample a spring at every 1 %
// of the animation with t (seconds of spring time) running 0 → 1 over the animation's duration; here the
// same spring is evaluated directly from the animation's progress.

// WebKit's SpringSolver (Figma springs): 0 → 1 at spring time t (seconds).
function spring(t, mass, stiffness, damping, initialVelocity) {
    mass = mass === undefined ? 1 : mass
    stiffness = stiffness === undefined ? 100 : stiffness
    damping = damping === undefined ? 10 : damping
    const v0 = initialVelocity || 0
    const w0 = Math.sqrt(stiffness / mass)
    const zeta = damping / (2 * Math.sqrt(stiffness * mass))
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    const B = zeta < 1 ? (zeta * w0 + -v0) / wd : -v0 + w0
    let x
    if (zeta < 1)
        x = Math.exp(-t * zeta * w0) * (Math.cos(wd * t) + B * Math.sin(wd * t))
    else
        x = (1 + B * t) * Math.exp(-t * w0)
    return 1 - x
}

// The route spring: .spring-interpolate-keyframes(prop, from, to) = mass 1, stiffness 65, damping 10.
function routeSpring(t) { return spring(t, 1, 65, 10) }
// The bubble spring (bubble.less): mass 1, stiffness 51, damping 11.
function bubbleSpring(t) { return spring(t, 1, 51, 11) }

function lerp(from, to, k) { return from + (to - from) * k }

// Piecewise-linear keyframes [[t, value], ...] as CSS interpolates them.
function keyframes(frames, t) {
    if (t <= frames[0][0]) return frames[0][1]
    for (let i = 1; i < frames.length; i++) {
        if (t <= frames[i][0]) {
            const a = frames[i - 1], b = frames[i]
            return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0])
        }
    }
    return frames[frames.length - 1][1]
}

// .fade-in-keyframes / .fade-out-keyframes (navigation.less).
const FADE_IN = [[0, 0], [0.04, 0.4], [0.22, 0.7], [0.23, 0.8], [0.24, 0.9], [1, 1]]
const FADE_OUT = [[0, 1], [0.2, 0], [1, 0]]
function fadeIn(t) { return keyframes(FADE_IN, t) }
function fadeOut(t) { return keyframes(FADE_OUT, t) }

// CSS timing functions as Easing.Bezier curves (the last point is always 1,1).
const EASE = [0.25, 0.1, 0.25, 1, 1, 1]
const EASE_IN = [0.42, 0, 1, 1, 1, 1]
const EASE_OUT = [0, 0, 0.58, 1, 1, 1]
const EASE_IN_OUT = [0.42, 0, 0.58, 1, 1, 1]
const MATERIAL = [0.4, 0, 0.2, 1, 1, 1]   // cubic-bezier(0.4, 0, 0.2, 1): the menus' 150 ms slide

// The route transition (Transitioner): 450 ms.
const ROUTE_DURATION = 450
const ZOOM_OUT_SCALE = 2.3
const ZOOM_IN_SCALE = 0.3
