// The Dial's menu (src/styles/utils/mixins.ts + calculateOptionPosition.ts), used by the quick settings and
// most settings screens: grey upper-case options in ABC Diatype Mono 22 px, 45 px tall every 61 px (+10 after
// a dashed separator), sliding 150 ms cubic-bezier(0.4, 0, 0.2, 1) so that the active one sits in the yellow
// bar (ActiveIndicator), where the same list shows in black.
//
// Sizes are those of the menu in the 420 px bubble; `width` follows the parent (480 on a full screen).
// The screen handles the gestures and moves activeIndex (or calls next() / previous()).
//
// options: [{ key, label, hasSeparator, longpress, caseSensitive, annotation, color, activeColor }]
// holdAnimation "running" plays the long-press: the bar's yellow slides away while the option turns white,
// then holdFinished() (QuickSettings' handleAnimationEnd).
import QtQuick
import Dial

Item {
    id: menu
    property var options: []
    property int activeIndex: 0
    property string holdAnimation: "stopped"   // stopped | running | finished
    // An extra first line (the OS update status) and the version box after the list (QuickSettings).
    property string headerText: ""
    property color headerColor: Theme.warning
    property string footerText: ""
    property int paddingLeft: 28
    // Marquee for long labels in the bar (MARQUEE_MIN_TEXT_LENGTH).
    property int marqueeMinTextLength: Theme.marqueeMinTextLength
    property bool animated: true
    signal holdFinished()

    readonly property int count: options ? options.length : 0
    readonly property var activeOption: count ? options[Math.min(Math.max(activeIndex, 0), count - 1)] : null

    width: parent ? parent.width : 420
    height: 480
    clip: true

    function next() { activeIndex = Math.min(activeIndex + 1, count - 1) }
    function previous() { activeIndex = Math.max(activeIndex - 1, 0) }

    readonly property int headerOffset: headerText.length ? Theme.itemHeight + Theme.itemMargin : 0
    function offsetOf(index) {
        let y = 0
        for (let k = 0; k < index && k < count; k++)
            y += Theme.itemHeight + Theme.itemMargin + (options[k].hasSeparator ? Theme.extraMarginAfterBorder : 0)
        return y
    }
    // calculateOptionPosition: VIEWPORT_HEIGHT / 2 - offset - ITEM_HEIGHT / 2 + 2
    readonly property real listY: Theme.viewport / 2 - offsetOf(activeIndex) - Theme.itemHeight / 2 + 2 - headerOffset
    property real animatedListY: listY
    Behavior on animatedListY {
        enabled: menu.animated
        NumberAnimation { duration: 150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.MATERIAL }
    }

    // Widths as the CSS lays them out: the viewport padding box, options 90 % + 2 x 16 px padding.
    readonly property real boxWidth: width
    readonly property real optionWidth: boxWidth * 0.9 + 32
    readonly property real barWidth: boxWidth * 0.95
    readonly property real barX: 228 - barWidth / 2
    readonly property real innerOptionWidth: barWidth * 0.9 + 32

    // The hold: 1 s "ease" for the bar to empty, the text fading to white with it.
    property real holdProgress: 0
    NumberAnimation {
        id: hold
        target: menu
        property: "holdProgress"
        from: 0; to: 1
        duration: 1000
        easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE
        onFinished: menu.holdFinished()
    }
    onHoldAnimationChanged: {
        if (holdAnimation === "running") hold.restart()
        else if (holdAnimation === "stopped") { hold.stop(); holdProgress = 0 }
    }

    component OptionRow: Item {
        id: row
        required property var option
        required property int index
        property bool inner: false
        property real rowWidth: menu.optionWidth
        readonly property bool active: index === menu.activeIndex
        readonly property bool marquee: inner && active && (option.label || "").length > menu.marqueeMinTextLength
        width: rowWidth
        height: Theme.itemHeight
        y: menu.offsetOf(index) + menu.headerOffset

        Item {
            id: labelBox
            x: 16
            width: row.width - 32 - (annotationBox.visible ? annotationBox.width + 8 : 0)
            height: parent.height
            clip: row.marquee
            Text {
                id: label
                height: parent.height
                verticalAlignment: Text.AlignVCenter
                text: row.option.label || ""
                color: row.inner ? (row.option.activeColor || "black")
                       : (menu.holdAnimation === "running" && row.option.longpress
                          ? Qt.tint(row.option.color || Theme.menuGray, Qt.rgba(1, 1, 1, menu.holdProgress))
                          : (row.option.color || Theme.menuGray))
                opacity: !row.inner && menu.holdAnimation === "running" && row.option.longpress ? menu.holdProgress : 1
                font.family: Theme.fontMono
                font.pixelSize: 22
                font.letterSpacing: 2.2
                font.capitalization: row.option.caseSensitive ? Font.MixedCase : Font.AllUppercase
                // LeftRightAnimation: 0 → -50 % of the label, 5 s alternate ease-in-out, after 0.5 s.
                SequentialAnimation on x {
                    running: row.marquee
                    onRunningChanged: if (!running) label.x = 0
                    PauseAnimation { duration: 500 }
                    SequentialAnimation {
                        loops: Animation.Infinite
                        NumberAnimation { from: 0; to: -label.implicitWidth / 2; duration: 5000; easing.type: Easing.InOutQuad }
                        NumberAnimation { from: -label.implicitWidth / 2; to: 0; duration: 5000; easing.type: Easing.InOutQuad }
                    }
                }
            }
        }

        // MenuAnnotation ("HOLD" on long-press options).
        Rectangle {
            id: annotationBox
            readonly property string annotation: row.option.annotation || (row.inner && row.option.longpress ? "HOLD" : "")
            visible: annotation.length > 0
            anchors.right: parent.right
            anchors.rightMargin: 16
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: -3
            width: annotationText.implicitWidth + 10
            height: 22
            radius: 4
            color: "transparent"
            border.width: 1
            border.color: label.color
            Text {
                id: annotationText
                x: 5
                y: 5
                text: annotationBox.annotation
                color: label.color
                font.family: Theme.fontMono
                font.pixelSize: 12
            }
        }

        // The dashed separator: 85 % wide, 2 px, 13 px under the option.
        Row {
            visible: !row.inner && !!row.option.hasSeparator
            x: 16
            y: row.height + 11
            spacing: 4
            Repeater {
                model: Math.floor(row.width * 0.85 / 8)
                Rectangle { width: 4; height: 2; color: Qt.rgba(245 / 255, 196 / 255, 68 / 255, 0.5) }
            }
        }
    }

    // ---- the grey list
    Item {
        id: outer
        x: menu.paddingLeft + (menu.boxWidth - menu.optionWidth) / 2
        y: menu.animatedListY
        z: menu.holdAnimation === "running" ? 20 : 0

        Text {
            visible: menu.headerText.length > 0
            x: 16
            width: menu.optionWidth * 0.9
            height: Theme.itemHeight
            verticalAlignment: Text.AlignVCenter
            text: menu.headerText
            color: menu.headerColor
            font.family: Theme.fontMono
            font.pixelSize: 22
            font.letterSpacing: 2.2
        }
        Repeater {
            model: menu.count
            delegate: OptionRow {
                required property int modelData
                option: menu.options[modelData]
                index: modelData
            }
        }
        // The software version box (QuickSettings' $SWVersion): 100 px under the list.
        Rectangle {
            visible: menu.footerText.length > 0
            x: (menu.optionWidth - width) / 2 - 58
            y: menu.offsetOf(menu.count) + menu.headerOffset + 100 - Theme.itemMargin
            width: footer.implicitWidth + 10
            height: Theme.itemHeight
            radius: 4
            color: "transparent"
            border.width: 1
            border.color: Theme.menuGray
            Text {
                id: footer
                x: 5
                y: 3
                height: parent.height - 3
                verticalAlignment: Text.AlignVCenter
                text: menu.footerText
                color: Theme.menuGray
                font.family: Theme.fontMono
                font.pixelSize: 20
                font.letterSpacing: 2.2
            }
        }
    }

    // ---- the yellow bar with the same list in black
    Item {
        id: bar
        // left: 228px of the viewport's padding box, centered (translate -50 %).
        x: menu.barX
        y: 217.5
        z: 10
        width: menu.barWidth
        height: Theme.itemHeight
        clip: true
        Rectangle {
            // background-position 100 % → 0 %: the yellow half slides out to the right.
            x: menu.holdProgress * bar.width
            width: bar.width
            height: bar.height
            radius: 4
            color: Theme.brandYellow
        }
        Item {
            x: (menu.barWidth - menu.innerOptionWidth) / 2
            y: menu.animatedListY - 217.5
            Repeater {
                model: menu.count
                delegate: OptionRow {
                    required property int modelData
                    option: menu.options[modelData]
                    index: modelData
                    inner: true
                    rowWidth: menu.innerOptionWidth
                }
            }
        }
    }
}
