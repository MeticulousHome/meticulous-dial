// Manual mode setup (src/components/ManualModeSetup/ManualModeSetup.tsx): three answers, then the shot
// starts. The machine keeps one seeded manual profile (Constants.MANUAL_MODE_PROFILE_ID), so this screen
// edits that document in place: it reads the saved temperature, final weight and stage order back into the
// gauges (the seeded default when the machine answers 404), writes the three answers, saves, loads and
// starts it, then goes to the purge (piston above it) or the heating screen. The final weight can be turned
// off entirely with a long press - a manual shot usually ends on the long press - and the gauge gives way to
// "Off". Reached from the quick settings' Experimental menu: aborting, a double press or a failed start
// reopens that menu.
import QtQuick
import Dial
import "ManualSetup.js" as ManualSetup
import "../freepour" as FreePour

Item {
    id: setup
    anchors.fill: parent
    property bool transitioning: false

    // Value gotten from ComplexProfileConverter.head_template on 'prepare' stage, the same rule the profile
    // settings screen starts a shot with.
    readonly property int pistonOnPurgePosition: 73
    readonly property var startOptions: [
        { key: "pressure", label: "Start on pressure" },
        { key: "flow", label: "Start on flow" },
        { key: "abort", label: "Abort" }
    ]

    property var profile: null                  // the manual profile once read back
    property string step: "temperature"         // temperature | output | start
    property real temperature: 0
    property real finalWeight: 0
    property string start: "pressure"           // pressure | flow | abort
    property var previousEnabledWeight: null
    property bool starting: false
    property bool requiresPurge: false
    property bool _alive: true

    readonly property int activeStartIndex: Math.max(0, startOptions.findIndex(option => option.key === start))

    // Test probes
    readonly property string dialProbe_manualStep: profile ? step : "loading"
    readonly property real dialProbe_manualTemperature: temperature
    readonly property real dialProbe_manualWeight: finalWeight
    readonly property string dialProbe_manualStart: start

    // requiresPurge: the piston sits above the purge position.
    function syncPurge() {
        const pos = Stats.sensorData.m_pos
        requiresPurge = !!pos && pos < pistonOnPurgePosition
    }
    Connections {
        target: Stats
        function onSensorDataChanged() { setup.syncPurge() }
    }

    // useDimScreen: the screen dims when the Dial goes idle here and lights up again.
    Connections {
        target: Idle
        function onIsIdleChanged() {
            Api.setBrightness({ brightness: Idle.isIdle ? 0 : 1 }).catch(error => console.error("Error setting brightness", error && error.message))
        }
    }

    // The profile is the machine's, so the gauges only mean anything once it has been read back. A machine
    // that has never seen manual mode answers 404, and the seeded document stands in until the first save.
    Component.onCompleted: {
        syncPurge()
        Api.getProfile(ManualSetup.MANUAL_MODE_PROFILE_ID).then(data => {
            return data && typeof data === "object" && !("error" in data) ? data : ManualSetup.defaultManualProfile()
        }, error => {
            console.error("Could not read the manual profile:", error && error.message ? error.message : error)
            return ManualSetup.defaultManualProfile()
        }).then(loaded => {
            if (!setup._alive) return
            setup.temperature = loaded.temperature
            setup.finalWeight = loaded.final_weight
            setup.previousEnabledWeight = ManualSetup.isWeightDisabled(loaded.final_weight) ? null : loaded.final_weight
            setup.start = ManualSetup.startControlOf(loaded)
            setup.profile = loaded
        })
    }
    Component.onDestruction: _alive = false

    // The screen is reached from the quick-settings Experimental menu, so leaving it - aborting,
    // double-clicking or failing to start - reopens that menu rather than the profile list.
    function backToMenu() {
        Nav.setScreen(Nav.prev || "profileHome")
        Nav.setBubbleDisplay({ visible: true, component: "experimentalSettings" })
    }

    function isError(data) { return !!(data && typeof data === "object" && "error" in data) }
    function message(error) { return error && error.message ? error.message : String(error) }

    function confirm() {
        if (starting || !profile || start === "abort") return
        starting = true
        const applied = ManualSetup.applyManualSetup(profile, { temperature: temperature, finalWeight: finalWeight, start: start })
        const fail = () => {
            if (!setup._alive) return
            setup.starting = false
            setup.backToMenu()
        }
        // saveProfile / loadProfileData / startProfile (src/api/profile.ts) answer undefined on an error.
        Api.saveProfile(applied).catch(error => { console.error("SaveProfile error: ", message(error)); return undefined }).then(saved => {
            if (!saved || isError(saved)) {
                console.error("Failed saving the manual profile")
                fail()
                return
            }
            return Api.loadProfileFromJSON(applied).catch(error => { console.error("LoadProfileData error: ", message(error)); return undefined }).then(loaded => {
                if (!(typeof loaded === "object" && loaded && "name" in loaded)) {
                    console.error("Failed loading the manual profile")
                    fail()
                    return
                }
                Profiles.profileStarting = true
                return Api.executeAction("start").catch(error => { console.error("Start profile error: ", message(error)); return undefined }).then(response => {
                    if (response && !isError(response)) {
                        Nav.setScreen(setup.requiresPurge ? "manual-purge" : "heating")
                        return
                    }
                    Profiles.profileStarting = false
                    console.error("Failed starting the manual profile")
                    fail()
                })
            })
        })
    }

    function turn(direction) {
        if (step === "temperature") {
            temperature = ManualSetup.nextTemperature(temperature, direction)
            return
        }
        if (step === "output") {
            const next = ManualSetup.nextWeight(finalWeight, previousEnabledWeight, direction)
            previousEnabledWeight = next
            finalWeight = next
            return
        }
        const index = startOptions.findIndex(option => option.key === start)
        const next = direction === "left" ? index - 1 : index + 1
        start = startOptions[Math.min(Math.max(next, 0), startOptions.length - 1)].key
    }

    GestureHandler {
        enabled: !(Nav.bubbleInterceptsGesture || !setup.profile)
        onTurnLeft: setup.turn("left")
        onTurnRight: setup.turn("right")
        onLongEncoder: {
            if (setup.step !== "output") return
            if (!ManualSetup.isWeightDisabled(setup.finalWeight)) setup.previousEnabledWeight = setup.finalWeight
            setup.finalWeight = ManualSetup.MANUAL_WEIGHT_DISABLED
        }
        // click is the short push the machine reports on release. pressDown fires the moment the knob goes
        // down, before a long press is known to be one, so accepting on it turned every long press on the
        // weight step into an accept and the Off gesture never reached the gauge.
        onClick: {
            if (setup.step === "temperature") {
                setup.step = "output"
                return
            }
            if (setup.step === "output") {
                setup.step = "start"
                return
            }
            if (setup.start === "abort") {
                setup.backToMenu()
                return
            }
            setup.confirm()
        }
        onDoubleClick: setup.backToMenu()
    }

    LoadingScreen {
        visible: !setup.profile
    }

    ManualGauge {
        visible: !!setup.profile && setup.step === "temperature"
        unit: "celcius"
        maxValue: ManualSetup.MANUAL_TEMPERATURE_MAX
        precision: 1
        value: setup.temperature
    }
    ManualGauge {
        visible: !!setup.profile && setup.step === "output" && !ManualSetup.isWeightDisabled(setup.finalWeight)
        unit: "gram"
        maxValue: ManualSetup.MANUAL_WEIGHT_MAX
        precision: 1
        value: setup.finalWeight
    }
    // OffValue: "Off" in ABC Diatype Mono 140 px (96 px line), yellow, centered.
    FreePour.FpText {
        visible: !!setup.profile && setup.step === "output" && ManualSetup.isWeightDisabled(setup.finalWeight)
        y: (480 - 96) / 2
        mono: true
        tabular: false
        lineHeightPx: 96
        font.pixelSize: 140
        color: "#f5c444"
        text: "Off"
    }
    // Legend: anchored by its bottom edge 74 px up; a second line stacks above the first, 7 px apart.
    Item {
        visible: !!setup.profile && setup.step !== "start"
        readonly property var lines: setup.step === "output" ? [ManualSetup.outputStepHint(setup.finalWeight), "Click to continue"] : ["Click to continue"]
        width: 480
        height: lines.length * 15 + (lines.length - 1) * 7
        y: 480 - 74 - height
        Repeater {
            model: parent.lines.length
            FreePour.FpText {
                required property int index
                y: index * (15 + 7)
                tabular: false
                font.pixelSize: 15
                letterSpacingPx: 1.125
                color: "#808080"
                text: parent.lines[index]
            }
        }
    }
    OptionsMenu {
        visible: !!setup.profile && setup.step === "start"
        width: 480
        options: setup.startOptions
        activeIndex: setup.activeStartIndex
    }
}
