pragma Singleton
// What the Dial knows about the machine beyond its live state: device info (useDeviceInfo, every 2 h),
// the OS update status (useOSStatus, every 60 s and on the "OSUpdate" event) and whether the backend is
// online (useIsOnline: the socket connected once, and settings and profiles answered).
import QtQuick
import Dial.Native

QtObject {
    id: device

    // DeviceInfo: { name, hostname, firmware, mainVoltage, color, model_version, serial, batch_number,
    //               build_date, software_version, image_build_channel, image_version, manufacturing,
    //               version_history, ... }
    property var info: null
    readonly property bool infoPending: info === null
    property var osStatus: ({ progress: 0, status: "IDLE", info: "" })
    property bool osStatusError: false

    property bool isOnline: false
    property bool _wasConnected: false

    signal cameOnline()

    function refreshInfo() {
        return Api.getDeviceInfo().then(data => {
            if (data && data.error) throw new Error(data.error)
            info = data
            // SentryRuntimeMetadata (App.tsx): the serial, build-version and build-channel tags.
            Sentry.setDeviceInfo(data)
            return data
        }).catch(error => {
            console.error("Error fetching device Info:", error && error.message ? error.message : error)
            _infoRetry.start()
        })
    }
    function refreshOSStatus() {
        return Api.getOSStatus().then(data => {
            osStatus = data
            osStatusError = false
        }).catch(error => {
            osStatusError = true
            console.error("Failed to fetch OS status:", error && error.message ? error.message : error)
        })
    }
    function setOSStatus(data) { if (data) { osStatus = data; osStatusError = false } }

    property Timer _infoPoll: Timer { interval: 2 * 60 * 60 * 1000; running: true; repeat: true; triggeredOnStart: true; onTriggered: device.refreshInfo() }
    property Timer _infoRetry: Timer { interval: 5000; repeat: false; onTriggered: device.refreshInfo() }
    property Timer _osPoll: Timer { interval: 60000; running: true; repeat: true; triggeredOnStart: true; onTriggered: device.refreshOSStatus() }

    // useIsOnline: brief socket drops after being online are fine.
    function _updateOnline() {
        const online = (isOnline || Socket.connected) && BackendSettings.data !== null && Profiles.profilesLoaded
        if (online !== isOnline) {
            isOnline = online
            Profiles.refetch()
            if (online) cameOnline()
        }
    }
    property Connections _socket: Connections { target: Socket; function onConnectedChanged() { device._updateOnline() } }
    property Connections _settings: Connections { target: BackendSettings; function onDataChanged() { device._updateOnline() } }
    property Connections _profiles: Connections { target: Profiles; function onProfilesLoadedChanged() { device._updateOnline() } }
}
