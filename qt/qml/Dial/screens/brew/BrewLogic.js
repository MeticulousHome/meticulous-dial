.pragma library
// The pure logic of the brew screens, as the React modules have it (each function names its source). The
// e2e test (qt/tests/e2e/test_brew.py) runs the cases of the React unit tests against this file.
.import "../../Core/Constants.js" as Constants

// ---- src/hooks/brewDoubleClick.ts

// True while the machine runs a user-defined stage of the loaded profile: `extracting` stays true through
// the final retract, so the name check is what keeps the machine-owned tail out.
function isUserStage(s, machineOwnedStages) {
    const owned = machineOwnedStages || Constants.MACHINE_OWNED_STAGES
    return !!s.extracting && owned.indexOf(s.name) < 0
}

// What a double click sends on a brew screen: null (idle), "finish" (a user stage, on the barometer only),
// else "abort".
function decideDoubleClick(s, options) {
    if (s.name === "idle") return null
    if (options.allowFinish && isUserStage(s, options.machineOwnedStages)) return "finish"
    return "abort"
}

// ---- src/components/Heating/startBrewGestures.ts: click and longEncoder start the shot once heating is
// done and the option is "push to brew" or "brew now" (no pressUp handler: a long press starts once).
function createStartBrewGestureHandlers(heatingFinished, optionSelected, onStart) {
    const startBrewOnPress = () => {
        if (heatingFinished && ["push_to_brew", "brew_now"].indexOf(optionSelected) >= 0) onStart()
    }
    return { click: startBrewOnPress, longEncoder: startBrewOnPress }
}

// ---- src/utils/index.ts
function roundPrecision(value, precision) {
    const multiplier = Math.pow(10, precision || 0)
    return Math.round(value * multiplier) / multiplier
}

// formatStatValue(value, padEnd, fixpointFactor): one decimal, ".0" padded on whole numbers. NaN stays "NaN".
function formatStatValue(value, padEnd, fixpointFactor) {
    const finalNumber = String(roundPrecision(value / (fixpointFactor === undefined ? 1 : fixpointFactor), 1))
    if (/^-?[0-9]+$/.test(finalNumber)) return finalNumber + "." + "0".repeat(padEnd)
    return finalNumber
}

// formatTime(seconds): "m:ss"
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return String(minutes) + ":" + String(remainingSeconds).padStart(2, "0")
}

// ---- src/components/Heating/HeatingScreen.tsx

// preheatTimeLeft(): { text, big } — big: the 40 px ModularFooterTime, else the 20 px ModularFooterText.
function preheatTimeLeft(waterStatus, temperatureTargetStatus, temperatureTarget, temperature) {
    if (!waterStatus) return { text: "Tap to retry", big: false }
    if (!temperatureTargetStatus) return { text: "stabilizing...", big: false }
    const diff = temperatureTarget - Math.max(20, temperature)
    if (diff <= 2) return { text: "a few seconds", big: false }
    if (diff <= 5) return { text: "less than 30 seconds", big: false }
    const stabilizingTime = 20
    const heatingTime = 200
    const maxDiff = 80
    const timePerDegree = heatingTime / maxDiff
    const timeIncrements = 15
    const timeLeft = Math.ceil((diff * timePerDegree + stabilizingTime) / timeIncrements) * timeIncrements
    return { text: formatTime(timeLeft), big: true }
}

// SensorErrorLabel: the firmware's temperature error codes (TEMP_ERROR_*), compared with a threshold.
function sensorErrorLabel(temperature) {
    if (Math.abs(temperature - 4000) < 1) return "Temperature calculation failed"
    if (Math.abs(temperature - 2000) < 1) return "Waiting for sensor data to become valid"
    if (Math.abs(temperature - 1000) < 1) return "All sensors offline. Please restart"
    return "Unknown sensor error"
}

// ---- src/components/Heating/LottieBubbleAnimation.tsx: where the temperature sits on the gradient, as
// the background-position-y percentage (0 = grey, without water).
const GRADIENT_COLORS = ["grey", "#280B54", "#280B54", "#480B6A", "#65156E", "#82206C", "#9F2A63", "#BB3755",
                         "#D44842", "#E8602D", "#F44D19", "#F44D19"]
const GRADIENT_TEMP_RANGE_START = 2
const TEMP_RANGE_START = 20
const TEMP_RANGE_END = 90
function bubbleGradientOffset(temperature, waterStatus) {
    if (!waterStatus) return 0
    const ratio = (Math.min(TEMP_RANGE_END, Math.max(TEMP_RANGE_START, temperature)) - TEMP_RANGE_START) / (TEMP_RANGE_END - TEMP_RANGE_START)
    return (GRADIENT_TEMP_RANGE_START + (GRADIENT_COLORS.length - GRADIENT_TEMP_RANGE_START) * ratio) / GRADIENT_COLORS.length * 100
}
// The stops as the CSS writes them: color i at round((i + 1) / 12 * 100) %.
function gradientStops() {
    return GRADIENT_COLORS.map((color, i) => ({ color: color, position: Math.round((i + 1) / GRADIENT_COLORS.length * 100) / 100 }))
}

// ---- src/components/BrewCompleteScreen/BrewCompleteScreen.tsx: the weight readout.
function brewWeight(w) {
    if (isNaN(w)) return String(w)
    return Math.abs(w) < 1000 ? w.toFixed(1) : w.toFixed(0)
}

// ---- src/components/SettingNumerical/Gauge.tsx formatValue: the value, and its leading zeros dimmed.
function gaugeParts(value, precision) {
    const minDigits = 3
    const fractional = precision > 0
    let valueOnly = fractional ? String(roundPrecision(value, precision)) : String(value)
    if (fractional && valueOnly.indexOf(".") < 0) valueOnly = valueOnly + ".0"
    const padded = valueOnly.padStart(minDigits + (fractional ? 1 : 0), "0")
    const padLength = padded.length - (/^[0.]+$/.test(valueOnly) ? 0 : valueOnly.length)
    return { dim: padded.substring(0, padLength), bright: padded.substring(padLength) }
}
