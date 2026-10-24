// Free Pour (src/features/freePour/FreePourScreen.tsx, free-pour.css): a hand-poured brew guided by the
// machine's scale, in eight steps: water temperature, then the empty server, the brewer and the coffee, each
// recorded once the scale is stable and then tared through the backend ('action' 'tare'); then the brew:
// pours detected from the weight (PourDetector), a timer, the pour rail (or the profile's target rail and
// stop weight in a guided pour-over), the live flow; lifting the brewer ends it and the beverage left on the
// server is measured; the brew is saved (FreePourStorage) and summarized. A push records a weight, finishes
// the brew or opens its chart; turning reviews the recorded setup; a double press aborts.
//
// `profile` is the guided pour-over's PourOverProfile (GuidedPourOverScreen), null for a Free Pour.
// `testScale` ({ w, g }) replaces the machine's scale for the end-to-end tests.
import QtQuick
import Dial
import Dial.Native
import "Css.js" as Css
import "Format.js" as Format
import "PourDetector.js" as Detector
import "BrewWeightFilter.js" as Filter
import "SetupFlow.js" as Setup
import "Profile.js" as Defaults
import "Logging.js" as Log

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false
    property var profile: null
    property var testScale: null

    readonly property color white: "#e7e3da"
    readonly property color muted: "#8d9694"

    readonly property int sampleIntervalMs: 200
    readonly property int preStartSampleCapacity: 20
    readonly property int maxBrewDurationMs: 10 * 60 * 1000
    readonly property int maxPours: 5
    readonly property int tareConfirmTimeoutMs: 5000

    // state.stats.sensors.w || 0 and .g || 0
    readonly property real weight: testScale ? (Number(testScale.w) || 0) : (Stats.sensors.w || 0)
    readonly property real gravimetricFlow: testScale ? (Number(testScale.g) || 0) : (Stats.sensors.g || 0)

    // ---- state (useState)
    property string stage: "temperature"
    property real doseG: 15
    property real temperatureC: Defaults.DEFAULT_FREE_POUR_TEMPERATURE_C
    property real elapsedMs: 0
    property bool timeLimitReached: false
    property var pours: []
    property var activePourView: null           // { number, startTimeMs } | null
    property var result: null                   // FreePourSession | null
    property string setupStatus: "idle"         // idle | saving | taring | tare-timeout
    property int setupReviewCursor: 0
    property bool stable: false                 // useStableWeight
    property string runId: ""

    readonly property bool serverReady: stable
    readonly property bool brewerReady: stable && Setup.isValidSetupWeight("brewer", weight)
    readonly property bool coffeeReady: stable && weight >= 5 && weight <= 40

    // ---- refs (useRef): plain JS, no notifications
    property var r: null

    // Test probes
    readonly property string dialProbe_freePourStage: stage
    readonly property string dialProbe_freePourSetupStatus: setupStatus
    readonly property bool dialProbe_freePourStable: stable
    readonly property var dialProbe_freePourResult: result
    readonly property int dialProbe_freePourPours: pours.length

    function isSetupStage(s) { return s === "server" || s === "brewer" || s === "coffee" }
    function stepForStage(s) {
        if (s === "temperature") return 1
        if (s === "server") return 2
        if (s === "brewer") return 3
        if (s === "coffee") return 4
        if (s === "setup-review") return 4
        if (s === "ready" || s === "pouring") return 5
        if (s === "waiting") return 6
        if (s === "finish-requested" || s === "measuring") return 7
        return 8
    }
    function now() { return Native.monotonicMs() }

    function makeRefs() {
        return {
            detector: new Detector.PourDetector(),
            serverWeight: 0,
            brewerWeight: 0,
            setupWeight: 0,
            setupCaptureWeight: 0,
            completedSetupStages: [],
            setupReviewReturnStage: "ready",
            startedAtIso: "",
            brewStartTime: null,
            elapsedMs: 0,
            timeLimitReached: false,
            lastStoredSampleTime: 0,
            lastPeakFilterTime: null,
            peakWaterWeight: 0,
            brewerRemoval: new Filter.BrewerRemovalConfirmation(),
            samples: [],
            completedPours: [],
            activePour: null,
            completion: "brewer_removed",
            finalizing: false,
            sessionCreationStarted: false,
            sessionSaved: false,
            preStart: {
                times: new Float64Array(preStartSampleCapacity),
                weights: new Float32Array(preStartSampleCapacity),
                flows: new Float32Array(preStartSampleCapacity),
                cursor: 0,
                count: 0,
                lastSampleAtMs: 0
            },
            readings: [],          // useStableWeight
            effectDeps: ({})       // the dependency lists the effects last ran with
        }
    }

    Component.onCompleted: {
        r = makeRefs()
        runId = Profiles.uuid()
        if (profile) {
            doseG = profile.doseG
            temperatureC = profile.temperatureC
        }
        Log.logFreePour("screen_entered", { runId: runId, stage: "temperature", mode: profile ? "profile" : "free_pour",
                                            profile_id: profile ? profile.id : null })
        runEffects()
    }
    Component.onDestruction: {
        Log.logFreePour("screen_exited", { runId: runId, stage: stage, session_saved: !!(r && r.sessionSaved) })
    }

    function updateStage(next) {
        const previous = stage
        if (previous === next) return
        Log.logFreePour("stage_changed", { runId: runId, from: previous, to: next })
        stage = next
    }

    function enterSetupReview(returnStage, direction) {
        if (setupStatus !== "idle" || r.completedSetupStages.length === 0 || r.brewStartTime !== null) return
        r.setupReviewReturnStage = returnStage
        setupReviewCursor = direction === "backward" ? r.completedSetupStages.length - 1 : 0
        Log.logFreePour("setup_review_opened", { runId: runId, from: returnStage, direction: direction })
        updateStage("setup-review")
    }

    function restartSetupForCorrection(selectedStage) {
        Log.logFreePour("setup_correction_started", { runId: runId, selected_stage: selectedStage, restart_stage: "server" })
        // Every setup capture is followed by a tare, so changing an earlier value invalidates all dependent
        // readings. Restarting from the empty server is the only safe way to establish a new baseline.
        r.serverWeight = 0
        r.brewerWeight = 0
        r.setupWeight = 0
        r.setupCaptureWeight = 0
        r.completedSetupStages = []
        doseG = profile ? profile.doseG : 15
        setupStatus = "idle"
        r.detector.reset()
        r.preStart.cursor = 0
        r.preStart.count = 0
        r.preStart.lastSampleAtMs = 0
        updateStage("server")
    }

    function finishActivePour(timeMs, endWeightG, settledWeightG) {
        const current = r.activePour
        if (!current || r.brewStartTime === null) return false
        const endTimeMs = Math.max(current.startTimeMs, timeMs - r.brewStartTime)
        const finalWeight = Detector.resolvedPourEndWeight(current.startWeightG, Math.max(endWeightG, current.peakWeightG), settledWeightG)
        if (finalWeight === null) {
            Log.logFreePour("pour_discarded_motion", {
                runId: runId, pour: current.number, start_ms: Math.round(current.startTimeMs), end_ms: Math.round(endTimeMs),
                start_weight_g: Format.roundTo(current.startWeightG), settled_weight_g: Format.roundTo(settledWeightG),
                peak_weight_g: Format.roundTo(current.peakWeightG)
            })
            r.peakWaterWeight = current.baselineWaterG
            r.activePour = null
            activePourView = null
            return false
        }
        if (settledWeightG !== undefined) r.peakWaterWeight = Math.max(current.baselineWaterG, finalWeight)
        const waterG = Math.max(0, finalWeight - current.startWeightG)
        const durationSeconds = Math.max(0.1, (endTimeMs - current.startTimeMs) / 1000)
        const finished = {
            number: current.number,
            startTimeMs: Math.round(current.startTimeMs),
            endTimeMs: Math.round(endTimeMs),
            startWeightG: Format.roundTo(current.startWeightG),
            endWeightG: Format.roundTo(finalWeight),
            waterG: Format.roundTo(waterG),
            averageFlowGps: Format.roundTo(waterG / durationSeconds),
            peakFlowGps: Format.roundTo(current.peakFlowGps)
        }
        Log.logFreePour("pour_ended", {
            runId: runId, pour: finished.number, start_ms: finished.startTimeMs, end_ms: finished.endTimeMs,
            water_g: finished.waterG, average_flow_gps: finished.averageFlowGps, peak_flow_gps: finished.peakFlowGps
        })
        r.completedPours = r.completedPours.concat([finished])
        pours = r.completedPours
        r.activePour = null
        activePourView = null
        return true
    }

    function resetRejectedFirstMotion() {
        r.brewStartTime = null
        r.startedAtIso = ""
        r.elapsedMs = 0
        elapsedMs = 0
        r.lastStoredSampleTime = 0
        r.lastPeakFilterTime = null
        r.peakWaterWeight = 0
        r.samples = []
        r.preStart.cursor = 0
        r.preStart.count = 0
        r.preStart.lastSampleAtMs = 0
        r.detector.reset()
        r.brewerRemoval.reset()
        Log.logFreePour("brew_start_rejected_motion", { runId: runId })
    }

    function appendConfirmedPreStartSamples(startTimeMs, pourNumber) {
        const pre = r.preStart
        const capacity = preStartSampleCapacity
        const oldest = (pre.cursor - pre.count + capacity) % capacity
        for (let offset = 0; offset < pre.count; offset += 1) {
            const index = (oldest + offset) % capacity
            const sampleTimeMs = pre.times[index]
            if (sampleTimeMs < startTimeMs) continue
            r.samples.push({
                t: Math.round(sampleTimeMs - startTimeMs),
                w: Format.roundTo(Math.max(0, pre.weights[index])),
                f: Format.roundTo(Math.max(0, pre.flows[index])),
                p: pourNumber
            })
        }
        r.lastStoredSampleTime = pre.lastSampleAtMs
        pre.cursor = 0
        pre.count = 0
        pre.lastSampleAtMs = 0
    }

    function createSession(beverageG) {
        if (r.sessionCreationStarted) {
            Log.logFreePour("session_creation_ignored", { runId: runId, reason: "already_started" })
            return
        }
        r.sessionCreationStarted = true
        const waterPouredG = Math.max(0, Format.roundTo(r.peakWaterWeight))
        const measuredBeverage = beverageG === null ? null : Math.max(0, Format.roundTo(beverageG))
        const retainedG = measuredBeverage === null ? null : Math.max(0, Format.roundTo(waterPouredG - measuredBeverage))
        const nowDate = new Date()
        const session = {
            schemaVersion: Defaults.FREE_POUR_SCHEMA_VERSION,
            id: Profiles.uuid(),
            brewType: "pour_over",
            mode: profile ? "profile" : "free_pour",
            name: profile ? profile.name : "Free Pour",
            source: "dial",
            startedAt: r.startedAtIso || nowDate.toISOString(),
            completedAt: nowDate.toISOString(),
            recipe: {
                profileId: profile ? profile.id : null,
                profileName: profile ? profile.name : "Free Pour",
                doseG: profile ? profile.doseG : doseG,
                temperatureC: profile ? profile.temperatureC : temperatureC,
                targetWaterG: profile ? profile.targetWaterG : null,
                targetDurationMs: profile ? profile.targetDurationMs : null,
                pourTargets: profile ? profile.pourTargets : []
            },
            measurements: {
                serverBaselineG: Format.roundTo(r.serverWeight),
                brewerG: Format.roundTo(r.brewerWeight),
                setupG: Format.roundTo(r.setupWeight),
                doseG: Format.roundTo(doseG),
                waterTemperatureC: temperatureC,
                waterPouredG: waterPouredG,
                beverageG: measuredBeverage,
                retainedG: retainedG,
                durationMs: Math.round(r.elapsedMs),
                status: measuredBeverage === null ? "skipped" : "measured"
            },
            pours: r.completedPours,
            samples: r.samples,
            completion: r.completion,
            sync: { status: "pending", attempts: 0 }
        }
        Log.logFreePour("session_completed", {
            runId: runId, duration_ms: session.measurements.durationMs, pours: session.pours.length,
            water_g: session.measurements.waterPouredG, beverage_g: session.measurements.beverageG,
            retained_g: session.measurements.retainedG, temperature_c: session.measurements.waterTemperatureC,
            profile_id: session.recipe.profileId, completion: session.completion
        })
        result = session
        updateStage("result")
        const refs = r
        const id = runId
        FreePourStorage.saveFreePourSession(session).then(() => {
            refs.sessionSaved = true
            Log.logFreePour("session_saved", { runId: id, sessionId: session.id })
            // invoke('community_scan_history'): the Window's request, when the Community uploader listens.
            try {
                const window = screen.Window.window
                if (window && typeof window.communityScanRequested === "function") window.communityScanRequested()
            } catch (error) {
                // The screen is gone already: nothing to ask.
            }
        }).catch(error => {
            Log.logFreePourError("session_save_failed", error, { runId: id, sessionId: session.id })
        })
    }

    function beginMeasurement(timeMs) {
        if (r.finalizing) return
        r.finalizing = true
        if (r.brewStartTime !== null) {
            const finalElapsedMs = r.timeLimitReached ? maxBrewDurationMs
                                 : Math.min(maxBrewDurationMs, Math.max(0, timeMs - r.brewStartTime))
            r.elapsedMs = finalElapsedMs
            elapsedMs = finalElapsedMs
        }
        if (r.activePour) finishActivePour(timeMs, r.peakWaterWeight)
        r.detector.reset()
        r.brewerRemoval.reset()
        Log.logFreePour("brew_weight_measurement_started", { runId: runId, elapsed_ms: Math.round(r.elapsedMs), scale_g: Format.roundTo(weight) })
        updateStage("measuring")
    }

    // ---- useStableWeight: 700 ms of readings within 0.6 g
    Timer {
        interval: 100
        repeat: true
        running: true
        onTriggered: {
            const t = screen.now()
            const readings = screen.r.readings
            readings.push({ time: t, weight: screen.weight })
            while (readings.length && readings[0].time < t - 900) readings.shift()
            let min = Infinity, max = -Infinity
            for (const reading of readings) {
                if (reading.weight < min) min = reading.weight
                if (reading.weight > max) max = reading.weight
            }
            const range = readings.length ? max - min : Infinity
            const duration = t - (readings.length ? readings[0].time : t)
            const nextStable = duration >= 700 && range <= 0.6
            if (screen.stable !== nextStable) screen.stable = nextStable
        }
    }

    // ---- keep the Dial awake during a brew
    Timer {
        interval: 60000
        repeat: true
        running: true
        onTriggered: Idle.resetTimer()
    }

    // ---- the brew loop, every 100 ms
    Timer {
        interval: 100
        repeat: true
        running: true
        onTriggered: screen.tick()
    }

    function tick() {
        const t = now()
        const currentStage = stage
        const currentWeight = weight
        const currentFlow = Math.max(0, gravimetricFlow)

        const brewStillOnScale = currentStage === "pouring" || currentStage === "waiting" || currentStage === "finish-requested"
        if (r.brewStartTime !== null && brewStillOnScale) {
            if (!r.timeLimitReached) {
                const rawElapsedMs = t - r.brewStartTime
                const nextElapsed = Math.min(maxBrewDurationMs, rawElapsedMs)
                r.elapsedMs = nextElapsed
                elapsedMs = nextElapsed
                const peakFilterElapsedMs = r.lastPeakFilterTime === null ? 100 : t - r.lastPeakFilterTime
                r.lastPeakFilterTime = t
                if (r.activePour) {
                    r.peakWaterWeight = Filter.updatePlausiblePeakWeight(r.peakWaterWeight, currentWeight, peakFilterElapsedMs)
                    r.activePour.peakWeightG = Filter.updatePlausiblePeakWeight(r.activePour.peakWeightG, currentWeight, peakFilterElapsedMs)
                    r.activePour.peakFlowGps = Math.max(r.activePour.peakFlowGps, Detector.plausiblePeakFlow(currentFlow))
                }
                if (t - r.lastStoredSampleTime >= sampleIntervalMs) {
                    r.lastStoredSampleTime = t
                    r.samples.push({
                        t: Math.round(nextElapsed),
                        w: Format.roundTo(Math.max(0, currentWeight)),
                        f: Format.roundTo(currentFlow),
                        p: r.activePour ? r.activePour.number : 0
                    })
                }

                if (rawElapsedMs >= maxBrewDurationMs) {
                    r.timeLimitReached = true
                    timeLimitReached = true
                    r.completion = "dial_fallback"
                    if (r.activePour) finishActivePour(r.brewStartTime + maxBrewDurationMs, r.peakWaterWeight)
                    r.detector.reset()
                    Log.logFreePour("brew_time_limit_reached", { runId: runId, limit_ms: maxBrewDurationMs,
                                                                 water_g: Format.roundTo(r.peakWaterWeight), samples: r.samples.length })
                    updateStage("finish-requested")
                }
            }

            const removalThreshold = Filter.brewerRemovalThreshold(r.setupWeight)
            const belowRemovalThreshold = r.peakWaterWeight >= 20 && currentWeight <= r.peakWaterWeight - removalThreshold
            const removalState = r.brewerRemoval.update(belowRemovalThreshold, t, currentWeight)
            if (removalState.type === "started") {
                Log.logFreePour("brewer_removal_candidate_started", { runId: runId, scale_g: Format.roundTo(currentWeight),
                                                                     peak_water_g: Format.roundTo(r.peakWaterWeight),
                                                                     threshold_g: Format.roundTo(removalThreshold) })
            } else if (removalState.type === "cancelled") {
                Log.logFreePour("brewer_removal_candidate_cancelled", { runId: runId, held_ms: Math.round(removalState.heldMs),
                                                                       scale_g: Format.roundTo(currentWeight) })
            } else if (removalState.type === "confirmed") {
                const candidate = Filter.classifyBrewWeightCandidate(currentWeight, r.setupWeight, r.peakWaterWeight)
                if (candidate.type === "setup-still-on-scale") {
                    // A settled brewer cannot yield more beverage than the water that was poured. This was scale
                    // motion, not a lift. Reconcile the shake-inflated high-water mark without flashing the
                    // measurement screen, then let pour detection finish against the settled mass.
                    r.peakWaterWeight = Math.max(0, currentWeight)
                    if (r.activePour) r.activePour.peakWeightG = Math.max(r.activePour.baselineWaterG, currentWeight)
                    r.brewerRemoval.reset()
                    Log.logFreePour("brewer_removal_rejected", { runId: runId, reason: "setup_still_on_scale",
                                                                candidate_beverage_g: Format.roundTo(candidate.beverageG),
                                                                water_g: Format.roundTo(r.peakWaterWeight) })
                    return
                }
                Log.logFreePour("brewer_removal_detected", { runId: runId, held_ms: Math.round(removalState.heldMs),
                                                            scale_g: Format.roundTo(currentWeight),
                                                            peak_water_g: Format.roundTo(r.peakWaterWeight),
                                                            threshold_g: Format.roundTo(removalThreshold) })
                beginMeasurement(removalState.startedAtMs)
                return
            }

            // Do not feed a large downward transition into the pour detector. A confirmed brewer lift otherwise
            // appears as a short, very fast pour because gravimetric flow lags the scale reading.
            if (removalState.type === "started" || removalState.type === "pending") return
        } else {
            r.lastPeakFilterTime = null
            r.brewerRemoval.reset()
        }

        const brewingStage = currentStage === "ready" || currentStage === "pouring" || currentStage === "waiting"
        if (!brewingStage || r.timeLimitReached) return

        const pre = r.preStart
        if (currentStage === "ready" && r.brewStartTime === null && t - pre.lastSampleAtMs >= sampleIntervalMs) {
            const index = pre.cursor
            pre.times[index] = t
            pre.weights[index] = currentWeight
            pre.flows[index] = currentFlow
            pre.cursor = (pre.cursor + 1) % preStartSampleCapacity
            pre.count = Math.min(preStartSampleCapacity, pre.count + 1)
            pre.lastSampleAtMs = t
        }
        const event = r.detector.process({ timeMs: t, weightG: currentWeight, flowGps: currentFlow })
        if (event && event.type === "pour-start") {
            const waterBeforePour = r.peakWaterWeight
            if (r.brewStartTime === null) {
                r.brewStartTime = event.sample.timeMs
                r.startedAtIso = new Date(Date.now() - (t - event.sample.timeMs)).toISOString()
                r.peakWaterWeight = Math.max(0, currentWeight)
                r.lastPeakFilterTime = t
                r.brewerRemoval.reset()
            }
            const previousFifthPour = r.completedPours.length >= maxPours ? r.completedPours[maxPours - 1] : null
            if (previousFifthPour) {
                r.completedPours = r.completedPours.slice(0, -1)
                pours = r.completedPours
            }
            const startTimeMs = previousFifthPour ? previousFifthPour.startTimeMs : event.sample.timeMs - r.brewStartTime
            const nextPour = previousFifthPour ? {
                number: maxPours,
                startTimeMs: startTimeMs,
                startWeightG: previousFifthPour.startWeightG,
                baselineWaterG: Math.min(waterBeforePour, previousFifthPour.startWeightG),
                peakWeightG: Math.max(previousFifthPour.endWeightG, event.sample.weightG),
                peakFlowGps: Math.max(previousFifthPour.peakFlowGps, Detector.plausiblePeakFlow(event.sample.flowGps))
            } : {
                number: r.completedPours.length + 1,
                startTimeMs: startTimeMs,
                startWeightG: Math.max(0, event.sample.weightG),
                baselineWaterG: waterBeforePour,
                peakWeightG: Math.max(0, event.sample.weightG),
                peakFlowGps: Detector.plausiblePeakFlow(event.sample.flowGps)
            }
            r.activePour = nextPour
            if (nextPour.number === 1) {
                nextPour.peakWeightG = Math.max(nextPour.peakWeightG, currentWeight)
                nextPour.peakFlowGps = Math.max(nextPour.peakFlowGps, Detector.plausiblePeakFlow(currentFlow))
                appendConfirmedPreStartSamples(r.brewStartTime, nextPour.number)
            }
            Log.logFreePour("pour_started", { runId: runId, pour: nextPour.number, start_ms: Math.round(nextPour.startTimeMs),
                                             start_weight_g: Format.roundTo(nextPour.startWeightG),
                                             flow_gps: Format.roundTo(event.sample.flowGps) })
            activePourView = { number: nextPour.number, startTimeMs: startTimeMs }
            updateStage("pouring")
        } else if (event && event.type === "pour-end" && r.activePour) {
            const retained = finishActivePour(event.sample.timeMs, r.activePour.peakWeightG, event.sample.weightG)
            if (!retained && r.completedPours.length === 0) {
                resetRejectedFirstMotion()
                updateStage("ready")
            } else {
                updateStage("waiting")
            }
        }
    }

    // ---- the effects (useEffect), after each change, in their React order. Each runs when one of its
    // dependencies changed, with the values of the render that changed it (a snapshot), as React does: the
    // stage change that resets `stable` still runs the other effects with the previous `stable`.
    function depsChanged(name, deps) {
        const previous = r.effectDeps[name]
        let changed = !previous || previous.length !== deps.length
        if (!changed) {
            for (let i = 0; i < deps.length; i++) {
                if (!Object.is(previous[i], deps[i])) { changed = true; break }
            }
        }
        if (changed) r.effectDeps[name] = deps
        return changed
    }
    function scheduleEffects() { if (r) Qt.callLater(runEffects) }
    onStageChanged: scheduleEffects()
    onStableChanged: scheduleEffects()
    onWeightChanged: scheduleEffects()
    onSetupStatusChanged: scheduleEffects()
    onPourCueChanged: scheduleEffects()
    onActiveTargetNumberChanged: scheduleEffects()

    function runEffects() {
        if (!r) return
        const s = { stable: stable, stage: stage, weight: weight, setupStatus: setupStatus }

        // useStableWeight: a new stage starts a new stability window.
        if (depsChanged("stableReset", [s.stage])) {
            r.readings = []
            stable = false
        }

        if (depsChanged("measuring", [s.stable, s.stage, s.weight]) && s.stable && s.stage === "measuring") {
            const water = r.peakWaterWeight
            const candidate = Filter.classifyBrewWeightCandidate(s.weight, r.setupWeight, water)
            if (candidate.type === "plausible") {
                Log.logFreePour("brew_weight_accepted", { runId: runId, beverage_g: Format.roundTo(candidate.beverageG), water_g: Format.roundTo(water) })
                createSession(candidate.beverageG)
            } else if (candidate.type === "server-missing") {
                Log.logFreePour("server_missing_after_brewer_removal", { runId: runId, candidate_beverage_g: Format.roundTo(candidate.beverageG),
                                                                         water_g: Format.roundTo(water) })
                r.finalizing = false
                updateStage("replace-server")
            } else {
                // A transient bump can resemble a lift. Return to the live state once the full setup is stable
                // on the scale again.
                Log.logFreePour("brewer_removal_rejected", { runId: runId, reason: "weight_above_plausible_range",
                                                            candidate_beverage_g: Format.roundTo(candidate.beverageG),
                                                            water_g: Format.roundTo(water) })
                r.finalizing = false
                updateStage(r.timeLimitReached ? "finish-requested" : "waiting")
            }
        }

        if (depsChanged("replaceServer", [s.stable, s.stage, s.weight]) && s.stable && s.stage === "replace-server") {
            const water = r.peakWaterWeight
            const candidate = Filter.classifyBrewWeightCandidate(s.weight, r.setupWeight, water)
            if (candidate.type === "plausible") {
                Log.logFreePour("replacement_server_accepted", { runId: runId, beverage_g: Format.roundTo(candidate.beverageG),
                                                                water_g: Format.roundTo(water) })
                createSession(candidate.beverageG)
            }
        }

        if (depsChanged("saving", [s.setupStatus, s.stable, s.stage, s.weight])
                && s.setupStatus === "saving" && s.stable && isSetupStage(s.stage))
            savingEffect(s)

        if (depsChanged("taring", [s.setupStatus, s.stable, s.stage, s.weight])
                && s.setupStatus === "taring" && s.stable && isSetupStage(s.stage)
                && Math.abs(s.weight) <= Setup.SETUP_ZERO_WEIGHT_TOLERANCE_G) {
            Log.logFreePour("tare_confirmed", { runId: runId, stage: s.stage, weight_g: Format.roundTo(s.weight) })
            setupStatus = "idle"
            updateStage(Setup.nextStageAfterTare(s.stage))
        }

        if (depsChanged("tareTimeout", [s.setupStatus, s.stage])) {
            tareTimeout.stop()
            if (s.setupStatus === "taring" && isSetupStage(s.stage)) {
                tareTimeout.taringStage = s.stage
                tareTimeout.start()
            }
        }

        const targetNumber = activeTarget ? activeTarget.number : -1
        if (depsChanged("cueLog", [targetNumber, pourCue]) && activeTarget && (pourCue === "countdown" || pourCue === "due")) {
            Log.logFreePour(pourCue === "countdown" ? "next_pour_cue_started" : "next_pour_due",
                            { runId: runId, pour: activeTarget.number, target_start_ms: activeTarget.startTimeMs })
        }
    }

    function savingEffect(s) {
        if (Math.abs(s.weight - r.setupCaptureWeight) > Setup.SETUP_ZERO_WEIGHT_TOLERANCE_G) {
            Log.logFreePour("weight_save_cancelled", { runId: runId, stage: s.stage, reason: "weight_changed_after_press",
                                                      requested_weight_g: Format.roundTo(r.setupCaptureWeight),
                                                      weight_g: Format.roundTo(s.weight) })
            setupStatus = "idle"
            return
        }
        if (!Setup.isValidSetupWeight(s.stage, s.weight)) {
            Log.logFreePour("weight_save_cancelled", { runId: runId, stage: s.stage, reason: "weight_out_of_range",
                                                      weight_g: Format.roundTo(s.weight) })
            setupStatus = "idle"
            return
        }
        if (s.stage === "server") {
            r.serverWeight = s.weight
        } else if (s.stage === "brewer") {
            r.brewerWeight = Setup.normalizeBrewerWeight(s.weight)
        } else {
            const measuredDose = s.weight
            doseG = Math.round(measuredDose)
            r.setupWeight = r.brewerWeight + measuredDose
        }
        Log.logFreePour("weight_saved", { runId: runId, stage: s.stage, weight_g: Format.roundTo(s.weight) })
        if (r.completedSetupStages.indexOf(s.stage) < 0) r.completedSetupStages = r.completedSetupStages.concat([s.stage])
        setupStatus = "taring"
        Backend.action("tare")
        Log.logFreePour("tare_requested", { runId: runId, stage: s.stage })
    }

    Timer {
        id: tareTimeout
        property string taringStage: ""
        interval: screen.tareConfirmTimeoutMs
        repeat: false
        onTriggered: {
            Log.logFreePour("tare_timed_out", { runId: screen.runId, stage: taringStage, weight_g: Format.roundTo(screen.weight) })
            screen.setupStatus = "tare-timeout"
        }
    }

    // ---- gestures
    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onClick: screen.handleClick()
        onDoubleClick: {
            Log.logFreePour(screen.stage === "result" ? "exited" : "aborted", { runId: screen.runId, source: "double_press", stage: screen.stage })
            Nav.setBubbleDisplay({ visible: false, component: "" })
            Nav.setScreen("profileHome")
        }
        onContext: Log.logFreePour("context_opened", { runId: screen.runId, stage: screen.stage })
        onTurnLeft: screen.handleTurn("left")
        onTurnRight: screen.handleTurn("right")
    }

    function handleClick() {
        const currentStage = stage
        const currentWeight = weight
        const currentSetupStatus = setupStatus
        Log.logFreePour("click_received", { runId: runId, stage: currentStage, setup_status: currentSetupStatus,
                                           stable: stable, weight_g: Format.roundTo(currentWeight) })

        if (isSetupStage(currentStage)) {
            if (currentSetupStatus === "tare-timeout") {
                setupStatus = "taring"
                Backend.action("tare")
                Log.logFreePour("tare_retried", { runId: runId, stage: currentStage })
                return
            }
            if (currentSetupStatus !== "idle") {
                Log.logFreePour("click_ignored", { runId: runId, stage: currentStage, reason: currentSetupStatus })
                return
            }
            if (!Setup.canRecordSetupWeight({ stage: currentStage, weight: currentWeight, stable: stable, status: currentSetupStatus })) {
                Log.logFreePour("click_rejected", { runId: runId, stage: currentStage, reason: stable ? "weight_out_of_range" : "weight_unstable",
                                                   weight_g: Format.roundTo(currentWeight) })
                return
            }
            r.setupCaptureWeight = currentWeight
            setupStatus = "saving"
            Log.logFreePour("weight_save_requested", { runId: runId, stage: currentStage, stable: stable, weight_g: Format.roundTo(currentWeight) })
            return
        }
        if (currentStage === "setup-review") {
            const reviewStages = r.completedSetupStages
            if (setupReviewCursor >= reviewStages.length) {
                Log.logFreePour("setup_review_closed", { runId: runId, to: r.setupReviewReturnStage })
                updateStage(r.setupReviewReturnStage)
                return
            }
            restartSetupForCorrection(reviewStages[setupReviewCursor])
            return
        }
        if (currentStage === "temperature") {
            Log.logFreePour("temperature_confirmed", { runId: runId, temperature_c: temperatureC, profile_target_c: profile ? profile.temperatureC : null })
            updateStage("server")
            return
        }
        if (currentStage === "pouring" || currentStage === "waiting") {
            r.completion = "dial_fallback"
            updateStage("finish-requested")
            return
        }
        if (currentStage === "replace-server") {
            Log.logFreePour("brew_weight_skipped", { runId: runId })
            createSession(null)
            return
        }
        if (currentStage === "result") {
            Log.logFreePour("review_opened", { runId: runId })
            Nav.setScreen("freePourHistory")
            return
        }
        Log.logFreePour("click_ignored", { runId: runId, stage: currentStage, reason: "no_action_for_stage" })
    }

    function handleTurn(direction) {
        const currentStage = stage
        if (currentStage === "temperature") {
            temperatureC = direction === "left" ? Math.max(Defaults.MIN_FREE_POUR_TEMPERATURE_C, temperatureC - 1)
                                                : Math.min(Defaults.MAX_FREE_POUR_TEMPERATURE_C, temperatureC + 1)
            return
        }
        if (currentStage === "setup-review") {
            setupReviewCursor = direction === "left" ? Math.max(0, setupReviewCursor - 1)
                                                     : Math.min(r.completedSetupStages.length, setupReviewCursor + 1)
            return
        }
        if (currentStage === "brewer" || currentStage === "coffee" || currentStage === "ready")
            enterSetupReview(currentStage, direction === "left" ? "backward" : "forward")
    }

    // ---- what the render computes
    readonly property int step: stepForStage(stage)
    readonly property real liveFlow: Math.max(0, gravimetricFlow)
    readonly property int roundedWeight: Math.max(0, Math.round(weight))
    readonly property bool liveState: stage === "ready" || stage === "pouring" || stage === "waiting"
    readonly property int expectedPourCount: profile ? profile.pourTargets.length : maxPours
    readonly property int currentTargetNumber: activePourView ? activePourView.number : Math.min(pours.length + 1, expectedPourCount + 1)
    readonly property var activeTarget: profile ? (profile.pourTargets.find(target => target.number === currentTargetNumber) || null) : null
    readonly property int activeTargetNumber: activeTarget ? activeTarget.number : -1
    readonly property var targetRemainingMs: activeTarget ? activeTarget.startTimeMs - elapsedMs : null
    readonly property string pourCue: stage === "waiting" && targetRemainingMs !== null
                                      ? (targetRemainingMs <= 0 ? "due" : targetRemainingMs <= 5000 ? "countdown" : "idle")
                                      : "idle"
    readonly property string statusLabel: stage === "ready" ? "READY"
                                        : stage === "pouring" ? "POUR " + (activePourView ? activePourView.number : 1) + (profile ? " OF " + expectedPourCount : "")
                                        : stage === "waiting" ? (pours.length >= expectedPourCount ? "DRAWDOWN" : "WAITING")
                                        : ""
    // Read on every render from the refs.
    readonly property var setupReviewStages: stage === "setup-review" && r ? r.completedSetupStages : []
    readonly property var reviewedSetupStage: setupReviewStages[setupReviewCursor] !== undefined ? setupReviewStages[setupReviewCursor] : null
    readonly property var reviewedSetupWeight: reviewedSetupStage === "server" ? r.serverWeight
                                             : reviewedSetupStage === "brewer" ? r.brewerWeight
                                             : reviewedSetupStage === "coffee" ? doseG : null
    readonly property string setupReviewReturnStage: stage === "setup-review" && r ? r.setupReviewReturnStage : "ready"

    // ---- the views (one per stage, as the React component returns)
    Loader {
        anchors.fill: parent
        active: screen.stage === "temperature"
        sourceComponent: temperatureView
    }
    Loader {
        anchors.fill: parent
        active: screen.isSetupStage(screen.stage)
        sourceComponent: setupView
    }
    Loader {
        anchors.fill: parent
        active: screen.stage === "setup-review"
        sourceComponent: reviewView
    }
    Loader {
        anchors.fill: parent
        active: screen.liveState
        sourceComponent: liveView
    }
    Loader {
        anchors.fill: parent
        active: screen.stage === "finish-requested" || screen.stage === "measuring" || screen.stage === "replace-server"
        sourceComponent: messageView
    }
    Loader {
        anchors.fill: parent
        active: screen.stage === "result"
        sourceComponent: resultView
    }

    // .free-pour-temperature-screen: kicker (-54), value (+25, 104 px), "rotate" (+25), centered.
    Component {
        id: temperatureView
        Item {
            readonly property var tops: Css.flexColumnTops(480, [[-54, 18 * Css.DIATYPE_NORMAL], [25, 104], [25, 13]])
            StepLabel { text: "1 OF 8" }
            FpText {
                y: parent.tops[0]
                cssWeight: 600
                font.pixelSize: 18
                font.letterSpacing: 3
                color: screen.muted
                text: "WATER TEMPERATURE"
            }
            Item {
                y: parent.tops[1]
                width: 480
                height: 104
                readonly property real total: tempValue.implicitWidth + 8 + tempUnit.implicitWidth
                FpText {
                    id: tempValue
                    x: 240 - parent.total / 2
                    width: implicitWidth
                    mono: true
                    cssWeight: 300
                    font.pixelSize: 104
                    lineHeightPx: 104
                    font.letterSpacing: -8
                    text: String(screen.temperatureC)
                }
                FpText {
                    id: tempUnit
                    x: tempValue.x + tempValue.implicitWidth + 8
                    width: implicitWidth
                    mono: true
                    cssWeight: 300
                    font.pixelSize: 35
                    lineHeightPx: 35
                    font.letterSpacing: -2
                    color: screen.muted
                    // the span's baseline on the line's
                    y: tempValue.baselineOffset - baselineOffset
                    text: "°C"
                }
            }
            FpText {
                y: parent.tops[2]
                mono: true
                font.pixelSize: 13
                font.letterSpacing: 2
                color: screen.muted
                text: "ROTATE DIAL TO ADJUST"
            }
            FpText {
                y: 480 - 84 - lineHeightPx
                cssWeight: 650
                font.pixelSize: 16
                font.letterSpacing: 1.5
                text: "PRESS DIAL TO CONTINUE"
            }
            AbortHint {}
        }
    }

    // .free-pour-setup-screen: server / brewer / coffee.
    Component {
        id: setupView
        Item {
            id: setup
            readonly property string kind: screen.stage
            readonly property bool ready: kind === "server" ? screen.serverReady : kind === "brewer" ? screen.brewerReady : screen.coffeeReady
            readonly property var tops: Css.flexColumnTops(480, [[-42, 18 * Css.DIATYPE_NORMAL], [17, 104], [18, readiness.height]])
            readonly property var actionLines: screen.setupStatus === "saving" ? [["SAVING WEIGHT", true]]
                                             : screen.setupStatus === "taring" ? [["TARING…", true]]
                                             : screen.setupStatus === "tare-timeout" ? [["PRESS DIAL TO RETRY", true]]
                                             : [["PRESS DIAL TO RECORD", false],
                                                [(kind === "server" ? "SERVER" : kind === "brewer" ? "BREWER" : "COFFEE") + " WEIGHT + TARE", true]]

            StepLabel { text: setup.kind === "server" ? "2 OF 8" : setup.kind === "brewer" ? "3 OF 8" : "4 OF 8" }
            FpText {
                y: setup.tops[0]
                cssWeight: 600
                font.pixelSize: 18
                font.letterSpacing: 3
                color: screen.muted
                text: setup.kind === "server" ? "WEIGH EMPTY SERVER" : setup.kind === "brewer" ? "ADD BREWER" : "ADD COFFEE"
            }
            FpText {
                y: setup.tops[1]
                mono: true
                cssWeight: 300
                font.pixelSize: 104
                lineHeightPx: 104
                font.letterSpacing: -8
                text: Math.round(setup.kind === "brewer" ? Setup.normalizeBrewerWeight(screen.weight) : screen.weight) + "g"
            }
            Readiness {
                id: readiness
                y: setup.tops[2]
                ready: setup.ready
                status: screen.setupStatus
                waitingMessage: setup.kind === "server" ? "WAIT FOR A STABLE WEIGHT"
                              : setup.kind === "brewer" ? (screen.weight < Setup.SETUP_LOAD_CHANGE_G ? "ADD BREWER OR LEAVE AT 0g · WAIT FOR STABLE WEIGHT"
                                                                                                    : "WAIT FOR A STABLE WEIGHT")
                              : screen.weight < 5 ? "ADD 5–40g COFFEE · WAIT FOR STABLE WEIGHT"
                              : screen.weight > 40 ? "DOSE MUST BE 5–40g" : "WAIT FOR A STABLE WEIGHT"
                readyMessage: setup.kind === "brewer" && Setup.isZeroBrewerWeight(screen.weight) ? "0g BREWER · PRESS DIAL TO RECORD"
                            : setup.kind === "coffee" && screen.profile ? "WEIGHT STABLE · TARGET " + Math.round(screen.profile.doseG) + "g · PRESS TO RECORD"
                            : "WEIGHT STABLE · PRESS DIAL TO RECORD"
            }
            // .free-pour-dose-action: 84 px from the bottom, 16 px lines of 1.42.
            Item {
                width: 480
                height: setup.actionLines.length * 16 * 1.42
                y: 480 - 84 - height
                opacity: setup.kind !== "server" && screen.setupStatus === "idle" && !setup.ready ? 0.38 : 1
                Repeater {
                    model: setup.actionLines.length
                    FpText {
                        required property int index
                        y: index * 16 * 1.42
                        lineHeightPx: 16 * 1.42
                        cssWeight: setup.actionLines[index][1] ? 700 : 400
                        font.pixelSize: 16
                        font.letterSpacing: 1.4
                        text: setup.actionLines[index][0]
                    }
                }
            }
            AbortHint {}
        }
    }

    // .free-pour-setup-review-screen
    Component {
        id: reviewView
        Item {
            id: review
            readonly property bool recorded: screen.reviewedSetupStage !== null
            readonly property real mainLineHeight: 31 * 1.15
            readonly property var tops: recorded
                ? Css.flexColumnTops(480, [[-64, 18 * Css.DIATYPE_NORMAL], [19, 96], [19, 2 * 11 * 1.5]])
                : Css.flexColumnTops(480, [[-64, 18 * Css.DIATYPE_NORMAL], [44, Math.max(1, mainText.lineCount) * mainLineHeight]])

            StepLabel { text: "SETUP REVIEW" }
            FpText {
                y: review.tops[0]
                cssWeight: 600
                font.pixelSize: 18
                font.letterSpacing: 3
                color: screen.muted
                text: review.recorded ? String(screen.reviewedSetupStage).toUpperCase() + " WEIGHT" : "CONTINUE SETUP"
            }
            FpText {
                visible: review.recorded
                y: review.tops[1]
                mono: true
                cssWeight: 300
                font.pixelSize: 96
                lineHeightPx: 96
                font.letterSpacing: -7
                text: Math.round(screen.reviewedSetupWeight === null ? 0 : screen.reviewedSetupWeight) + "g"
            }
            Repeater {
                model: review.recorded ? ["RE-ENTERING RESTARTS FROM THE EMPTY SERVER", "SO EVERY TARE REMAINS ACCURATE"] : []
                FpText {
                    required property int index
                    required property string modelData
                    y: review.tops[2] + index * 16.5
                    lineHeightPx: 16.5
                    mono: true
                    cssWeight: 650
                    font.pixelSize: 11
                    font.letterSpacing: 1.2
                    color: "#f5dc91"
                    text: modelData
                }
            }
            Text {
                id: mainText
                visible: !review.recorded
                x: 60
                y: review.recorded ? 0 : review.tops[1]
                width: 360
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                lineHeightMode: Text.FixedHeight
                lineHeight: review.mainLineHeight
                color: screen.white
                font.family: Theme.fontRegular
                font.weight: Css.weight(650)
                font.pixelSize: 31
                font.letterSpacing: 1.4
                // half-leading: Qt puts each fixed-height line's ascent at its top
                topPadding: (review.mainLineHeight - 31 * Css.DIATYPE_NORMAL) / 2
                text: screen.setupReviewReturnStage === "ready" ? "RETURN TO BREW" : "RETURN TO " + screen.setupReviewReturnStage.toUpperCase()
            }
            FpText {
                y: 480 - 112 - lineHeightPx
                mono: true
                font.pixelSize: 11
                font.letterSpacing: 1.25
                color: screen.muted
                text: "TURN DIAL BACK OR FORWARD TO REVIEW"
            }
            FpText {
                y: 480 - 82 - lineHeightPx
                cssWeight: 650
                font.pixelSize: 14
                font.letterSpacing: 1.35
                text: review.recorded ? "PRESS DIAL TO RE-ENTER THIS WEIGHT" : "PRESS DIAL TO CONTINUE"
            }
            AbortHint {}
        }
    }

    // .free-pour-live-screen: ready, pouring, waiting
    Component {
        id: liveView
        Item {
            id: live
            StepLabel { text: screen.step + " OF 8" }
            FpText {
                y: 53
                cssWeight: 600
                font.pixelSize: 16
                font.letterSpacing: 2.7
                color: screen.muted
                text: screen.profile ? screen.profile.name : "FREE POUR"
            }
            FpText {
                y: 72
                mono: true
                cssWeight: 300
                font.pixelSize: 81
                lineHeightPx: 81
                font.letterSpacing: -5
                text: Format.formatBrewTime(screen.elapsedMs)
            }
            FpText {
                y: 157
                cssWeight: 650
                font.pixelSize: 15
                font.letterSpacing: 3
                text: screen.statusLabel
            }
            Loader {
                active: !!screen.profile
                sourceComponent: TargetPourRail {
                    targets: screen.profile.pourTargets
                    currentPour: screen.currentTargetNumber
                    pouring: screen.stage === "pouring"
                    cue: screen.pourCue
                }
            }
            Loader {
                active: !screen.profile
                sourceComponent: PourRail {
                    pours: screen.pours
                    activePour: screen.activePourView
                    waiting: screen.stage === "ready" || screen.stage === "waiting"
                }
            }
            // .free-pour-profile-weight: CURRENT → STOP, a 143 / 34 / 143 px grid aligned to the bottom.
            Item {
                visible: !!(screen.profile && screen.activeTarget)
                x: 80
                y: 238
                width: 320
                height: 11 * Css.DIATYPE_NORMAL + 5 + 51
                Repeater {
                    model: [["CURRENT", 0], ["STOP", 177]]
                    Item {
                        required property var modelData
                        x: modelData[1]
                        width: 143
                        height: parent.height
                        FpText {
                            cssWeight: 600
                            font.pixelSize: 11
                            font.letterSpacing: 2
                            color: screen.muted
                            text: parent.modelData[0]
                        }
                        FpText {
                            y: 11 * Css.DIATYPE_NORMAL + 5
                            mono: true
                            cssWeight: 300
                            font.pixelSize: 51
                            lineHeightPx: 51
                            font.letterSpacing: -4
                            text: parent.modelData[0] === "CURRENT" ? screen.roundedWeight + "g"
                                : (screen.activeTarget ? Math.round(screen.activeTarget.stopWeightG) + "g" : "")
                        }
                    }
                }
                FpText {
                    x: 143
                    y: parent.height - 7 - 25
                    width: 34
                    mono: true
                    font.pixelSize: 25
                    color: screen.muted
                    text: "→"
                }
            }
            FpText {
                visible: !(screen.profile && screen.activeTarget)
                y: 238
                mono: true
                cssWeight: 300
                font.pixelSize: 77
                lineHeightPx: 77
                font.letterSpacing: -5
                text: screen.roundedWeight + "g"
            }
            // .free-pour-live-feedback: 72 px tall from 325, its content centered.
            FlowMeter {
                visible: screen.stage === "pouring"
                x: 91
                y: 325 + (72 - height) / 2
                flow: screen.liveFlow
                target: screen.activeTarget ? screen.activeTarget.flowGps : undefined
            }
            Item {
                id: instruction
                visible: screen.stage !== "pouring"
                readonly property var lines: {
                    if (screen.stage === "ready") return [["START POURING", false], ["TURN DIAL TO REVIEW WEIGHTS", true]]
                    const first = screen.activeTarget ? "NEXT POUR · START " + Format.formatBrewTime(screen.activeTarget.startTimeMs)
                                : screen.profile ? "DRAWDOWN · TARGET " + Format.formatBrewTime(screen.profile.targetDurationMs)
                                : screen.pours.length < screen.maxPours ? "POUR AGAIN OR" : ""
                    return (first ? [[first, false]] : []).concat([["LIFT BREWER TO FINISH", true]])
                }
                width: 480
                height: lines.length * 14 * 1.35
                y: 325 + (72 - height) / 2
                Repeater {
                    model: instruction.lines.length
                    FpText {
                        required property int index
                        y: index * 14 * 1.35
                        lineHeightPx: 14 * 1.35
                        cssWeight: instruction.lines[index][1] ? 750 : 550
                        font.pixelSize: 14
                        font.letterSpacing: 1.4
                        text: instruction.lines[index][0]
                    }
                }
            }
            AbortHint {}
        }
    }

    // .free-pour-message-screen: finish-requested, measuring, replace-server
    Component {
        id: messageView
        Item {
            id: message
            readonly property var mainLines: screen.stage === "measuring" ? ["MEASURING", "BREW WEIGHT"]
                                           : screen.stage === "replace-server" ? ["SERVER REMOVED"]
                                           : screen.timeLimitReached ? ["10:00 LIMIT REACHED", "RECORDING ENDED"] : ["LIFT BREWER"]
            readonly property var subLines: screen.stage === "replace-server" ? ["PUT BACK SERVER ONLY", "WE’LL MEASURE AUTOMATICALLY"]
                                          : screen.stage === "finish-requested" && screen.timeLimitReached ? ["LIFT BREWER", "KEEP SERVER ON SCALE"]
                                          : ["KEEP SERVER ON SCALE"]
            readonly property real mainLineHeight: 32 * 1.18
            readonly property real subLineHeight: 16 * 1.5
            readonly property var tops: Css.flexColumnTops(480, [[-20, mainLines.length * mainLineHeight], [22, subLines.length * subLineHeight]])

            StepLabel { text: "7 OF 8" }
            Repeater {
                model: message.mainLines.length
                FpText {
                    required property int index
                    y: message.tops[0] + index * message.mainLineHeight
                    lineHeightPx: message.mainLineHeight
                    cssWeight: 650
                    font.pixelSize: 32
                    font.letterSpacing: 1
                    text: message.mainLines[index]
                }
            }
            Repeater {
                model: message.subLines.length
                FpText {
                    required property int index
                    y: message.tops[1] + index * message.subLineHeight
                    lineHeightPx: message.subLineHeight
                    cssWeight: 550
                    font.pixelSize: 16
                    font.letterSpacing: 1.7
                    color: screen.muted
                    text: message.subLines[index]
                }
            }
            FpText {
                visible: screen.stage === "measuring"
                y: 480 - 88 - lineHeightPx
                mono: true
                font.pixelSize: 13
                font.letterSpacing: 2
                color: screen.muted
                text: "WEIGHT STABILIZING"
            }
            FpText {
                visible: screen.stage === "replace-server"
                y: 480 - 80 - lineHeightPx
                font.pixelSize: 12
                font.letterSpacing: 1.2
                color: screen.muted
                text: "BEVERAGE MUST REMAIN · PRESS TO SKIP"
            }
            AbortHint {}
        }
    }

    // .free-pour-result-screen
    Component {
        id: resultView
        Item {
            id: resultItem
            readonly property var measurements: screen.result ? screen.result.measurements : null
            readonly property var beverage: measurements ? measurements.beverageG : undefined
            readonly property real statsHeight: 11 * Css.DIATYPE_NORMAL + 4 + 25
            readonly property var tops: Css.flexColumnTops(480, [[-61, 18 * Css.DIATYPE_NORMAL], [10, 94], [0, 14 * Css.DIATYPE_NORMAL], [28, statsHeight]])

            StepLabel { text: "8 OF 8" }
            FpText {
                y: resultItem.tops[0]
                cssWeight: 600
                font.pixelSize: 18
                font.letterSpacing: 3
                color: screen.muted
                text: "FREE POUR COMPLETE"
            }
            FpText {
                y: resultItem.tops[1]
                mono: true
                cssWeight: 300
                font.pixelSize: 94
                lineHeightPx: 94
                font.letterSpacing: -7
                text: resultItem.beverage === null || resultItem.beverage === undefined ? "—" : Math.round(resultItem.beverage) + "g"
            }
            FpText {
                y: resultItem.tops[2]
                font.pixelSize: 14
                font.letterSpacing: 3
                color: screen.muted
                text: "BREWED"
            }
            // three 110.67 px columns, 14 px apart, in 360 px
            Repeater {
                model: 3
                Item {
                    required property int index
                    readonly property real columnWidth: (360 - 28) / 3
                    x: 60 + index * (columnWidth + 14)
                    y: resultItem.tops[3]
                    width: columnWidth
                    height: resultItem.statsHeight
                    FpText {
                        font.pixelSize: 11
                        font.letterSpacing: 1.5
                        color: screen.muted
                        text: ["WATER POURED", "RETAINED", "TOTAL TIME"][parent.index]
                    }
                    FpText {
                        y: 11 * Css.DIATYPE_NORMAL + 4
                        mono: true
                        font.pixelSize: 25
                        lineHeightPx: 25
                        text: {
                            const m = resultItem.measurements
                            if (parent.index === 0) return Math.round(m ? m.waterPouredG : 0) + "g"
                            if (parent.index === 1) return !m || m.retainedG === null || m.retainedG === undefined ? "—" : Math.round(m.retainedG) + "g"
                            return Format.formatBrewTime(m ? m.durationMs : 0)
                        }
                    }
                }
            }
            FpText {
                y: 480 - 84 - lineHeightPx
                cssWeight: 650
                font.pixelSize: 17
                font.letterSpacing: 1.6
                text: "PRESS TO REVIEW"
            }
        }
    }
}
