.pragma library
// The animations of the home's "Hold to start": the values the Dial stores, their menu labels, the short
// label Advanced Settings shows, and what each one draws. "default" is the plain ring of the React Dial.
//   ring       the ring that fills: its width, colour, scheme and glow (components/Arc.qml)
//   particles  what flies off it (components/SparkRing.qml): sparks | sparkles | steam | drops, or none
//   waves      rings that move in from the ring while it fills, faster as it fills, and a last quick one
//              when it is full (ProfileHome.qml)
//   start      what the full ring does over the next screen when the profile starts
//              (components/HoldStartWave.qml): glow

const HOLD_ANIMATIONS = [
    { key: "default", label: "Ring", shortLabel: "Ring", particles: "", waves: false, start: "",
      ring: { width: 5, color: "white", scheme: "solid", glow: 0 } },
    { key: "sparks", label: "Sparks", shortLabel: "Sparks", particles: "sparks", waves: false, start: "",
      ring: { width: 3, color: "#ffb45e", scheme: "solid", glow: 0 } },
    { key: "rainbow", label: "Rainbow Sparkles", shortLabel: "Rainbow", particles: "sparkles", waves: false, start: "",
      ring: { width: 3, color: "white", scheme: "rainbow", glow: 0 } },
    { key: "heat", label: "Heat", shortLabel: "Heat", particles: "", waves: false, start: "glow",
      ring: { width: 4, color: "white", scheme: "heat", glow: 10 } },
    { key: "steam", label: "Steam", shortLabel: "Steam", particles: "steam", waves: false, start: "",
      ring: { width: 3, color: "#e0dcd0", scheme: "solid", glow: 0 } },
    { key: "pressure", label: "Pressure", shortLabel: "Pressure", particles: "", waves: true, start: "",
      ring: { width: 3, color: "white", scheme: "solid", glow: 0 } },
    { key: "espresso", label: "Espresso Pour", shortLabel: "Espresso", particles: "drops", waves: false, start: "",
      ring: { width: 6.5, color: "white", scheme: "crema", glow: 0 } }
]

// What the Dial shows for a stored value: the plain ring for anything it does not know (nothing stored yet,
// or a value of a later version after a rollback).
function normalize(key) {
    return HOLD_ANIMATIONS.some(i => i.key === key) ? key : "default"
}

function spec(key) {
    return HOLD_ANIMATIONS.find(i => i.key === normalize(key))
}

function shortLabel(key) {
    return spec(key).shortLabel
}

// Whether anything flies off the ring (SparkRing).
function hasSparks(key) {
    return spec(key).particles !== ""
}
