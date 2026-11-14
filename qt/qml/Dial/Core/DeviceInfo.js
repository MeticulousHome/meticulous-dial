.pragma library
// GET /api/v1/machine answered before the machine's firmware (the ESP32) sent its first ESPInfo, as right
// after boot: the backend leaves `firmware` out and reports every firmware capability as unsupported
// (tare_behavior_supported false). Device.qml asks again until the firmware is in, so what reads that answer
// (Device Info, open right after boot) does not keep it until the next 2 h poll.
// Tested by qt/tests/js/deviceInfo.test.mts.

// Whether this device info carries what the firmware reported: the backend sends `firmware` only then.
function firmwareReported(info) {
    return !!info && info.firmware !== undefined && info.firmware !== null
}
