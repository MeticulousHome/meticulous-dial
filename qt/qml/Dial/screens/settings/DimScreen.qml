// useDimScreen (src/hooks/useDimScreen.ts): while the screen that holds it is shown, the backlight goes to 0
// when the idle timer fires and back to 1 when it is reset (only on changes, not on mount).
import QtQuick
import Dial

Item {
    width: 0
    height: 0
    visible: false

    Connections {
        target: Idle
        function onIsIdleChanged() {
            Api.setBrightness({ brightness: Idle.isIdle ? 0 : 1 })
                .catch(e => console.error("Error setting brightness", e && e.message ? e.message : e))
        }
    }
}
