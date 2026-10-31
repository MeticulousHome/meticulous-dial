.pragma library
// The "Disturbance resilience" item of Advanced Settings: the backend setting disturbance_resilience (bool,
// off when absent), which the machine's firmware stores and uses to ignore bumps on the scale when it
// detects the final weight. The value shown is always the backend's: a push asks the backend to save the
// other value and the item only changes once it answered OK (BackendSettings takes the answer as its data).
// Tested by qt/tests/js/disturbanceResilience.test.mts.

var SETTING_KEY = "disturbance_resilience"
var LABEL = "Disturbance resilience"
// Shown in the menu's header after the backend refused the change; the backend's message goes to the log.
var SAVE_FAILED_TEXT = "Could not save"

// The value the backend has, off while unknown or when the backend does not send the setting.
function isEnabled(settings) {
    return !!settings && settings[SETTING_KEY] === true
}

// Hidden only when the machine says its firmware cannot store it (disturbance_resilience_supported: false).
// Without device info, or from a backend that does not send the field, the item shows and a push that the
// backend refuses goes through the error path.
function isAvailable(deviceInfo) {
    return !(deviceInfo && deviceInfo.disturbance_resilience_supported === false)
}

// The value after the label, as SSH shows its own.
function valueText(settings) {
    return isEnabled(settings) ? "ENABLED" : "DISABLED"
}

// The text of a failed update: BackendSettings.update rejects with an Error, Api.request with
// { status, data, message } (data.error is the backend's message on a 400).
function errorMessage(error) {
    if (!error) return "unknown error"
    if (error.data && error.data.error) return String(error.data.error)
    if (error.message) return String(error.message)
    return String(error)
}
