// The profile image picker (src/components/PressetSettings/PressetProfileImage.tsx): the backend's default
// images (Profiles.defaultImages) in a Swiper row, two slides per view (230 px slides, 20 px apart, the
// active one centred), each image 164 px with an 8 px #e0dcd0 border; "n / total" under them. Turning left
// shows the next image (300 ms "ease"; the slides around it bounce 5 px), a push stores the image in the
// profile's image setting and returns to the editor. It always starts on the first image.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    readonly property var images: Profiles.defaultImages || []
    property int activeIndex: 0
    property int previousIndex: 0
    readonly property string dialProbe_activeImage: images[activeIndex] || ""
    readonly property int dialProbe_activeIndex: activeIndex

    readonly property real slideWidth: (width - 20) / 2
    readonly property real slidePitch: slideWidth + 20

    function updateSetting(updatedText) {
        const prev = Profiles.settingsProfile
        const index = Profiles.settingsIndex
        const setting = prev.settings[index]
        const updated = Object.assign({}, setting, { value: updatedText ? String(updatedText).replace("/api/v1/profile/image/", "") : "" })
        Profiles.settingsProfile = Object.assign({}, prev, {
            settings: prev.settings.slice(0, index).concat([updated], prev.settings.slice(index + 1))
        })
        Nav.setScreen("pressetSettings")
    }

    function slideTo(index) {
        if (index === activeIndex) return
        previousIndex = activeIndex
        activeIndex = index
        bounced()
    }

    DimScreen {}

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onPressDown: screen.updateSetting(screen.images[screen.activeIndex])
        onTurnLeft: if (!screen.transitioning) screen.slideTo(Math.min(screen.activeIndex + 1, screen.images.length - 1))
        onTurnRight: if (!screen.transitioning) screen.slideTo(Math.max(screen.activeIndex - 1, 0))
    }

    // handlePresetSlideChange: 20 ms after a change, bounce-left (moving on) or bounce-right (back) on the
    // active slide, the one it came from, and the one beyond it (not at the ends).
    signal bounced()
    function bounces(index) {
        if (index === activeIndex || index === previousIndex) return true
        if (activeIndex === 0 || activeIndex === images.length - 1) return false
        return index === (activeIndex > previousIndex ? activeIndex + 1 : activeIndex - 1)
    }

    // isLoading: nothing until the images are there.
    Item {
        anchors.fill: parent
        visible: screen.images.length > 0
        clip: true

        // .swiper-wrapper: translateX(centring offset - index * pitch), 300 ms ease.
        Item {
            id: wrapper
            height: parent.height
            x: (screen.width - screen.slideWidth) / 2 - screen.activeIndex * screen.slidePitch
            Behavior on x { NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }

            Repeater {
                model: screen.images.length
                delegate: Item {
                    id: slide
                    required property int index
                    readonly property bool near: Math.abs(index - screen.activeIndex) <= 2
                    x: index * screen.slidePitch
                    width: screen.slideWidth
                    height: screen.height
                    visible: near
                    property real bounceX: 0

                    // The <div> around the <img>: centred in the slide, its line box 16 px font under the
                    // image (2 px descent), so the image's top is (480 - 182) / 2.
                    Rectangle {
                        x: (slide.width - width) / 2 + slide.bounceX
                        y: (slide.height - (height + 2)) / 2
                        width: 164 + 16
                        height: 164 + 16
                        color: "#e0dcd0"
                        Image {
                            x: 8
                            y: 8
                            width: 164
                            height: 164
                            sourceSize: Qt.size(164, 164)
                            asynchronous: true
                            source: slide.near ? Api.profileImageUrl(screen.images[slide.index] || "") : ""
                        }
                    }

                    // bounce-left / bounce-right (transitions.less): 0 → ∓5 px (20 %) → ±1.5 px (50 %) → 0,
                    // 300 ms ease-out after 140 ms.
                    SequentialAnimation {
                        id: bounce
                        property real sign: -1
                        PauseAnimation { duration: 20 + 140 }
                        NumberAnimation { target: slide; property: "bounceX"; to: 5 * bounce.sign; duration: 60; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
                        NumberAnimation { target: slide; property: "bounceX"; to: -1.5 * bounce.sign; duration: 90; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
                        NumberAnimation { target: slide; property: "bounceX"; to: 0; duration: 150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
                    }
                    Connections {
                        target: screen
                        function onBounced() {
                            bounce.stop()
                            slide.bounceX = 0
                            if (!slide.near || !screen.bounces(slide.index)) return
                            bounce.sign = screen.activeIndex > screen.previousIndex ? -1 : 1
                            bounce.start()
                        }
                    }
                }
            }
        }

        // .swiper-pagination-fraction at top 352 px, line-height 0: the 16 px text centred on that line.
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            y: 352 - 8 + Math.round(0.85 * 16) - baselineOffset
            text: (screen.activeIndex + 1) + " / " + screen.images.length
            color: "white"
            textFormat: Text.PlainText
            font.family: Theme.fontRegular
            font.pixelSize: 16
        }
    }
}
