.pragma library
// The power save (ErP standby) timeout: after standby_timeout minutes without use on an idle machine the
// backend puts the ESP32 and the SoC to sleep. ErP allows at most 20 minutes; 0 is "Off", the backend's
// value for power save turned off. Like the manual mode's final weight, Off sits outside the gauge: a long
// press turns it off and the first detent brings back the time the user had.

const POWER_SAVE_OFF = 0
const POWER_SAVE_MIN = 1
const POWER_SAVE_MAX = 20
const POWER_SAVE_STEP = 1
// The backend's default, and where the gauge resumes when power save was off from the start.
const POWER_SAVE_DEFAULT = 15

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }

function isPowerSaveOff(minutes) { return minutes === POWER_SAVE_OFF }

// The stored timeout, or the default while the settings do not have one (a backend without power save).
function timeoutOf(settings) {
    const minutes = settings ? settings.standby_timeout : undefined
    return typeof minutes === "number" ? minutes : POWER_SAVE_DEFAULT
}

function nextTimeout(current, previousEnabled, direction) {
    if (isPowerSaveOff(current)) {
        const resume = previousEnabled === null || previousEnabled === undefined ? POWER_SAVE_DEFAULT : previousEnabled
        return clamp(resume, POWER_SAVE_MIN, POWER_SAVE_MAX)
    }
    return clamp(current + (direction === "left" ? -POWER_SAVE_STEP : POWER_SAVE_STEP), POWER_SAVE_MIN, POWER_SAVE_MAX)
}

// The value in the config menu: "Power save: 15 min" or "Power save: Off".
function label(minutes) { return isPowerSaveOff(minutes) ? "Off" : minutes + " min" }

// The legend under the gauge: what the knob does from here, then (while on) that sleeping may end a preheat.
function legend(minutes) {
    if (isPowerSaveOff(minutes)) return ["Rotate knob to set the time", "Click to save"]
    return ["Long press turns power save off", "Power save may override the preheat", "Click to save"]
}
