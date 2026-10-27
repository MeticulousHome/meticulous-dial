// The home (src/components/ProfileHomeScreen): the carousel of espresso profiles, installed pour-over
// profiles, Free Pour and "new" (or "unlock all features"), 178 px cards every 257 px with the active one
// centered (150 ms "ease"), the others at 30 % (300 ms), a 300 ms bounce on the neighbours of each step.
// A push selects (zooms) the card; holding it 300 ms more fills the "Hold to start" ring (1 s ease-out)
// and starts the profile (or opens Free Pour / the guided pour-over). Letting go winds the ring back and
// flashes "Hold to start".
import QtQuick
import Dial
import Dial.Native

Item {
    id: home
    anchors.fill: parent
    property bool transitioning: false

    // ---- local state (ProfileHomeScreen's useState)
    property string transitionDirection: "none"   // none | left | right
    property bool homeHoverState: false
    property bool isPressingDown: false
    property bool requiresPurge: false
    readonly property int pistonOnPurgePosition: 73   // ComplexProfileConverter.head_template, 'prepare' stage

    readonly property int cardSize: 178
    readonly property int cardGap: 79
    readonly property int cardPitch: cardSize + cardGap
    readonly property int cardPadding: 240 - cardSize / 2

    readonly property int activeOption: Profiles.activeOption
    readonly property bool loading: !Profiles.profilesLoaded || !Profiles.pourOverLoaded

    // The cards in carousel order: { kind: espresso | pour_over | free_pour | new, profile, name }
    readonly property var cards: {
        const list = []
        for (const p of Profiles.mergedProfiles) list.push({ kind: "espresso", profile: p, name: p.name || "" })
        for (const p of Profiles.pourOverProfiles) list.push({ kind: "pour_over", profile: p, name: p.name || "" })
        list.push({ kind: "free_pour", profile: null, name: "Free Pour" })
        list.push({ kind: "new", profile: null, name: Profiles.limitedAccess ? "unlock all features" : "new" })
        return list
    }

    // A removed card (TransitionGroup "slide" exit, transitions.less): it rises 100 px and fades (300 ms
    // ease-out) while its 257 px collapse, so the cards after it slide into place in 500 ms ease-out.
    property var _lastCards: []
    property int gapIndex: -1
    property real gapOffset: 0
    property var ghost: null
    property int ghostIndex: -1
    function cardKey(c) { return c.kind + ":" + (c.profile && c.profile.id ? c.profile.id : c.name) }
    onCardsChanged: {
        const previous = _lastCards
        _lastCards = cards
        const keys = cards.map(cardKey), before = previous.map(cardKey)
        if (!before.length || keys.length !== before.length - 1) return
        let removed = 0
        while (removed < keys.length && keys[removed] === before[removed]) removed++
        if (keys.slice(removed).join("|") !== before.slice(removed + 1).join("|")) return
        ghost = previous[removed]
        ghostIndex = removed
        gapIndex = removed
        slideExit.restart()
    }
    ParallelAnimation {
        id: slideExit
        NumberAnimation { target: home; property: "gapOffset"; from: home.cardPitch; to: 0; duration: 500; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
        NumberAnimation { target: ghostItem; property: "ty"; from: 0; to: -100; duration: 500; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
        NumberAnimation { target: ghostItem; property: "opacity"; from: ghostItem.startOpacity; to: 0; duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
        onFinished: { home.ghost = null; home.gapIndex = -1 }
    }

    // Test probes (tests/e2e): the cards in order, the focused one (name and position; profiles may share a
    // name), and whether it is selected (zoomed).
    readonly property var dialProbe_cards: cards.map(c => c.name)
    readonly property string dialProbe_activeCard: cards[activeOption] ? cards[activeOption].name : ""
    readonly property int dialProbe_activeIndex: activeOption
    // The focused card's picture: its URL and whether it has loaded.
    readonly property var dialProbe_activeCardImage: {
        const c = cardRepeater.count > activeOption ? cardRepeater.itemAt(activeOption) : null
        return c ? { source: c.imageSource, loaded: c.imageLoaded } : null
    }
    readonly property bool dialProbe_cardSelected: homeHoverState
    // How many cards are drawn on screen right now (also while the list slides).
    function dialProbe_cardsDrawn() {
        let drawn = 0
        for (let i = 0; i < cardRepeater.count; i++) {
            const c = cardRepeater.itemAt(i)
            if (c && c.visible && c.opacity > 0.01 && c.screenX + c.width > 0 && c.screenX < width) drawn++
        }
        return drawn
    }

    // The title pill names the selected card (homeCardSelected).
    onHomeHoverStateChanged: Profiles.homeCardSelected = homeHoverState
    Component.onDestruction: Profiles.homeCardSelected = false

    // requiresPurge: the piston sits above the purge position.
    Connections {
        target: Stats
        function onSensorDataChanged() {
            const pos = Stats.sensorData.m_pos
            home.requiresPurge = !!pos && pos < home.pistonOnPurgePosition
        }
    }

    // Idle: the home is where the Dial falls asleep.
    Connections {
        target: Idle
        function onIsIdleChanged() { if (Idle.isIdle) home.goIdle() }
    }
    function goIdle() {
        Nav.setScreen("idle")
        Nav.closeBubble()
    }
    Component.onCompleted: {
        _lastCards = cards
        if (Idle.isIdle) goIdle()
        syncHover()
    }

    // "We are never zoomed in on the new button"; espresso cards follow the shared hover state.
    function syncHover() {
        if (activeOption === Profiles.newOptionIndex) {
            homeHoverState = false
            return
        }
        if (Profiles.homeMode === "espresso") {
            homeHoverState = Profiles.localHoverState
        } else {
            homeHoverState = false
            if (Profiles.localHoverState) Profiles.localHoverState = false
        }
    }
    Connections {
        target: Profiles
        function onLocalHoverStateChanged() { home.syncHover() }
        function onHomeModeChanged() { home.syncHover() }
        function onMergedProfilesChanged() { if (home.activeOption === Profiles.newOptionIndex) home.homeHoverState = false }
    }
    onActiveOptionChanged: if (activeOption === Profiles.newOptionIndex) homeHoverState = false

    // ---- selection
    function selectHomeOption(option) {
        const selection = Profiles.homeSelection(option)
        if (selection.mode === "espresso" && selection.profileIndex !== null) {
            Profiles.localProfileIndex = selection.profileIndex
            Profiles.homeMode = "espresso"
            Profiles.selectedPourOverProfileId = null
            return
        }
        if (selection.mode === "pour_over_profile" && selection.pourOverProfileIndex !== null) {
            const profile = Profiles.pourOverProfiles[selection.pourOverProfileIndex]
            if (!profile) return
            Profiles.selectedPourOverProfileId = profile.id
            Profiles.homeMode = "pour_over_profile"
            Profiles.localHoverState = false
            return
        }
        Profiles.selectedPourOverProfileId = null
        Profiles.homeMode = selection.mode
        Profiles.localHoverState = false
    }
    function emitProfileHover(option, type) {
        const event = Profiles.dialProfileHover(option, type)
        if (event) Backend.emitEvent("profileHover", event)
    }
    function moveActiveOption(next) {
        if (next === activeOption) return
        selectHomeOption(next)
        emitProfileHover(next, "scroll")
    }
    signal bounced()
    function bounce(direction) {
        transitionDirection = direction
        bounced()
    }
    function rotateLeft() {
        if (homeHoverState) {
            homeHoverState = false
            Profiles.localHoverState = false
            emitProfileHover(activeOption, "scroll")
            return
        }
        const atEnd = activeOption === Profiles.newOptionIndex
        moveActiveOption(Math.min(activeOption + 1, Profiles.newOptionIndex))
        if (!atEnd) bounce("right")
    }
    function rotateRight() {
        if (homeHoverState) {
            homeHoverState = false
            Profiles.localHoverState = false
            emitProfileHover(activeOption, "scroll")
            return
        }
        const wasFirst = activeOption === 0
        moveActiveOption(Math.max(activeOption - 1, 0))
        if (!wasFirst) bounce("left")
    }

    // ---- starting
    Timer {
        id: pressThrough
        interval: 300
        onTriggered: home.isPressingDown = true
    }
    function resetPress() {
        isPressingDown = false
        pressThrough.stop()
    }
    function animationFinished() {
        const selection = Profiles.homeSelection(activeOption)
        if (activeOption === Profiles.freePourOptionIndex) {
            resetPress()
            homeHoverState = false
            Nav.setScreen("freePour")
            return
        }
        if (selection.mode === "pour_over_profile") {
            resetPress()
            homeHoverState = false
            Nav.setScreen("guidedPourOver")
            return
        }
        const profile = Profiles.mergedProfiles[activeOption]
        if (!profile) { resetPress(); return }
        const clean = Object.assign({}, profile)
        delete clean.isLast
        delete clean.temporary
        Api.loadProfileFromJSON(clean).then(data => {
            if (!(data && typeof data === "object" && "name" in data)) throw new Error("Failed loading profile: " + (data && data.error))
            return Api.executeAction("start")
        }).then(response => {
            if (response && response.error) throw new Error("Failed starting profile: " + response.error)
            Profiles.profileStarting = true
            Nav.setScreen(home.requiresPurge ? "manual-purge" : "heating")
        }).catch(error => {
            console.error(error && error.message ? error.message : error)
            Profiles.profileStarting = false
            home.resetPress()
        })
    }

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture && !Profiles.profileStarting
        onTurnLeft: {
            if (pressThrough.running) return   // locks the movement while the push is held
            if (BackendSettings.data && BackendSettings.data.reverse_scrolling && BackendSettings.data.reverse_scrolling.home) home.rotateRight()
            else home.rotateLeft()
        }
        onTurnRight: {
            if (pressThrough.running) return
            if (BackendSettings.data && BackendSettings.data.reverse_scrolling && BackendSettings.data.reverse_scrolling.home) home.rotateLeft()
            else home.rotateRight()
        }
        onPressDown: {
            const option = home.activeOption
            if (option === Profiles.newOptionIndex) {
                if (!Device.isOnline) return
                if (Profiles.limitedAccess) {
                    Nav.setScreen("unlock")
                    return
                }
                const template = Profiles.simpleProfile
                if (!template) {
                    Profiles.refetchDefaults()
                    return
                }
                Profiles.settingsIndex = 0
                Profiles.isCreatingProfile = true
                Profiles.settingsProfile = Profiles.addSettingsToProfile(Profiles.newProfileFromTemplate(template))
                Nav.setScreen("pressetSettings")
                Nav.closeBubble()
            } else if (option === Profiles.freePourOptionIndex || Profiles.homeSelection(option).mode === "pour_over_profile") {
                if (!home.homeHoverState) {
                    home.homeHoverState = true
                    home.transitionDirection = "none"
                    pressThrough.restart()
                } else {
                    home.isPressingDown = true
                }
            } else {
                if (!home.homeHoverState) {
                    home.homeHoverState = true
                    Profiles.localHoverState = true
                    home.transitionDirection = "none"
                    home.emitProfileHover(option, "focus")
                    if (!Device.isOnline) return
                    pressThrough.restart()
                } else {
                    if (!Device.isOnline) return
                    home.isPressingDown = true
                }
            }
        }
        onPressUp: home.resetPress()
    }

    LoadingScreen {
        visible: home.loading
    }

    // ---- the carousel
    Item {
        id: list
        visible: !home.loading
        height: parent.height
        x: home.cardPadding - home.activeOption * home.cardPitch
        Behavior on x { NumberAnimation { duration: 150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }

        Repeater {
            id: cardRepeater
            model: home.cards.length
            delegate: Item {
                id: card
                required property int index
                readonly property var entry: home.cards[index] || ({ kind: "new", name: "" })
                readonly property string imageSource: String(cardImage.source)
                readonly property bool imageLoaded: cardImage.status === Image.Ready
                readonly property int distance: index - home.activeOption
                readonly property bool zoomed: home.homeHoverState
                property real bounceX: 0

                x: index * home.cardPitch + (home.gapIndex >= 0 && index >= home.gapIndex ? home.gapOffset : 0)
                y: 240 - home.cardSize / 2
                width: home.cardSize
                height: home.cardSize
                // Only the cards on screen are drawn, by where the list is now and not by the active option:
                // on a fast spin the list slides several cards behind the knob, and the cards it is passing
                // must stay drawn (130 px for the title, the zoom and the bounce beyond the card).
                readonly property real screenX: list.x + x
                visible: screenX + width + 130 > 0 && screenX - 130 < home.width

                opacity: zoomed && distance !== 0 ? 0 : (distance === 0 ? 1 : 0.3)
                Behavior on opacity { NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
                property real zoomScale: zoomed && distance === 0 ? 1.4 : 1
                property real zoomX: zoomed ? (distance < 0 ? -80 : distance > 0 ? 80 : 0) : 0
                property real zoomY: zoomed && distance !== 0 ? -80 : 0
                Behavior on zoomScale { NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
                Behavior on zoomX { NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
                Behavior on zoomY { NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
                transform: [
                    Scale { origin.x: home.cardSize / 2; origin.y: home.cardSize / 2; xScale: card.zoomScale; yScale: card.zoomScale },
                    Translate { x: card.bounceX + card.zoomX; y: card.zoomY }
                ]

                // bounce-right / bounce-left: 0 → ±5 px (20 %) → ∓1.5 px (50 %) → 0, 300 ms ease-out after 140 ms.
                SequentialAnimation {
                    id: bounce
                    property real sign: 1
                    PauseAnimation { duration: 140 }
                    NumberAnimation { target: card; property: "bounceX"; to: 5 * bounce.sign; duration: 60; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
                    NumberAnimation { target: card; property: "bounceX"; to: -1.5 * bounce.sign; duration: 90; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
                    NumberAnimation { target: card; property: "bounceX"; to: 0; duration: 150; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_OUT }
                }
                Connections {
                    target: home
                    function onBounced() {
                        const always = card.entry.kind === "free_pour" || card.entry.kind === "new"
                        if (Math.abs(card.distance) < 2 && (always || !home.homeHoverState)) {
                            bounce.stop()
                            card.bounceX = 0
                            bounce.sign = home.transitionDirection === "right" ? 1 : -1
                            bounce.start()
                        }
                    }
                }

                // TitleContainer: 150 % wide, 60 px tall, 68 px above the card; selected, it rises to 80 px and fades.
                Item {
                    readonly property bool away: card.zoomed && card.distance === 0
                    x: (parent.width - width) / 2
                    y: away ? -80 : -68
                    width: parent.width * 1.5
                    height: 60
                    z: 10
                    opacity: away ? 0 : 1
                    Behavior on y { NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE_IN_OUT } }
                    Behavior on opacity { NumberAnimation { duration: 300; easing.type: Easing.Bezier; easing.bezierCurve: Motion.EASE } }
                    Text {
                        readonly property string full: card.entry.name || ""
                        readonly property int size: full.length > 40 ? 17 : full.length > 30 ? 20 : 30
                        anchors.fill: parent
                        leftPadding: 5
                        rightPadding: 5
                        text: full.length > 70 ? full.substring(0, 70) + "..." : full
                        color: Theme.cream
                        font.family: Theme.fontRegular
                        font.pixelSize: size
                        font.letterSpacing: -0.025 * size
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                        wrapMode: Text.Wrap
                    }
                }

                // InnerContainer
                Rectangle {
                    anchors.fill: parent
                    radius: 3.018
                    color: card.entry.kind === "espresso" ? ((card.entry.profile.display && card.entry.profile.display.accentColor) || "#e0dcd0")
                         : card.entry.kind === "pour_over" ? ((card.entry.profile.display && card.entry.profile.display.accentColor) || "#1f3340")
                         : card.entry.kind === "free_pour" ? "#23383f" : "transparent"

                    Image {
                        id: cardImage
                        visible: card.entry.kind === "espresso" || card.entry.kind === "free_pour" || (card.entry.kind === "pour_over" && status !== Image.Error && Math.abs(card.distance) < 2)
                        anchors.centerIn: parent
                        width: 164
                        height: 164
                        sourceSize: Qt.size(164, 164)
                        asynchronous: true
                        fillMode: Image.PreserveAspectCrop
                        source: card.entry.kind === "espresso"
                                ? Api.profileImageUrl(card.entry.profile.display ? card.entry.profile.display.image : "")
                                : card.entry.kind === "free_pour" ? Theme.publicImage("images/free-pour.png")
                                : card.entry.kind === "pour_over" && Math.abs(card.distance) < 2 ? Profiles.pourOverImageUrl(card.entry.profile.id) : ""
                    }
                    // PourOverProfileImage: the Free Pour icon while far or when the image fails.
                    Image {
                        visible: card.entry.kind === "pour_over" && !cardImage.visible
                        anchors.centerIn: parent
                        sourceSize: Qt.size(126, 126)
                        source: Theme.asset("icons/free-pour.svg")
                    }
                    Image {
                        visible: card.entry.kind === "new"
                        anchors.centerIn: parent
                        source: Profiles.limitedAccess ? Theme.asset("icons/download.svg") : Theme.asset("icons/plus.svg")
                        sourceSize: Profiles.limitedAccess ? Qt.size(130, 130) : Qt.size(166, 166)
                    }
                    // LastLabel: "Last" under the card's right edge (a clock when temporary).
                    Row {
                        visible: card.entry.kind === "espresso" && !!card.entry.profile.isLast
                        anchors.right: parent.right
                        y: parent.height + 16 - height
                        spacing: 4
                        Text {
                            text: "Last"
                            color: Theme.cream
                            font.family: Theme.fontRegular
                            font.pixelSize: 12
                        }
                        Image {
                            visible: !!card.entry.profile && !!card.entry.profile.temporary
                            anchors.verticalCenter: parent.verticalCenter
                            source: Theme.asset("icons/clock.svg")
                            sourceSize: Qt.size(12, 12)
                        }
                    }
                }
            }
        }
    }

    // The removed card on its way out (a still copy: accent, image, title).
    Item {
        id: ghostItem
        property real ty: 0
        readonly property real startOpacity: home.ghostIndex === home.activeOption ? 1 : 0.3
        visible: home.ghost !== null && !home.loading
        x: list.x + home.ghostIndex * home.cardPitch
        y: 240 - home.cardSize / 2 + ty
        width: home.cardSize
        height: home.cardSize
        Text {
            readonly property string full: home.ghost ? (home.ghost.name || "") : ""
            readonly property int size: full.length > 40 ? 17 : full.length > 30 ? 20 : 30
            x: (parent.width - width) / 2
            y: -68
            width: parent.width * 1.5
            height: 60
            text: full.length > 70 ? full.substring(0, 70) + "..." : full
            color: Theme.cream
            font.family: Theme.fontRegular
            font.pixelSize: size
            font.letterSpacing: -0.025 * size
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            wrapMode: Text.Wrap
        }
        Rectangle {
            anchors.fill: parent
            radius: 3.018
            color: home.ghost && home.ghost.profile && home.ghost.profile.display && home.ghost.profile.display.accentColor
                   ? home.ghost.profile.display.accentColor : "#e0dcd0"
            Image {
                anchors.centerIn: parent
                width: 164
                height: 164
                sourceSize: Qt.size(164, 164)
                fillMode: Image.PreserveAspectCrop
                source: home.ghost && home.ghost.kind === "espresso" && home.ghost.profile.display
                        ? Api.profileImageUrl(home.ghost.profile.display.image) : ""
            }
        }
    }

    // ---- CircleOverlay: the "Hold to start" ring and text
    Item {
        id: overlay
        anchors.fill: parent
        z: 50
        readonly property real circumference: 2 * Math.PI * 235
        // strokeDashOffset as a fraction of the circumference: 1 hidden, 0 fully drawn.
        property real dashOffset: 1
        property real targetOffset: 1
        property bool isDrawn: false
        property bool wasLetGo: false
        readonly property bool shouldAnimate: home.isPressingDown

        // transition: stroke-dashoffset 1.0s ease-out
        NumberAnimation {
            id: dash
            target: overlay
            property: "dashOffset"
            duration: 1000
            easing.type: Easing.Bezier
            easing.bezierCurve: Motion.EASE_OUT
            onFinished: overlay.handleTransitionEnd()
        }
        function setOffset(v) {
            if (v === targetOffset) return
            targetOffset = v
            dash.stop()
            dash.from = dashOffset
            dash.to = v
            dash.start()
        }
        function handleTransitionEnd() {
            if (!shouldAnimate || targetOffset === 1) {
                isDrawn = false
            } else {
                isDrawn = true
                home.animationFinished()
            }
        }
        function sync() {
            if (isDrawn) return
            if (shouldAnimate) {
                setOffset(0)
            } else if (targetOffset !== 1) {
                wasLetGo = true
                setOffset(1)
            }
        }
        onShouldAnimateChanged: sync()
        onIsDrawnChanged: sync()
        // Reset the circle if we zoom out
        Connections {
            target: home
            function onHomeHoverStateChanged() { overlay.wasLetGo = false }
        }

        Arc {
            id: ring
            anchors.centerIn: parent
            radius: 235
            lineWidth: 5
            color: "white"
            sweep: 1 - overlay.dashOffset
            visible: sweep > 0.0005
            // opacityUpCircle / opacityDownCircle, 1.5 s, linear, forever
            opacity: overlay.shouldAnimate ? Motion.keyframes([[0, 0.1], [0.2, 0.5], [0.4, 1], [1, 1]], ringPulse.t)
                                           : Motion.keyframes([[0, 1], [0.4, 0.4], [0.8, 0.3], [1, 0.2]], ringPulse.t)
            QtObject { id: ringPulse; property real t: 0 }
            NumberAnimation {
                target: ringPulse
                property: "t"
                from: 0; to: 1
                duration: 1500
                loops: Animation.Infinite
                running: ring.visible
            }
            onVisibleChanged: ringPulse.t = 0
        }

        // CircleText: black over the whole screen, "Hold to start", flashed (opacityUpText 1 s) after a let-go.
        Rectangle {
            id: holdText
            anchors.fill: parent
            color: "black"
            property real t: 1
            readonly property bool flashing: home.homeHoverState && overlay.wasLetGo && !overlay.shouldAnimate
            opacity: flashText.running ? Motion.keyframes([[0, 0], [0.2, 0.7], [0.8, 0.7], [1, 0]], t) : 0
            visible: opacity > 0
            onFlashingChanged: if (flashing) flashText.restart()
            NumberAnimation {
                id: flashText
                target: holdText
                property: "t"
                from: 0; to: 1
                duration: 1000
                onFinished: overlay.wasLetGo = false
            }
            Text {
                anchors.centerIn: parent
                text: "Hold to start"
                color: "white"
                font.family: Theme.fontRegular
                font.pixelSize: 25
                font.letterSpacing: -0.25
            }
        }
    }
}
