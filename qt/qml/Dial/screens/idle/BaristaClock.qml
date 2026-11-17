// The Barista Barista sleep clock (src/components/IdleScreen/BaristaClock.tsx, idle_screen
// "baristaBarista", not offered in the settings): the outer ring turns with the seconds (6 degrees a
// second, from the wall clock), the inner logo the other way.
//
// As in React the white clock container has no height (its content is absolutely positioned), so the
// background stays black and only the red half of the inner logo shows; the black drawings are drawn
// all the same.
import QtQuick
import Dial

Item {
    id: barista
    width: 480
    height: 480

    readonly property real flowHeight: 0

    Image {
        id: outer
        width: 480
        height: 480
        sourceSize: Qt.size(480, 480)
        source: Theme.asset("icons/idle-barista-outer.svg")
        smooth: true
    }
    Image {
        id: inner
        width: 480
        height: 480
        sourceSize: Qt.size(480, 480)
        source: Theme.asset("icons/idle-barista-inner.svg")
        smooth: true
    }

    FrameAnimation {
        running: barista.visible
        onTriggered: {
            const secondRotation = (Date.now() % 60000) / 1000 * 6
            outer.rotation = secondRotation
            inner.rotation = -secondRotation
        }
    }
}
