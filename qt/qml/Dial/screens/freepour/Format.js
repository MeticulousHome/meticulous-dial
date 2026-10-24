.pragma library
// src/features/freePour/format.ts

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
}

function roundTo(value, decimals) {
    if (decimals === undefined) decimals = 1
    const multiplier = Math.pow(10, decimals)
    return Math.round(value * multiplier) / multiplier
}

function formatBrewTime(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000))
    const minutes = Math.floor(seconds / 60)
    return minutes + ":" + String(seconds % 60).padStart(2, "0")
}

function formatClockTime(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000))
    if (seconds < 60) return seconds + "s"
    return formatBrewTime(milliseconds)
}
