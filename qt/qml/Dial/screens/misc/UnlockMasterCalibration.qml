// The lock in front of the scale's master calibration (UnlockScreen.tsx's UnlockMasterCalibration), opened
// from the manufacturing menu: "8888" then ok starts it (action scale_master_calibration) and goes home,
// failed or not; any other code does nothing. Cancel goes home with the manufacturing menu open again.
import QtQuick
import Dial

Item {
    id: lock
    anchors.fill: parent

    property string password: ""

    // startMasterCalibration (api.ts): errors are logged and swallowed.
    function startMasterCalibration() {
        return Api.executeAction("scale_master_calibration").catch(error => {
            console.error("Start profile error: ", error && error.message)
        })
    }

    CircleKeyboard {
        name: "Unlock Master Calibration"
        defaultValue: lock.password
        onSubmitted: {
            if (lock.password !== "8888") return
            lock.startMasterCalibration().then(() => Nav.setScreen("profileHome"))
        }
        onCancelled: {
            Nav.setScreen("profileHome")
            Nav.setBubbleDisplay({ visible: true, component: "manufacturingSettings" })
        }
        onEdited: (text) => { lock.password = text }
    }
}
