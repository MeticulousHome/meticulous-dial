// useDimScreen (src/hooks/useDimScreen.ts) for the screens that keep the Dial awake on their own (profile
// settings, profile image, Wi-Fi password, manual setup, edit name): when the idle timer fires the screen
// goes dark (brightness 0), and back to 1 when it is reset; nothing on mount.
//   import "../idle"
//   DimScreen {}
// updateBrightness(brightness) is the React updateBrightness.
import QtQuick
import Dial

QtObject {
    function updateBrightness(brightness) {
        return Api.setBrightness({ brightness: brightness })
            .catch(e => console.error("Error setting brightness", e && e.message ? e.message : e))
    }

    property Connections _idle: Connections {
        target: Idle
        function onIsIdleChanged() { updateBrightness(Idle.isIdle ? 0 : 1) }
    }
}
