// .settings-explanation (src/components/Settings/settings.css) with its shaper floats: 20px/26px text in a
// 400 px box whose lines follow the round display, as Chromium lays them out around the two floats'
// shape-outside polygons (ReportLib.explanationLine).
//
// The floats are 50 % x 50 % of the box, and the box's height is what the text needs at the full width with
// no floats (Chromium sizes the flex item before the floats' percentage height can resolve), so the floats
// are half that tall while the shaped text runs longer.
//
// paragraphs: [{ text (StyledText: <b> for <strong>), marginTop }], each a <div> of the message.
import QtQuick
import Dial
import "ReportLib.js" as ReportLib

Item {
    id: box
    property var paragraphs: []
    property real lineHeight: 26
    property real fontSize: 20
    width: 400

    // The box's height as Chromium sizes it (unshaped text).
    readonly property real boxHeight: {
        let h = 0
        for (let i = 0; i < measure.count; i++) {
            const t = measure.itemAt(i)
            if (t) h += (paragraphs[i].marginTop || 0) + t.lineCount * lineHeight
        }
        return h
    }
    readonly property real floatHeight: boxHeight / 2
    implicitHeight: shaped.height

    function styled(text) { return text.replace(/<b>/g, "<b><font color=\"#f5c444\">").replace(/<\/b>/g, "</font></b>") }

    // Unshaped copies, only to size the box.
    Repeater {
        id: measure
        model: box.paragraphs.length
        CssText {
            required property int index
            visible: false
            width: box.width
            text: box.styled(box.paragraphs[index].text)
            textFormat: Text.StyledText
            wrapMode: Text.WordWrap
            font.pixelSize: box.fontSize
            cssLineHeight: box.lineHeight
        }
    }

    Column {
        id: shaped
        width: box.width
        Repeater {
            model: box.paragraphs.length
            Item {
                id: para
                required property int index
                width: box.width
                height: (box.paragraphs[index].marginTop || 0) + text.lineCount * box.lineHeight
                CssText {
                    id: text
                    y: box.paragraphs[para.index].marginTop || 0
                    width: box.width
                    color: "white"
                    text: box.styled(box.paragraphs[para.index].text)
                    textFormat: Text.StyledText
                    wrapMode: Text.WordWrap
                    font.pixelSize: box.fontSize
                    cssLineHeight: box.lineHeight
                    readonly property real absTop: para.y + y
                    onAbsTopChanged: Qt.callLater(forceLayout)
                    Connections {
                        target: box
                        function onFloatHeightChanged() { Qt.callLater(text.forceLayout) }
                    }
                    onLineLaidOut: (line) => {
                        const bandTop = text.absTop + line.number * box.lineHeight
                        const edges = ReportLib.explanationLine(bandTop, bandTop + box.lineHeight, box.width, box.floatHeight)
                        line.x = edges.left
                        line.width = edges.right - edges.left
                    }
                }
            }
        }
    }
}
