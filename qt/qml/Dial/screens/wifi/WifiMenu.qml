// The core OptionsMenu (components/OptionsMenu.qml: mixins.ts' menu with the yellow bar) with the two
// things the Wi-Fi menus add, until the core menu has them:
//   - option.wifiLevel (1-4): Styled.NetworkOption, the 28 px WifiIcon then the label 1rem (16 px) after it,
//     both scrolling together in the marquee;
//   - annotationOuterMargin: the MenuAnnotation of the grey list sits 1.2rem further left than the one
//     in the bar (WifiModeSettings' $marginRigth).
// No header, footer or long-press: the Wi-Fi menus have none.
//
// options: [{ key, label, hasSeparator, caseSensitive, annotation, wifiLevel }]
import QtQuick
import Dial

Item {
    id: menu
    property var options: []
    property int activeIndex: 0
    property int paddingLeft: 28
    property real annotationOuterMargin: 0
    property int marqueeMinTextLength: Theme.marqueeMinTextLength
    property bool animated: true

    readonly property int count: options ? options.length : 0
    readonly property var activeOption: count ? options[Math.min(Math.max(activeIndex, 0), count - 1)] : null
    readonly property string dialFocusedLabel: activeOption ? (activeOption.label || "") : ""

    width: parent ? parent.width : 420
    height: 480
    clip: true

    function next() { activeIndex = Math.min(activeIndex + 1, count - 1) }
    function previous() { activeIndex = Math.max(activeIndex - 1, 0) }

    function offsetOf(index) {
        let y = 0
        for (let k = 0; k < index && k < count; k++)
            y += Theme.itemHeight + Theme.itemMargin + (options[k].hasSeparator ? Theme.extraMarginAfterBorder : 0)
        return y
    }
    // calculateOptionPosition: VIEWPORT_HEIGHT / 2 - offset - ITEM_HEIGHT / 2 + 2
    readonly property real listY: Theme.viewport / 2 - offsetOf(activeIndex) - Theme.itemHeight / 2 + 2
    property real animatedListY: listY
    Behavior on animatedListY {
        enabled: menu.animated
        NumberAnimation { duration: 150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.MATERIAL }
    }

    readonly property real boxWidth: width
    readonly property real optionWidth: boxWidth * 0.9 + 32
    readonly property real barWidth: boxWidth * 0.95
    readonly property real barX: 228 - barWidth / 2
    readonly property real innerOptionWidth: barWidth * 0.9 + 32

    component OptionRow: Item {
        id: row
        required property var option
        required property int index
        property bool inner: false
        property real rowWidth: menu.optionWidth
        readonly property bool active: index === menu.activeIndex
        readonly property bool marquee: inner && active && (option.label || "").length > menu.marqueeMinTextLength
        readonly property int wifiLevel: option.wifiLevel || 0
        readonly property color textColor: inner ? "black" : Theme.menuGray
        width: rowWidth
        height: Theme.itemHeight
        y: menu.offsetOf(index)

        Item {
            id: labelBox
            x: 16
            width: row.width - 32 - (annotationBox.visible ? annotationBox.width + 8 : 0)
            height: parent.height
            clip: row.marquee
            Item {
                id: content
                height: parent.height
                width: (icon.visible ? icon.width + 16 : 0) + label.implicitWidth
                // NetworkOption: the WifiIcon (white arcs up to the level, black above it).
                Image {
                    id: icon
                    visible: row.wifiLevel > 0
                    y: (parent.height - height) / 2
                    width: 28
                    height: 28
                    sourceSize: Qt.size(28, 28)
                    source: visible ? Theme.asset("icons/wifi-level-" + Math.min(Math.max(row.wifiLevel, 1), 4) + ".svg") : ""
                }
                Text {
                    id: label
                    x: icon.visible ? icon.width + 16 : 0
                    height: parent.height
                    verticalAlignment: Text.AlignVCenter
                    text: row.option.label || ""
                    color: row.textColor
                    font.family: Theme.fontMono
                    font.pixelSize: 22
                    font.letterSpacing: 2.2
                    font.capitalization: row.option.caseSensitive ? Font.MixedCase : Font.AllUppercase
                }
                // LeftRightAnimation: 0 → -50 % of the span, 5 s alternate ease-in-out, after 0.5 s.
                SequentialAnimation on x {
                    running: row.marquee
                    onRunningChanged: if (!running) content.x = 0
                    PauseAnimation { duration: 500 }
                    SequentialAnimation {
                        loops: Animation.Infinite
                        NumberAnimation { from: 0; to: -content.width / 2; duration: 5000; easing.type: Easing.InOutQuad }
                        NumberAnimation { from: -content.width / 2; to: 0; duration: 5000; easing.type: Easing.InOutQuad }
                    }
                }
            }
        }

        // MenuAnnotation ("current" / "selected").
        Rectangle {
            id: annotationBox
            readonly property string annotation: row.option.annotation || ""
            visible: annotation.length > 0
            anchors.right: parent.right
            anchors.rightMargin: 16 + (row.inner ? 0 : menu.annotationOuterMargin)
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: -3
            width: annotationText.implicitWidth + 10
            height: 22
            radius: 4
            color: "transparent"
            border.width: 1
            border.color: row.textColor
            Text {
                id: annotationText
                x: 5
                y: 5
                text: annotationBox.annotation
                color: row.textColor
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
        x: menu.paddingLeft + (menu.boxWidth - menu.optionWidth) / 2
        y: menu.animatedListY
        Repeater {
            model: menu.count
            delegate: OptionRow {
                required property int modelData
                option: menu.options[modelData]
                index: modelData
            }
        }
    }

    // ---- the yellow bar with the same list in black
    Item {
        id: bar
        x: menu.barX
        y: 217.5
        z: 10
        width: menu.barWidth
        height: Theme.itemHeight
        clip: true
        Rectangle {
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
