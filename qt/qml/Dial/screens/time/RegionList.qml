// The country and city lists of the time zone picker (TimeZone/Timezone.styled.tsx, CountrySettings.tsx,
// TimeZoneSettings.tsx): "Back" then one 50 px entry per item (2 px apart) in ABC Diatype 40 px, capitalised,
// in a 360 px column that slides 150 ms (ease) to keep the focused entry in the middle; the focused one in
// yellow, the others in #e7e7e7 at 56 %. An entry wider than the row scrolls left by 240 px and back every
// 8 s. A black gradient fades the top and bottom fifths; the title sits at the top.
//
// items: [{ label, detail }] (detail: the time zone name, shown only on the focused entry)
import QtQuick
import Dial

Item {
    id: list
    anchors.fill: parent

    property string title: ""
    property var items: []
    property int activeIndex: 0          // 0 = Back
    property int marqueeMinLength: 24
    readonly property int count: items.length + 1

    readonly property real entryHeight: 50
    readonly property real gap: 2

    Item {
        id: viewport
        x: (list.width - width) / 2
        width: list.width * 0.75
        height: list.height
        property real translateY: -list.activeIndex * (list.entryHeight + list.gap) + 240 - list.entryHeight / 2
        y: translateY
        Behavior on translateY { NumberAnimation { duration: 150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }

        Repeater {
            model: list.count
            delegate: Item {
                id: entry
                required property int index
                readonly property bool active: index === list.activeIndex
                readonly property var item: index === 0 ? ({ label: "Back", detail: "" }) : list.items[index - 1]
                readonly property bool marquee: active && index > 0
                                                && (String(item.label).length + String(item.detail || "").length) > list.marqueeMinLength
                y: index * (list.entryHeight + list.gap)
                width: viewport.width
                height: list.entryHeight
                // Only the entries near the middle can be seen.
                visible: Math.abs(index - list.activeIndex) <= 6

                Row {
                    id: row
                    spacing: 0
                    // MarqueeAnimation: translateX 0 → calc(120px - 100%) → 0, 8 s ease-in-out, forever.
                    property real shift: 0
                    x: shift
                    SequentialAnimation on shift {
                        running: entry.marquee
                        loops: Animation.Infinite
                        onRunningChanged: if (!running) row.shift = 0
                        NumberAnimation { from: 0; to: 120 - entry.width; duration: 4000; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_IN_OUT }
                        NumberAnimation { from: 120 - entry.width; to: 0; duration: 4000; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_IN_OUT }
                    }

                    Text {
                        id: label
                        // SettingsLabel: 8 px right padding; the baselines of label and detail align.
                        rightPadding: 8
                        height: list.entryHeight
                        text: String(entry.item ? entry.item.label : "")
                        color: entry.active ? Theme.brandYellow : Qt.rgba(0xe7 / 255, 0xe7 / 255, 0xe7 / 255, 0x90 / 255)
                        font.family: Theme.fontRegular
                        font.pixelSize: 40
                        font.letterSpacing: -0.4
                        font.capitalization: Font.Capitalize
                        lineHeight: 48
                        lineHeightMode: Text.FixedHeight
                    }
                    Text {
                        id: detail
                        visible: entry.active && text.length > 0
                        height: list.entryHeight
                        text: String(entry.item && entry.item.detail ? entry.item.detail : "")
                        color: "#f3f4f6"
                        font.family: Theme.fontRegular
                        font.pixelSize: 24
                        font.letterSpacing: -0.4
                        font.capitalization: Font.Capitalize
                        // align-items: baseline with the 40 px label.
                        topPadding: label.baselineOffset - detailMetrics.ascent
                        FontMetrics { id: detailMetrics; font: detail.font }
                    }
                }
            }
        }
    }

    // linear-gradient(black 20%, transparent 50%, black 80%)
    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: 0.2; color: "black" }
            GradientStop { position: 0.5; color: "transparent" }
            GradientStop { position: 0.8; color: "black" }
        }
    }

    // Title: 60 px from the top, centred, 16 px, upper case, #f3f4f6 at 80 %.
    Text {
        anchors.horizontalCenter: parent.horizontalCenter
        y: 60
        text: list.title
        color: "#f3f4f6"
        opacity: 0.8
        font.family: Theme.fontRegular
        font.pixelSize: 16
        font.capitalization: Font.AllUppercase
    }
}
