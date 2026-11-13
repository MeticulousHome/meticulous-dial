// The bug report's option pills (BugReport.tsx's optionList: .settings-fixed-item-container.bug-report-options
// with .settings-fixed-item.settings-item, quick-settings.css, settings.css, bugReport.css): stacked at the
// bottom of the 420 px bubble, each 30 px tall every 33 px, 81 % wide plus 14 px / 9 % padding (392 px), flush
// right. ABC Diatype Mono 18 px, 1 px letter-spacing, upper case, #dddddd; the active one black on the yellow
// half of a 200 % gradient. A `hold` option carries a HOLD badge; held, its yellow slides away to the right
// while the text turns white (bug-report-hold-fill, 1 s ease), then holdFinished().
//
// options: [{ key, label, useableWidthPercentage, hold }]
import QtQuick
import Dial

Item {
    id: list
    property var options: []
    property int activeIndex: 0
    property string holdAnimation: "stopped"
    property real marginBottom: 50
    signal holdFinished()

    readonly property real boxWidth: 420
    readonly property real itemHeight: 30
    readonly property real step: 33
    readonly property string dialFocusedLabel: options.length && options[activeIndex] ? options[activeIndex].label : ""

    width: boxWidth
    height: options.length * step
    y: (parent ? parent.height : 480) - marginBottom - height
    visible: options.length > 0

    // The hold fill: background-position 100 % -> 0 % and color #0f0f0f -> #ffffff, 1 s ease, forwards.
    property real holdProgress: 0
    NumberAnimation {
        id: hold
        target: list
        property: "holdProgress"
        from: 0
        to: 1
        duration: 1000
        easing.type: Easing.Bezier
        easing.bezierCurve: Motion.EASE
        onFinished: list.holdFinished()
    }
    readonly property bool holding: holdAnimation === "running" && !!options[activeIndex] && !!options[activeIndex].hold
    onHoldingChanged: {
        if (holding) hold.restart()
        else { hold.stop(); holdProgress = 0 }
    }

    Repeater {
        model: list.options.length
        Item {
            id: row
            required property int index
            readonly property var option: list.options[index] || ({})
            readonly property bool active: index === list.activeIndex
            readonly property bool holdingThis: active && list.holding
            readonly property real usable: (option.useableWidthPercentage || 90) / 100
            readonly property real contentWidth: list.boxWidth * usable
            readonly property color textColor: !active ? "#dddddd"
                                               : holdingThis ? Qt.tint("#0f0f0f", Qt.rgba(1, 1, 1, list.holdProgress)) : "#0f0f0f"
            width: contentWidth + 14 + list.boxWidth * (0.9 - usable)
            height: list.itemHeight
            x: list.boxWidth - width
            y: index * list.step
            clip: true

            Rectangle {
                visible: row.active
                x: row.holdingThis ? list.holdProgress * row.width : 0
                width: row.width
                height: row.height
                radius: 4
                color: Theme.brandYellow
            }
            CssText {
                id: label
                x: 14
                y: 6
                width: row.contentWidth - (badge.visible ? badge.width + 10 : 0)
                text: row.option.label || ""
                elide: row.option.key === "editContactEmail" ? Text.ElideRight : Text.ElideNone
                clip: row.option.key !== "editContactEmail"
                color: row.textColor
                font.family: Theme.fontMono
                font.pixelSize: 18
                font.letterSpacing: 1
                font.capitalization: row.option.key === "editContactEmail" ? Font.MixedCase : Font.AllUppercase
            }
            // .bug-report-option-badge: 11 px mono, 1 px currentColor border, 4 px radius, padding 3 4 2.
            Rectangle {
                id: badge
                visible: !!row.option.hold
                x: 14 + row.contentWidth - width
                y: 6
                width: badgeText.implicitWidth + 10
                height: 18
                radius: 4
                color: "transparent"
                border.width: 1
                border.color: row.textColor
                CssText {
                    id: badgeText
                    x: 5
                    y: 4
                    text: "HOLD"
                    color: row.textColor
                    font.family: Theme.fontMono
                    font.pixelSize: 11
                    font.letterSpacing: 0.5
                    cssLineHeight: 11
                }
            }
        }
    }
}
