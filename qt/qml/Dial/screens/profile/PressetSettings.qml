// The profile editor (src/components/PressetSettings/PressetSettings.tsx): the settings of the profile being
// edited or created (Profiles.settingsProfile: name, temperature, output, image, then the profile's
// variables) and the actions "brew without saving", "save", "discard" (constants/setting.ts DEFAULT_SETTING),
// in a column 75 % wide whose focused line sits at the middle (lines 50 px every 52 px, 150 ms "ease"), under
// a black fade at the top and the bottom. The focused line is white and shows its value in yellow (40 px,
// 25 px when label and value pass 21 characters; a mono unit raised beside it, or the image 50 px), and a
// line longer than 24 characters slides left 240 px and back (8 s). The knob moves the focus; a push opens the
// setting's editor or runs the action.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    readonly property int optionsHeight: 50
    readonly property int cardGap: 2
    readonly property int pistonOnPurgePosition: 73   // ComplexProfileConverter.head_template, 'prepare' stage

    // generateStaticActions(DEFAULT_SETTING, settings.length): ids after the profile's settings.
    function generateStaticActions(actions, length) {
        return actions.map((action, index) => Object.assign({}, action, { id: length + index + 1, isInternal: true }))
    }
    readonly property var profileSettings: Profiles.settingsProfile && Profiles.settingsProfile.settings
                                           ? Profiles.settingsProfile.settings : []
    readonly property var settings: profileSettings.concat(generateStaticActions(Constants.DEFAULT_SETTING, profileSettings.length))
    readonly property var activeSetting: settings[Profiles.settingsIndex] || null
    readonly property string activeLabel: activeSetting && activeSetting.label !== undefined ? String(activeSetting.label) : ""

    // text-transform: capitalize
    function capitalize(text) {
        return String(text).replace(/(^|\s)(\S)/g, (m, space, letter) => space + letter.toUpperCase())
    }
    readonly property string dialFocusedLabel: capitalize(activeLabel)

    DimScreen {}

    function brewOnce() {
        const pos = Stats.sensorData ? Stats.sensorData.m_pos : 0
        const requiresPurge = !!pos && pos < pistonOnPurgePosition
        const profile = Profiles.applySettingsToProfile(Object.assign({}, Profiles.settingsProfile), Profiles.settingsProfile.settings)
        Api.loadProfileFromJSON(profile).then(data => {
            if (data && typeof data === "object" && "name" in data) {
                Profiles.profileStarting = true
                return Api.executeAction("start").then(response => {
                    if (!(response && typeof response === "object" && "error" in response)) {
                        Nav.setScreen(requiresPurge ? "manual-purge" : "heating")
                        return
                    }
                    Profiles.profileStarting = false
                    console.error("Failed starting profile: " + response.error)
                    Nav.setScreen("profileHome")
                }, error => {
                    // React throws here (the start's error is undefined) and leaves profileStarting set,
                    // which locks the home: take the branch it means instead.
                    Profiles.profileStarting = false
                    console.error("Start profile error: ", error && error.message ? error.message : error)
                    Nav.setScreen("profileHome")
                })
            }
            console.error("Failed loading profile: " + (data && data.error))
            Nav.setScreen("profileHome")
        }, error => {
            // As React: the load's error leaves the editor open.
            console.error("LoadProfileData error: ", error && error.message ? error.message : error)
        })
    }

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onTurnLeft: Profiles.settingsIndex = Math.max(Profiles.settingsIndex - 1, 0)
        onTurnRight: Profiles.settingsIndex = Math.min(Profiles.settingsIndex + 1, screen.settings.length - 1)
        onPressDown: {
            const setting = screen.activeSetting
            if (!setting) return
            const key = String(setting.key || "")
            if (key === "save") {
                const profile = Profiles.applySettingsToProfile(Object.assign({}, Profiles.settingsProfile), Profiles.settingsProfile.settings)
                Profiles.saveProfile(profile).catch(() => {})
                Nav.setScreen("profileHome")
            } else if (key === "discard") {
                Nav.setScreen("profileHome")
            } else if (key === "brew_once") {
                screen.brewOnce()
            } else if (key === "name") {
                Nav.setScreen("name")
            } else if (key === "output") {
                Nav.setScreen("output")
            } else if (key.includes("pressure")) {
                Nav.setScreen("pressure")
            } else if (key.includes("time")) {
                Nav.setScreen("time")
            } else if (key.includes("weight")) {
                Nav.setScreen("weight")
            } else if (key.includes("piston_position")) {
                Nav.setScreen("piston_position")
            } else if (key.includes("power")) {
                Nav.setScreen("motor_power")
            } else if (key.includes("flow")) {
                Nav.setScreen("flow")
            } else if (key === "temperature") {
                Nav.setScreen("temperature")
            } else if (key === "image") {
                Nav.setScreen("pressetProfileImage")
            }
        }
    }

    // The entries are flex items of the 480 px column: past 9 of them (50 px + 2 px gaps) they shrink
    // evenly, but not below their content (a 48 px line; the focused image line 50 px), and overflow.
    // The viewport still moves by 52 px a step, so the focused line creeps up on long lists, as in React.
    readonly property var entryLayout: {
        const n = settings.length
        const mins = settings.map(s => s.type === "image" && String(s.label) === activeLabel ? 50 : 48)
        const sizes = new Array(n).fill(optionsHeight)
        const frozen = new Array(n).fill(false)
        const gaps = Math.max(n - 1, 0) * cardGap
        if (n * optionsHeight + gaps > height) {
            for (let round = 0; round < n; round++) {
                let used = gaps, free = 0
                for (let i = 0; i < n; i++) {
                    if (frozen[i]) used += sizes[i]
                    else { used += optionsHeight; free++ }
                }
                if (free === 0) break
                const each = optionsHeight + (height - used) / free
                let violated = false
                for (let i = 0; i < n; i++) {
                    if (frozen[i]) continue
                    if (each < mins[i]) { sizes[i] = mins[i]; frozen[i] = true; violated = true }
                    else sizes[i] = each
                }
                if (!violated) break
            }
        }
        const out = []
        let y = 0
        for (let i = 0; i < n; i++) {
            out.push({ y: y, h: sizes[i] })
            y += sizes[i] + cardGap
        }
        return out
    }

    // CSS line boxes (see CircleKeyboard): ABC Diatype's CSS ascent is round(0.85 em); the entry's
    // line-height is 1.2. Each text is placed by its baseline.
    function entryBaseline(px, entryHeight) {
        // A flex item 1.2 em tall centred in the entry; its glyphs centred in it (half-leading).
        const line = 1.2 * px
        const content = Math.round(0.85 * px) + Math.round(0.15 * px)
        return (entryHeight - line) / 2 + (line - content) / 2 + Math.round(0.85 * px)
    }

    // Viewport: 75 % wide, translateY(-index * 52 + 240 - 25), transition 150 ms ease.
    Item {
        id: viewport
        x: (screen.width - width) / 2
        width: screen.width * 0.75
        height: screen.height
        y: -Profiles.settingsIndex * (screen.optionsHeight + screen.cardGap) + 240 - screen.optionsHeight / 2
        Behavior on y { NumberAnimation { duration: 150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }

        Repeater {
            model: screen.settings.length
            delegate: Item {
                id: entry
                required property int index
                readonly property var setting: screen.settings[index] || ({})
                readonly property string label: setting.label !== undefined ? String(setting.label) : ""
                readonly property var value: setting.value
                readonly property bool isActive: screen.activeLabel === label
                readonly property bool isImage: setting.type === "image"
                readonly property bool showValue: isActive && (typeof value === "number" || typeof value === "string")
                readonly property int characters: label && value ? label.length + value.toString().length : 0
                readonly property bool marquee: isActive && !isImage && characters > 24

                readonly property var box: screen.entryLayout[index] || ({ y: index * (screen.optionsHeight + screen.cardGap), h: screen.optionsHeight })
                y: box.y
                width: viewport.width
                height: box.h
                visible: Math.abs(index - Profiles.settingsIndex) <= 6

                // MarqueeAnimation: translateX 0 → calc(120px - 100%) → 0, 8 s ease-in-out, forever.
                property real marqueeX: 0
                transform: Translate { x: entry.marqueeX }
                SequentialAnimation {
                    running: entry.marquee && entry.visible
                    loops: Animation.Infinite
                    onRunningChanged: if (!running) entry.marqueeX = 0
                    NumberAnimation { target: entry; property: "marqueeX"; from: 0; to: 120 - entry.width; duration: 4000; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_IN_OUT }
                    NumberAnimation { target: entry; property: "marqueeX"; to: 0; duration: 4000; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_IN_OUT }
                }

                Text {
                    id: labelText
                    y: screen.entryBaseline(40, entry.height) - baselineOffset
                    rightPadding: 8
                    text: screen.capitalize(entry.label) + (entry.showValue ? ":" : "")
                    textFormat: Text.PlainText
                    color: entry.isActive ? "white" : "#90e7e7e7"
                    font.family: Theme.fontRegular
                    font.pixelSize: 40
                    font.letterSpacing: -0.4
                }
                Image {
                    visible: entry.isActive && entry.isImage
                    x: labelText.width
                    y: (entry.height - height) / 2
                    width: screen.optionsHeight
                    height: screen.optionsHeight
                    sourceSize: Qt.size(screen.optionsHeight, screen.optionsHeight)
                    asynchronous: true
                    source: visible ? Api.profileImageUrl(String(entry.value || "")) : ""
                }
                Text {
                    id: valueText
                    readonly property int px: entry.characters > 21 ? 25 : 40
                    visible: entry.isActive && !entry.isImage
                    x: labelText.width
                    y: screen.entryBaseline(px, entry.height) - baselineOffset
                    text: entry.showValue ? screen.capitalize(entry.value || 0) : ""
                    textFormat: Text.PlainText
                    color: Theme.brandYellow
                    font.family: Theme.fontRegular
                    font.pixelSize: px
                    font.letterSpacing: -0.4
                }
                // SettingsUnit: 17 px mono in a box as tall as the entry, 10 px lower (its line 20.4 px).
                Text {
                    visible: entry.isActive && !entry.isImage && !!entry.setting.unit
                    x: valueText.x + (valueText.text.length ? valueText.implicitWidth : 0)
                    y: 5 + (20.4 - 17) / 2 + Math.round(0.773 * 17) - baselineOffset
                    text: entry.setting.unit || ""
                    textFormat: Text.PlainText
                    color: Theme.brandYellow
                    font.family: Theme.fontMono
                    font.pixelSize: 17
                    font.letterSpacing: -0.5
                }
            }
        }
    }

    // linear-gradient(black 20%, transparent 50%, black 80%) over everything.
    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: 0.0; color: "black" }
            GradientStop { position: 0.2; color: "black" }
            GradientStop { position: 0.5; color: "#00000000" }
            GradientStop { position: 0.8; color: "black" }
            GradientStop { position: 1.0; color: "black" }
        }
    }
}
