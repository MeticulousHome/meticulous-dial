// The heating screen (src/components/Heating/HeatingScreen.tsx) in its ModularScreen: left, the water
// bubbles coloured by the temperature; right, AUTO BREW / PUSH TO BREW / BREW NOW, the temperature rolling
// and the target; below, the estimated time. "click to start" (heating finished): the options leave
// (unless AUTO BREW, which then starts the shot), both halves slide 95 px right in 0.6 s, the target fades
// and the footer reads "Push to brew"; a click or a long press starts the shot (push to brew, brew now).
// Without water: "No water", the bubbles drain and go grey, "Waiting... / Tap to retry".
//
// ModularScreen (modular.less): the area under the 115 px header; the left and right halves are 250 px
// tall with a 10 px padding, their content centered; the footer starts 250 px down.
import QtQuick
import Dial
import "BrewLogic.js" as Logic

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    // The socket "action" events this screen sent (a test probe).
    property var sentActions: []
    readonly property var dialProbe_sent: sentActions
    function send(name) {
        sentActions = sentActions.concat([name])
        Backend.action(name)
    }

    readonly property int headerTop: 115

    // ---- state (HeatingScreen's selectors and useState)
    readonly property bool waterStatus: Stats.waterStatus
    readonly property int temperature: Math.round(Stats.sensors.t) || 0
    readonly property var temperatureTargetStatus: Stats.setpoints.temperature
    property real temperatureTarget: temperatureTargetStatus || 0
    property string optionSelected: "push_to_brew"
    readonly property bool heatingFinished: Stats.name === "click to start"

    // Test probes
    readonly property bool dialProbe_heatingFinished: heatingFinished
    readonly property int dialProbe_temperature: temperature
    readonly property string dialProbe_option: optionSelected
    readonly property real dialProbe_temperatureTarget: temperatureTarget
    readonly property string dialProbe_estimate: estimate.text

    // "The stages dont necessarily correctly report the temperature target": cache it, and fall back on the
    // last profile's temperature.
    Connections {
        target: Profiles
        function onLastProfileChanged() { screen.lastProfileEffect() }
        function onProfileStartingChanged() { screen.idleEffect() }
    }
    function lastProfileEffect() {
        const last = Profiles.lastProfile
        if (last && last.profile && temperatureTarget == 0) temperatureTarget = last.profile.temperature || 0
    }
    onTemperatureTargetStatusChanged: {
        if (temperatureTargetStatus && temperatureTargetStatus > 0) temperatureTarget = temperatureTargetStatus
    }

    // Back home once the machine is idle again (no notification waiting, not just starting).
    Connections {
        target: Stats
        function onNameChanged() { screen.idleEffect() }
    }
    function idleEffect() {
        if (Stats.name === "idle" && !Notifications.hasNotifications && !Profiles.profileStarting) Nav.setScreen("profileHome")
    }

    // Auto brew starts the shot as soon as heating is done.
    function autoStartEffect() {
        if (!heatingFinished) return
        if (optionSelected === "auto_start") {
            send("continue")
            console.log("action,continue")
        }
    }
    onHeatingFinishedChanged: autoStartEffect()
    onOptionSelectedChanged: autoStartEffect()

    Component.onCompleted: {
        lastProfileEffect()
        idleEffect()
        autoStartEffect()
    }

    function startBrew() {
        send("continue")
        console.log("action,continue")
    }
    // A brew screen: a double click reaches the machine, but only the barometer may finish.
    function brewDoubleClick() {
        const decision = Logic.decideDoubleClick({ name: Stats.name, extracting: Stats.extracting }, { allowFinish: false })
        console.log("doubleClick decision", JSON.stringify({ screen: Nav.screen, decision: decision, name: Stats.name, extracting: Stats.extracting }))
        if (decision) send(decision)
    }

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onClick: Logic.createStartBrewGestureHandlers(screen.heatingFinished, screen.optionSelected, screen.startBrew).click()
        onLongEncoder: Logic.createStartBrewGestureHandlers(screen.heatingFinished, screen.optionSelected, screen.startBrew).longEncoder()
        onDoubleClick: screen.brewDoubleClick()
    }

    // translateX(heatingFinished ? 10 + BUBBLES_WIDTH / 2 : 0), transition transform 0.6s (ease)
    property real shift: heatingFinished ? 95 : 0
    Behavior on shift {
        NumberAnimation { duration: 600; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
    }

    // ---- left: the bubbles, right-aligned against the middle, centered in the 230 px content
    BubbleAnimation {
        x: 230 - width + screen.shift
        y: screen.headerTop + 10 + 115 - height / 2
        temperature: screen.temperature
        waterStatus: screen.waterStatus
    }

    // ---- right
    // The options: CSSTransition "fade-options", in while heating or on AUTO BREW; 600 ms (ease) of height
    // 0 <-> 114, margin-top -20 <-> 0, margin-bottom 0 <-> 20 and opacity, unmounted after leaving.
    readonly property bool menuIn: !heatingFinished || optionSelected === "auto_start"
    property bool menuMounted: menuIn
    property real menuProgress: menuIn ? 1 : 0
    onMenuInChanged: {
        if (menuIn) {
            menuMounted = true
            menuProgress = 0
            menuAnim.to = 1
        } else {
            menuAnim.to = 0
        }
        menuAnim.restart()
    }
    NumberAnimation {
        id: menuAnim
        target: screen
        property: "menuProgress"
        duration: 600
        easing.type: Easing.Bezier
        easing.bezierCurve: Motion.EASE
        onFinished: if (!screen.menuIn) screen.menuMounted = false
    }
    readonly property real menuSpace: menuMounted ? -20 * (1 - menuProgress) + 114 * menuProgress + 20 * menuProgress : 0
    readonly property real rightHeight: menuSpace + tempRow.height
    readonly property real rightTop: headerTop + 10 + (230 - rightHeight) / 2

    Item {
        id: menuBox
        visible: screen.menuMounted
        x: 250 + screen.shift
        y: screen.rightTop - 20 * (1 - screen.menuProgress)
        width: 220
        height: 114 * screen.menuProgress
        opacity: screen.menuProgress
        clip: true
        Loader {
            active: screen.menuMounted
            sourceComponent: HeatingOptions {
                ignoreGestures: screen.heatingFinished || Nav.bubbleInterceptsGesture
                onOptionChange: (key) => screen.optionSelected = key
                onOptionHold: (key) => {
                    if (key === "brew_now" && !screen.heatingFinished) screen.startBrew()
                }
            }
        }
    }

    // The temperatures: a row 15 px in from the left and 10 px from the right, space-between.
    Item {
        id: tempRow
        x: 265 + screen.shift
        y: screen.rightTop + screen.menuSpace
        width: 195
        height: Math.max(leftBox.height, target.mounted ? (target.hasValues ? 51 : 11) : 0)

        // SwitchTransition keyed on the water status: fade out 300 ms, then the new one in.
        property string key: String(screen.waterStatus)
        property string shownKey: key
        onKeyChanged: leftSwitch.restart()
        SequentialAnimation {
            id: leftSwitch
            NumberAnimation { target: leftBox; property: "opacity"; to: 0; duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
            ScriptAction { script: tempRow.shownKey = tempRow.key }
            NumberAnimation { target: leftBox; property: "opacity"; to: 1; duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
        }

        Item {
            id: leftBox
            readonly property bool showTemperature: tempRow.shownKey === "true" || screen.heatingFinished
            readonly property bool sensorError: screen.temperature > 500
            width: showTemperature && !sensorError ? bigTemp.width : statusLabel.width
            height: showTemperature && !sensorError ? bigTemp.height : statusLabel.height
            Temperature {
                id: bigTemp
                visible: leftBox.showTemperature && !leftBox.sensorError
                value: screen.temperature
                animated: true
            }
            // StatusLabel: 16 px upper case, 3 px spacing, line-height 120 %, padding 4 / 8.
            Item {
                id: statusLabel
                visible: !bigTemp.visible
                width: Math.min(statusText.implicitWidth, tempRow.width - target.width)
                height: statusText.height + 12
                Text {
                    id: statusText
                    y: 4
                    width: parent.width
                    text: leftBox.showTemperature ? Logic.sensorErrorLabel(screen.temperature) : "No water"
                    color: "white"
                    wrapMode: Text.WordWrap
                    lineHeightMode: Text.FixedHeight
                    lineHeight: 19.2
                    font.family: Theme.fontRegular
                    font.pixelSize: 16
                    font.letterSpacing: 3
                    font.capitalization: Font.AllUppercase
                }
            }
        }

        // Target: CSSTransition "fade" in while heating, 300 ms, unmounted after leaving.
        Item {
            id: target
            readonly property bool shownIn: !screen.heatingFinished
            property bool mounted: shownIn
            visible: mounted
            opacity: shownIn ? 1 : 0
            Behavior on opacity {
                NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
            }
            onShownInChanged: if (shownIn) mounted = true
            onOpacityChanged: if (opacity === 0 && !shownIn) mounted = false
            readonly property bool hasValues: screen.temperature > 0 && screen.temperature <= 500
            width: hasValues ? Math.max(targetLabel.implicitWidth, smallTemp.width) : 0
            height: tempRow.height
            x: tempRow.width - width
            Text {
                id: targetLabel
                visible: target.hasValues
                y: 4
                height: 15
                verticalAlignment: Text.AlignVCenter
                text: "Target"
                color: "#99e7e7e7"
                font.family: Theme.fontRegular
                font.weight: Font.Light
                font.pixelSize: 15
                font.letterSpacing: 3
                font.capitalization: Font.AllUppercase
            }
            Temperature {
                id: smallTemp
                visible: target.hasValues
                y: target.height - 7 - height
                value: screen.temperatureTarget
                small: true
            }
        }
    }

    // ---- footer: ModularFooter (top 250, padding 10, centered column, gap 13), keyed on
    // heatingFinished-waterStatus with the same 300 ms fade out / in.
    readonly property var estimate: Logic.preheatTimeLeft(waterStatus, temperatureTargetStatus, temperatureTarget, temperature)
    Item {
        id: footer
        x: 20
        y: screen.headerTop + 250
        width: 440
        height: 480 - y

        property string key: screen.heatingFinished + "-" + screen.waterStatus
        property string shownKey: key
        onKeyChanged: footerSwitch.restart()
        SequentialAnimation {
            id: footerSwitch
            NumberAnimation { target: footerContent; property: "opacity"; to: 0; duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
            ScriptAction { script: footer.shownKey = footer.key }
            NumberAnimation { target: footerContent; property: "opacity"; to: 1; duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE }
        }

        Item {
            id: footerContent
            anchors.fill: parent
            readonly property bool finished: footer.shownKey.indexOf("true-") === 0
            readonly property bool water: footer.shownKey.slice(-4) === "true"

            Text {
                visible: !footerContent.finished
                x: 10
                y: 10
                width: 420
                height: 15
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                text: footerContent.water ? "Estimated time" : "Waiting..."
                color: "#99e7e7e7"
                font.family: Theme.fontRegular
                font.weight: Font.Light
                font.pixelSize: 15
                font.letterSpacing: 3
                font.capitalization: Font.AllUppercase
            }
            Text {
                visible: !footerContent.finished
                x: 10
                y: 10 + 15 + 13
                width: 420
                height: screen.estimate.big ? 40 : 20
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                text: screen.estimate.text
                color: "white"
                font.family: Theme.fontMono
                font.weight: screen.estimate.big ? Font.Light : Font.Normal
                font.pixelSize: screen.estimate.big ? 40 : 20
                font.letterSpacing: screen.estimate.big ? -0.8 : -0.4
            }
            // PushToStartLabel: 20 px, 4 px spacing, #e7e7e7, upper case, its bottom 60 px from the end
            // (line-height normal is 1 em with ABC Diatype in the Dial's WebKit).
            Text {
                id: pushLabel
                visible: footerContent.finished
                width: parent.width
                height: 20
                y: parent.height - 60 - height
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                text: "Push to brew"
                color: "#e7e7e7"
                font.family: Theme.fontRegular
                font.pixelSize: 20
                font.letterSpacing: 4
                font.capitalization: Font.AllUppercase
            }
        }
    }
}
