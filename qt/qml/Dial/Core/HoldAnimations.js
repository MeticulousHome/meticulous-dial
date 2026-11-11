.pragma library
// The animations of the home's "Hold to start": the values the Dial stores, their menu labels and the short
// label Advanced Settings shows. "default" is the plain ring of the React Dial.

const HOLD_ANIMATIONS = [
    { key: "default", label: "Ring", shortLabel: "Ring" },
    { key: "sparks", label: "Sparks", shortLabel: "Sparks" },
    { key: "rainbow", label: "Rainbow Sparkles", shortLabel: "Rainbow" }
]

// What the Dial shows for a stored value: the plain ring for anything it does not know (nothing stored yet,
// or a value of a later version after a rollback).
function normalize(key) {
    return HOLD_ANIMATIONS.some(i => i.key === key) ? key : "default"
}

function shortLabel(key) {
    return HOLD_ANIMATIONS.find(i => i.key === normalize(key)).shortLabel
}

// Whether sparks or sparkles fly off the ring (SparkRing).
function hasSparks(key) {
    return normalize(key) !== "default"
}
