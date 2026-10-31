.pragma library
// Disturbance resilience: the backend setting disturbance_resilience (bool, off when absent), which the
// machine's firmware stores and uses to choose what ends the shot: the Kalman prediction that ignores bumps
// on the scale (on) or the plain one that sticks to the weight target (off). The config menu shows it with
// its value and opens DisturbanceResilienceScreen.qml, two pills whose copy follows the focused one.
// Tested by qt/tests/js/disturbanceResilience.test.mts.

var SETTING_KEY = "disturbance_resilience"
var LABEL = "disturbance resilience"
var TITLE = "Disturbance resilience"

// The two pills, Disabled first; the copy is the one of the focused pill.
var CHOICES = [
    { key: "disabled", label: "Disabled", value: false,
      copy: "The machine will prioritize the weight target over scale disturbances on high flow profiles." },
    { key: "enabled", label: "Enabled", value: true,
      copy: "The machine will prioritize ignoring scale disturbances over the weight target on high flow profiles." }
]

// The value the backend has, off while unknown or when the backend does not send the setting.
function isEnabled(settings) {
    return !!settings && settings[SETTING_KEY] === true
}

// Hidden only when the machine says its firmware cannot store it (disturbance_resilience_supported: false).
// Without device info, or from a backend that does not send the field, the item shows and a save that the
// backend refuses goes through the error path.
function isAvailable(deviceInfo) {
    return !(deviceInfo && deviceInfo.disturbance_resilience_supported === false)
}

// The config menu's label, as sounds shows its own; without settings the label alone.
function menuLabel(settings) {
    if (!settings) return LABEL
    return LABEL + ": " + (isEnabled(settings) ? "ENABLED" : "DISABLED")
}

// The pill focused when the screen opens: the stored value (Disabled while unknown).
function initialIndex(settings) {
    return isEnabled(settings) ? 1 : 0
}

// The text of a failed update: BackendSettings.update rejects with an Error, Api.request with
// { status, data, message } (data.error is the backend's message on a 400).
function errorMessage(error) {
    if (!error) return "unknown error"
    if (error.data && error.data.error) return String(error.data.error)
    if (error.message) return String(error.message)
    return String(error)
}
