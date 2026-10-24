pragma Singleton
// The socket.io link to the backend (SocketProviderValue.tsx / SocketManager.tsx): every server event into
// the stores, and the machine's state into screens (heating, brewComplete, manual-purge, barometer).
import QtQuick
import Dial.Native

QtObject {
    id: backend

    readonly property bool connected: Socket.connected
    property string _previousStateName: "idle"

    // A dispatched report arrived (UploadReportEvent); the bug report feature collects and uploads it.
    signal uploadReport(var event)
    signal connectedToServer()

    // socket.emit('action', name): start | stop | tare | scale_master_calibration | preheat | continue |
    // finish | home | purge | abort
    function action(name) { Socket.emitEvent("action", name) }
    // useContinueBrewAction
    function continueBrew() { action("continue") }
    function emitEvent(name, data) { Socket.emitEvent(name, data) }

    property Connections _socket: Connections {
        target: Socket
        function onConnectedToServer() {
            Profiles.refetchPourOver()
            backend.connectedToServer()
        }
        function onEvent(name, data) {
            switch (name) {
            case "status": backend.onStatus(data); break
            case "sensors": Stats.setSensors(data); break
            case "button": Input.handleButton(data); break
            case "notification": backend.onNotification(data); break
            case "heater_status": Stats.updatePreheatTimeLeft(data); break
            case "water_status":
                Idle.resetTimer()
                Stats.setWaterStatus(data)
                break
            case "profile": backend.onProfile(data); break
            case "profileHover":
                Idle.resetTimer()
                if (data && data.from !== "dial") Profiles.onProfileHover(data.type, data.id)
                break
            case "OSUpdate": Device.setOSStatus(data); break
            case "upload_report": backend.uploadReport(data); break
            case "settings": BackendSettings.refetch(); break
            }
        }
    }

    function onNotification(raw) {
        Idle.resetTimer()
        let notification
        try { notification = typeof raw === "string" ? JSON.parse(raw) : raw } catch (e) {
            console.error("Bad notification", raw)
            return
        }
        const processed = Notifications.process(notification)
        if (processed.isMotorHot !== null) Notifications.setMotorHot(processed.isMotorHot)
        const n = processed.updatedNotification
        if (!n.message && !n.image) Notifications.removeOne(n.id)
        else Notifications.addOne(n)
    }

    function onProfile(event) {
        console.log("ProfileUpdate " + JSON.stringify(event))
        if (event && event.brew_type === "pour_over") {
            Profiles.refetchPourOver()
            return
        }
        // The manual profile is not in the catalog: the backend hides it and the dial saves it from the
        // setup flow itself.
        if (event && event.profile_id === Constants.MANUAL_MODE_PROFILE_ID) return
        Profiles.onProfileEvent(event)
    }

    function onStatus(data) {
        const previousState = _previousStateName
        if (data) _previousStateName = data.name
        Stats.setStats(data)
        const name = data ? data.name : undefined
        if (previousState === name) return

        // Every status change resets the idle timer
        Idle.resetTimer()
        Profiles.refetchLast()
        Profiles.profileStarting = false

        if (name === "heating") {
            Stats.setWaterStatus(true)
            Nav.setScreen("heating")
            return
        }
        if (name === "Pour water and click to continue") {
            Stats.setWaterStatus(false)
            Nav.setScreen("heating")
            return
        }
        if (name === "click to start") {
            Stats.setWaterStatus(true)
            Nav.setScreen("heating")
            return
        }
        if (Constants.isBrewComplete(name) || (Constants.isBrewComplete(previousState) && name === "purge")) {
            Nav.setScreen("brewComplete")
            return
        }
        // Brew complete screen takes precedence here when purging
        if (name === "purge" || name === "home") {
            Nav.setScreen("manual-purge")
            return
        }
        // We ignore the boot state but ensure the machine is in idle
        if (name === "boot" && data && data.state === "idle") return
        // When the machine is not in a hidden stage, lock the screen at Barometer
        if (Constants.HIDDEN_STAGES.indexOf(name) < 0) Nav.setScreen("barometer")
    }
}
