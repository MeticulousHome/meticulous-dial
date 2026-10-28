// Power save (ErP standby), a full-screen route opened from the config menu: a gauge of the minutes without
// use before the machine sleeps, 1 to 20 in 1 min steps, or "Off" (standby_timeout 0). A long press turns
// it off, the first detent from Off brings back the last time, a click saves it and reopens the config
// menu. Until the settings arrive it shows the loading ring and hears nothing.
import QtQuick
import Dial
import "PowerSave.js" as PowerSave
import "../freepour" as FreePour

Item {
    id: screen
    anchors.fill: parent
    property string type: "power_save"
    property bool transitioning: false

    readonly property var settings: BackendSettings.data
    property int localTimeout: PowerSave.POWER_SAVE_DEFAULT
    property var previousEnabledTimeout: null
    property bool initializedFromSettings: false

    function syncFromSettings() {
        localTimeout = PowerSave.timeoutOf(settings)
        previousEnabledTimeout = PowerSave.isPowerSaveOff(localTimeout) ? null : localTimeout
        initializedFromSettings = true
    }
    Component.onCompleted: if (settings) syncFromSettings()
    onSettingsChanged: if (!initializedFromSettings && settings) syncFromSettings()

    readonly property int dialProbe_powerSaveTimeout: localTimeout

    DimScreen {}

    GestureHandler {
        enabled: !!screen.settings && !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.turn("left")
        onTurnRight: screen.turn("right")
        onLongEncoder: {
            if (!PowerSave.isPowerSaveOff(screen.localTimeout)) screen.previousEnabledTimeout = screen.localTimeout
            screen.localTimeout = PowerSave.POWER_SAVE_OFF
        }
        // Saved on click, the push the machine reports on release: pressDown comes before a long press is
        // known to be one, so saving on it would leave every long press unable to reach Off.
        onClick: {
            BackendSettings.update({ standby_timeout: screen.localTimeout }).catch(() => {})
            Nav.setScreen(Nav.prev)
            Nav.setBubbleDisplay({ visible: true, component: "settings" })
        }
    }

    function turn(direction) {
        const next = PowerSave.nextTimeout(localTimeout, previousEnabledTimeout, direction)
        previousEnabledTimeout = next
        localTimeout = next
    }

    LoadingScreen { visible: !screen.settings }

    SettingsGauge {
        visible: !!screen.settings && !PowerSave.isPowerSaveOff(screen.localTimeout)
        value: screen.localTimeout
        maxValue: PowerSave.POWER_SAVE_MAX
        minValue: PowerSave.POWER_SAVE_MIN
        precision: 0
        unit: "min"
    }
    // "Off" as the manual mode's final weight shows it: ABC Diatype Mono 140 px (96 px line), yellow.
    FreePour.FpText {
        visible: !!screen.settings && PowerSave.isPowerSaveOff(screen.localTimeout)
        y: (480 - 96) / 2
        mono: true
        tabular: false
        lineHeightPx: 96
        font.pixelSize: 140
        color: "#f5c444"
        text: "Off"
    }
    // Legend: anchored by its bottom edge 74 px up, lines 15 px tall and 7 px apart (the manual setup's).
    Item {
        visible: !!screen.settings
        readonly property var lines: PowerSave.legend(screen.localTimeout)
        width: 480
        height: lines.length * 15 + (lines.length - 1) * 7
        y: 480 - 74 - height
        Repeater {
            model: parent.lines.length
            FreePour.FpText {
                required property int index
                y: index * (15 + 7)
                tabular: false
                font.pixelSize: 15
                letterSpacingPx: 1.125
                color: "#808080"
                text: parent.lines[index]
            }
        }
    }
}
