// The heating screen's OptionsMenu (src/components/Heating/OptionsMenu.tsx): AUTO BREW, PUSH TO BREW and
// BREW NOW, 220 x 38 px rows (ABC Diatype 20 px light, 4 px letter spacing, upper case, 40 px line, 20 px
// left padding). The active row is yellow with black text, except BREW NOW: selecting it runs a 2 s linear
// fill (the yellow grows from the left, the text goes from white to black), then the row goes back to
// transparent and optionHold("brew_now") fires; leaving it before the end cancels the fill.
// It starts on AUTO BREW and moves to the auto_start_shot setting once known (both effects run on mount).
import QtQuick
import Dial

Item {
    id: menu
    property bool ignoreGestures: false
    signal optionChange(string key)
    signal optionHold(string key)

    readonly property int optionHeight: 38
    readonly property var options: [
        { key: "auto_start", label: "Auto brew" },
        { key: "push_to_brew", label: "Push to brew" },
        { key: "brew_now", label: "Brew now", autoActivate: true }
    ]
    property int activeIndex: 0
    property string holdAnimation: "stopped"    // stopped | running | finished
    property real holdProgress: 0
    readonly property string dialFocusedLabel: options[activeIndex].label

    width: 220
    height: options.length * optionHeight
    clip: true

    readonly property var autoStartShot: BackendSettings.data ? BackendSettings.data.auto_start_shot : undefined
    function applySetting() {
        if (!BackendSettings.data) return
        activeIndex = BackendSettings.data.auto_start_shot ? 0 : 1
    }
    onAutoStartShotChanged: applySetting()

    function onActiveIndexEffect() {
        optionChange(options[activeIndex].key)
        if (options[activeIndex].autoActivate) {
            holdAnimation = "running"
            fill.restart()
        } else {
            fill.stop()
            holdAnimation = "stopped"
            holdProgress = 0
        }
    }
    onActiveIndexChanged: onActiveIndexEffect()
    Component.onCompleted: {
        // Effects in declaration order: the setting (a state update for later), then the index (still 0).
        Qt.callLater(() => { onActiveIndexEffect(); applySetting() })
    }

    NumberAnimation {
        id: fill
        target: menu
        property: "holdProgress"
        from: 0
        to: 1
        duration: 2000
        onFinished: {
            menu.holdAnimation = "finished"
            menu.holdProgress = 0
            menu.optionHold(menu.options[menu.activeIndex].key)
        }
    }

    GestureHandler {
        enabled: !menu.ignoreGestures
        onTurnLeft: menu.activeIndex = Math.max(menu.activeIndex - 1, 0)
        onTurnRight: menu.activeIndex = Math.min(menu.activeIndex + 1, menu.options.length - 1)
    }

    Repeater {
        model: menu.options.length
        delegate: Rectangle {
            id: entry
            required property int index
            readonly property var option: menu.options[index]
            readonly property bool active: index === menu.activeIndex
            // $holdAnimation is null for the rows without auto_activate.
            readonly property bool solid: active && !option.autoActivate
            readonly property bool filling: active && !!option.autoActivate && menu.holdAnimation === "running"
            y: index * menu.optionHeight
            width: menu.width
            height: menu.optionHeight
            radius: 4
            color: entry.solid ? Theme.brandYellow : "transparent"

            // background-position 100% -> 0%: the yellow half slides in from the left, its right edge
            // straight, the row's rounded corners on the left.
            Rectangle {
                visible: entry.filling && width > 0
                width: menu.holdProgress * entry.width
                height: entry.height
                radius: 4
                color: Theme.brandYellow
            }
            Rectangle {
                visible: entry.filling && width > 0
                x: Math.max(0, menu.holdProgress * entry.width - 4)
                width: Math.min(4, menu.holdProgress * entry.width)
                height: entry.height
                color: Theme.brandYellow
            }
            Text {
                x: 20
                height: 40
                verticalAlignment: Text.AlignVCenter
                text: entry.option.label
                color: entry.solid ? "black"
                     : entry.filling ? Qt.rgba(1 - menu.holdProgress, 1 - menu.holdProgress, 1 - menu.holdProgress, 1)
                     : "white"
                font.family: Theme.fontRegular
                font.weight: Font.Light
                font.pixelSize: 20
                font.letterSpacing: 4
                font.capitalization: Font.AllUppercase
            }
        }
    }
}
