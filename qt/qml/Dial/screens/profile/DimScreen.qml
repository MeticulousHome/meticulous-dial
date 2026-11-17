// useDimScreen (src/hooks/useDimScreen.ts): while the screen is shown, the backlight goes off when the
// Dial turns idle and back on when it wakes (only on changes after the screen appeared).
import QtQuick
import Dial

Item {
    visible: false
    Connections {
        target: Idle
        function onIsIdleChanged() {
            Api.setBrightness({ brightness: Idle.isIdle ? 0 : 1 })
                .catch(error => console.error("Error setting brightness", error && error.message ? error.message : error))
        }
    }
}
