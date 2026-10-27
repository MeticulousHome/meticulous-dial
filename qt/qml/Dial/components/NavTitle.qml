// The navigation title (Transitioner.tsx Title, navigation.less .navigation-title): the 230 px pill at the
// top (border #5d5d5d, mono light 16 px, 0.2em, upper case) or, with position "bottom", the cream label
// under a gauge. A pill spec ({ pill: "profiles" }) shows TitleProfiles: "Catalog" on the home and the
// name of the selected card, scrolled up once a card is selected, with a marquee for long names.
import QtQuick
import Dial

Item {
    id: title
    property var spec                      // string | pill object
    property string position: "top"        // top | bottom
    property bool shared: false
    readonly property bool isPill: spec !== null && typeof spec === "object"
    readonly property string text: isPill || spec === undefined || spec === null ? "" : String(spec)

    x: 125
    y: position === "bottom" ? 375 : 60
    width: 230
    height: position === "bottom" ? 22 : 24
    z: 10

    // ---- top pill
    Rectangle {
        visible: title.position === "top"
        anchors.fill: parent
        radius: 12
        color: "transparent"
        border.color: Theme.pillBorder
        // .navigation-title:empty { border: none }
        border.width: title.isPill || title.text.length > 0 ? 1 : 0
        clip: true

        Text {
            visible: !title.isPill
            width: parent.width
            height: 22
            y: 2
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            text: title.text
            elide: Text.ElideNone
            clip: true
            color: "white"
            font.family: Theme.fontMono
            font.weight: Font.Light
            font.pixelSize: 16
            font.letterSpacing: 3.2
            font.capitalization: Font.AllUppercase
        }

        Loader {
            active: title.isPill
            anchors.fill: parent
            sourceComponent: ProfilesPill {}
        }
    }

    // ---- bottom label
    Text {
        visible: title.position === "bottom"
        anchors.fill: parent
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: title.text
        color: Theme.cream
        font.family: Theme.fontRegular
        font.weight: Font.Light
        font.pixelSize: 24
        font.letterSpacing: 0.5
        font.capitalization: Font.Capitalize
    }

    component ProfilesPill: Item {
        id: pill
        readonly property bool isHome: Nav.screen === "profileHome"
        // The card the home shows (getActiveHomeOption / getHomeSelection).
        readonly property var shownCard: Profiles.homeSelection(Profiles.activeOption)
        readonly property var shownPourOver: shownCard.pourOverProfileIndex === null ? null : Profiles.pourOverProfiles[shownCard.pourOverProfileIndex]
        readonly property bool scroll: (Profiles.localHoverState || Profiles.homeCardSelected) && isHome
        readonly property bool marquee: (isHome && scroll) || !isHome
        readonly property string name: {
            let t = isHome && shownCard.mode === "free_pour" ? "Free Pour"
                  : isHome && shownCard.mode === "pour_over_profile" ? ((shownPourOver && shownPourOver.name) || "Pour Over")
                  : ((Profiles.localProfile && Profiles.localProfile.name) || "")
            if (t.length > 40) t = t.slice(0, 40) + "..."
            return t
        }

        Column {
            id: column
            width: parent.width
            y: pill.scroll ? -23 : 0
            Behavior on y { NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_IN_OUT } }

            Item {
                visible: pill.isHome
                width: pill.width
                height: 22
                Text {
                    anchors.centerIn: parent
                    anchors.verticalCenterOffset: 2
                    text: "Catalog"
                    color: "white"
                    font.family: Theme.fontMono
                    font.weight: Font.Light
                    font.pixelSize: 16
                    font.letterSpacing: 3.2
                    font.capitalization: Font.AllUppercase
                }
            }
            Item {
                id: nameRow
                width: pill.width
                height: 22
                clip: true
                readonly property bool scrolling: pill.marquee && measure.implicitWidth > width - 2
                Text {
                    id: measure
                    visible: !nameRow.scrolling
                    anchors.centerIn: parent
                    anchors.verticalCenterOffset: 2
                    text: pill.name
                    color: "white"
                    font.family: Theme.fontMono
                    font.weight: Font.Light
                    font.pixelSize: 16
                    font.letterSpacing: 3.2
                    font.capitalization: Font.AllUppercase
                }
                // PresetTitleMarquee: two copies 40 px apart, 5 s linear, after 0.9 s.
                Row {
                    id: marqueeRow
                    visible: nameRow.scrolling
                    y: 2 + (22 - measure.implicitHeight) / 2
                    spacing: 40
                    Repeater {
                        model: 2
                        Text {
                            text: pill.name
                            color: "white"
                            font.family: Theme.fontMono
                            font.weight: Font.Light
                            font.pixelSize: 16
                            font.letterSpacing: 3.2
                            font.capitalization: Font.AllUppercase
                        }
                    }
                    SequentialAnimation on x {
                        running: nameRow.scrolling && nameRow.visible
                        loops: 1
                        onRunningChanged: if (!running) marqueeRow.x = 0
                        PauseAnimation { duration: 900 }
                        SequentialAnimation {
                            loops: Animation.Infinite
                            NumberAnimation { from: 0; to: -(measure.implicitWidth + 40); duration: 5000 }
                        }
                    }
                }
            }
        }
    }
}
