// A numerical setting of the profile being edited (src/components/SettingNumerical/SettingNumerical.tsx):
// the gauge of Profiles.settingsProfile.settings[settingsIndex]; the knob steps it by the type's interval
// (stopping only when it lands exactly on the maximum or the minimum, as in React), a push returns to the
// editor. The route prop `type` picks the interval, the unit and the range.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property string type: ""

    readonly property var unitSettingConfigMap: ({
        pressure: { interval: 0.1, unit: "bar", maxValue: 13 },
        piston_position: { interval: 1, unit: "percentage", maxValue: 100 },
        motor_power: { interval: 1, unit: "percentage", minValue: -99, maxValue: 100 },
        temperature: { interval: 0.5, unit: "celcius", maxValue: 99 },
        output: { interval: 0.5, unit: "gram", maxValue: 100 },
        flow: { interval: 0.1, unit: "ml", maxValue: 12 },
        time: { interval: 0.1, unit: "sec", maxValue: 180 },
        weight: { interval: 0.1, unit: "gram", maxValue: 2000 }
    })
    readonly property var config: unitSettingConfigMap[type] || { interval: 0, maxValue: 0, unit: "gram" }

    readonly property var setting: Profiles.settingsProfile && Profiles.settingsProfile.settings
                                   ? Profiles.settingsProfile.settings[Profiles.settingsIndex] : null
    readonly property real total: Number((setting && setting.value) || 0)
    readonly property real dialProbe_value: total

    function roundPrecision(v, p) {
        const multiplier = Math.pow(10, p || 0)
        return Math.round(v * multiplier) / multiplier
    }

    // Each step builds on the stored profile (not on what was last drawn).
    function updateValue(gesture) {
        const prev = Profiles.settingsProfile
        if (!prev || !prev.settings) return
        const index = Profiles.settingsIndex
        const currentSetting = prev.settings[index]
        const currentTotal = Number((currentSetting && currentSetting.value) || 0)
        if ((currentTotal === config.maxValue && gesture === "right")
                || (currentTotal === (config.minValue || 0) && gesture === "left"))
            return
        const mTotal = currentTotal + (gesture === "left" ? -config.interval : config.interval)
        const value = type === "output" ? mTotal : roundPrecision(mTotal, 1)
        const updated = Object.assign({}, currentSetting, { value: value })
        Profiles.settingsProfile = Object.assign({}, prev, {
            settings: prev.settings.slice(0, index).concat([updated], prev.settings.slice(index + 1))
        })
    }

    DimScreen {}

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.updateValue("left")
        onTurnRight: screen.updateValue("right")
        onPressDown: Nav.setScreen("pressetSettings")
    }

    Gauge {
        unit: screen.config.unit
        minValue: screen.config.minValue
        maxValue: screen.config.maxValue
        precision: screen.config.interval < 1 ? 1 : 0
        value: screen.total
    }
}
