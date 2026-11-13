// The profile's name (src/components/EditNameScreen): the circular keyboard on the name setting of the
// profile being edited (Profiles.settingsProfile.settings[settingsIndex]). Ok stores the text (trimmed)
// in the setting and returns to the editor; cancel returns without it.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent

    readonly property var setting: Profiles.settingsProfile && Profiles.settingsProfile.settings
                                   ? Profiles.settingsProfile.settings[Profiles.settingsIndex] : null
    // useState(setting.value.toString()): read once.
    property string updatedName: ""
    Component.onCompleted: updatedName = setting && setting.value !== undefined && setting.value !== null ? setting.value.toString() : ""

    function updateSetting(updatedText) {
        const prev = Profiles.settingsProfile
        const index = Profiles.settingsIndex
        const updated = Object.assign({}, screen.setting, { value: updatedText })
        Profiles.settingsProfile = Object.assign({}, prev, {
            settings: prev.settings.slice(0, index).concat([updated], prev.settings.slice(index + 1))
        })
        Nav.setScreen("pressetSettings")
    }

    DimScreen {}

    CircleKeyboard {
        name: "name"
        defaultValue: screen.updatedName
        onSubmitted: (text) => screen.updateSetting(text)
        onCancelled: Nav.setScreen("pressetSettings")
        onEdited: (text) => { screen.updatedName = text }
    }
}
