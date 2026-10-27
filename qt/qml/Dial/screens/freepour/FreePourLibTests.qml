// The cases of tests/freePourSetup.test.mts and tests/pourOverProfileContract.test.ts against this
// directory's JS libraries, plus the pour detector and the brew weight filter, run in the Dial's own engine:
// qt/tests/e2e/test_freepour.py creates this object through the test port and calls run(), which answers
// JSON { passed, failures: [message] }.
import QtQuick
import "SetupFlow.js" as Setup
import "Format.js" as Format
import "ProfileContract.js" as Contract
import "PourDetector.js" as Detector
import "BrewWeightFilter.js" as Filter
import "ProfileEvents.js" as Events

QtObject {
    property var failures: []
    property int passed: 0

    function check(condition, message) {
        if (condition) passed++
        else failures.push(message)
    }
    function equal(actual, expected, message) {
        const a = JSON.stringify(actual), e = JSON.stringify(expected)
        check(a === e, (message || "") + ": expected " + e + ", got " + a)
    }
    function clone(value) { return JSON.parse(JSON.stringify(value)) }

    function setupFlow() {
        equal(Format.formatBrewTime(195000), "3:15", "formatBrewTime")
        equal(Format.formatClockTime(42000), "42s", "formatClockTime under a minute")
        equal(Format.formatClockTime(65000), "1:05", "formatClockTime")
        equal(Setup.canRecordSetupWeight({ stage: "server", weight: 312, stable: false, status: "idle" }), false,
              "an unstable scale must not arm a delayed capture")
        equal(Setup.canRecordSetupWeight({ stage: "server", weight: 312, stable: true, status: "idle" }), true, "server capture")
        equal(Setup.isValidSetupWeight("brewer", 0), true, "brewer 0")
        equal(Setup.isValidSetupWeight("brewer", -0.6), true, "brewer -0.6")
        equal(Setup.isValidSetupWeight("brewer", 0.6), true, "brewer 0.6")
        equal(Setup.isValidSetupWeight("brewer", -0.7), false, "brewer -0.7")
        equal(Setup.isValidSetupWeight("brewer", 0.8), false, "brewer 0.8")
        equal(Setup.isValidSetupWeight("brewer", 1.2), true, "brewer 1.2")
        equal(Setup.isValidSetupWeight("brewer", NaN), false, "brewer NaN")
        equal(Setup.isValidSetupWeight("brewer", Infinity), false, "brewer Infinity")
        equal(Setup.normalizeBrewerWeight(0.4), 0, "normalize 0.4")
        equal(Setup.normalizeBrewerWeight(-0.6), 0, "normalize -0.6")
        equal(Setup.normalizeBrewerWeight(40), 40, "normalize 40")
        equal(Setup.canRecordSetupWeight({ stage: "brewer", weight: 0, stable: true, status: "idle" }), true,
              "a stable zero reading must support an integrated brewer such as a Chemex")
        equal(Setup.canRecordSetupWeight({ stage: "brewer", weight: 0, stable: false, status: "idle" }), false,
              "zero brewer capture must still wait for a stable scale")
        equal(Setup.canRecordSetupWeight({ stage: "server", weight: 312, stable: true, status: "taring" }), false,
              "no capture while taring")
        equal(Setup.isValidSetupWeight("coffee", 4.9), false, "coffee 4.9")
        equal(Setup.isValidSetupWeight("coffee", 18), true, "coffee 18")
        equal(Setup.isValidSetupWeight("coffee", 40.1), false, "coffee 40.1")
        equal(Setup.nextStageAfterTare("server"), "brewer", "after server")
        equal(Setup.nextStageAfterTare("brewer"), "coffee", "after brewer")
        equal(Setup.nextStageAfterTare("coffee"), "ready", "after coffee")
    }

    readonly property var validProfile: ({
        version: 1,
        brew_type: "pour_over",
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Two Pour V60",
        author: "Meticulous",
        author_id: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
        display: { accentColor: "#315566", shortDescription: "A simple two-pour recipe.", description: "Bloom, wait, then complete the brew." },
        recipe: { coffee_dose_g: 15, total_water_g: 250, water_temperature_c: 92, target_total_time_s: 180,
                  target_total_time_max_s: 210, brewer: { name: "V60", size: "02" }, grind: { description: "Medium-fine" } },
        stages: [
            { key: "bloom", name: "Bloom", starts_at_s: 0,
              pour: { water_g: 50, duration_s: 10, target_cumulative_water_g: 50, flow_rate_g_s: 5, flow_range_g_s: [4, 6], pattern: "spiral_out" } },
            { key: "main", name: "Main pour", starts_at_s: 45,
              pour: { water_g: 200, duration_s: 40, target_cumulative_water_g: 250, flow_rate_g_s: 5, pattern: "center" } }
        ]
    })

    function contract() {
        const parsed = Contract.parsePourOverProfile(clone(validProfile))
        equal(parsed.success, true, "the valid profile parses")
        if (parsed.success) {
            equal(parsed.dialProfile.doseG, 15, "doseG")
            equal(parsed.dialProfile.targetWaterG, 250, "targetWaterG")
            equal(parsed.dialProfile.targetDurationMs, 180000, "targetDurationMs")
            equal(parsed.dialProfile.pourTargets, [
                { number: 1, startTimeMs: 0, stopWeightG: 50, flowGps: 5, flowRangeGps: [4, 6] },
                { number: 2, startTimeMs: 45000, stopWeightG: 250, flowGps: 5 }
            ], "pourTargets")
        }
        const mutations = [
            ["dose below 5 g", p => { p.recipe.coffee_dose_g = 4 }],
            ["temperature below 70", p => { p.recipe.water_temperature_c = 69 }],
            ["first pour not at 0 s", p => { p.stages[0].starts_at_s = 1 }],
            ["overlapping pours", p => { p.stages[1].starts_at_s = 5 }],
            ["cumulative water off", p => { p.stages[1].pour.target_cumulative_water_g = 249 }],
            ["flow not water / duration", p => { p.stages[1].pour.flow_rate_g_s = 20 }],
            ["unknown field", p => { p.surprise = true }],
            ["external image", p => { p.display.image = "https://example.com/profile.jpg" }],
            ["non-finite water", p => { p.recipe.total_water_g = Infinity }],
            ["six pours", p => { while (p.stages.length < 6) p.stages.push(clone(p.stages[1])) }],
            ["bad uuid", p => { p.id = "not-a-uuid" }],
            ["bad accent color", p => { p.display.accentColor = "blue" }],
            ["duplicate keys", p => { p.stages[1].key = "bloom" }],
            ["flow target outside its range", p => { p.stages[0].pour.flow_range_g_s = [6, 8] }],
            ["max time before target", p => { p.recipe.target_total_time_max_s = 100 }],
            ["not an object", p => null]
        ]
        for (const [name, mutate] of mutations) {
            let invalid = clone(validProfile)
            const replaced = mutate(invalid)
            if (replaced === null) invalid = "a string"
            equal(Contract.parsePourOverProfile(invalid).success, false, "rejects: " + name)
        }
        const result = Contract.parsePourOverProfile(Object.assign(clone(validProfile), { surprise: true }))
        equal(result.issues && result.issues[0] && result.issues[0].code, "additional_property", "issue code")
        let threw = false
        try { Contract.assertPourOverProfile({}) } catch (e) { threw = e.message === "Invalid Pour Over profile" && Array.isArray(e.issues) }
        check(threw, "assertPourOverProfile throws with the issues")
        equal(Events.isPourOverProfileEvent({ brew_type: "pour_over", change: "create" }), true, "pour-over event")
        equal(Events.isPourOverProfileEvent({ change: "create" }), false, "espresso event")
        equal(Events.isPourOverProfileEvent(null), false, "no event")
    }

    function detector() {
        // A steady 10 g/s pour, sampled every 100 ms: confirmed after a second, backdated to its first rise,
        // and ended 950 ms after the flow stops.
        const d = new Detector.PourDetector()
        let start = null, end = null
        let w = 0
        for (let t = 0; t <= 8000; t += 100) {
            if (t >= 1000 && t < 4000) w += 1
            const e = d.process({ timeMs: t, weightG: w, flowGps: t >= 1000 && t < 4000 ? 10 : 0 })
            if (e && e.type === "pour-start") start = e.sample
            if (e && e.type === "pour-end") end = e.sample
        }
        check(start !== null, "a steady pour starts")
        // the first rise shows at 1000 ms: the pour starts at the settled sample before it
        equal(start ? start.timeMs : null, 900, "the start is backdated to the last settled sample")
        check(end !== null && end.timeMs === 4000, "the pour ends where the flow stopped: " + JSON.stringify(end))
        // A knock: a spike that comes back is not a pour.
        const k = new Detector.PourDetector()
        let knocked = false
        const knock = [0, 0, 3, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        knock.forEach((value, i) => { const e = k.process({ timeMs: i * 100, weightG: value, flowGps: value ? 8 : 0 }); if (e) knocked = true })
        equal(knocked, false, "a knock is not a pour")
        equal(Detector.resolvedPourEndWeight(10, 30, 11), null, "movement without retained water rolls back")
        equal(Detector.resolvedPourEndWeight(10, 30, 25), 25, "the settled weight wins over the peak")
        equal(Detector.resolvedPourEndWeight(10, 30), 30, "no settled weight: the peak")
        equal(Detector.plausiblePeakFlow(20), 0, "an implausible flow")
        equal(Detector.plausiblePeakFlow(7.5), 7.5, "a plausible flow")
    }

    function weightFilter() {
        equal(Filter.brewerRemovalThreshold(115), 115 * 0.55, "threshold of a 115 g setup")
        equal(Filter.brewerRemovalThreshold(10), 28, "threshold floor")
        equal(Filter.classifyBrewWeightCandidate(95, 115, 250), { type: "plausible", beverageG: 210 }, "plausible beverage")
        equal(Filter.classifyBrewWeightCandidate(-415, 115, 250).type, "server-missing", "server lifted too")
        equal(Filter.classifyBrewWeightCandidate(250, 115, 250).type, "setup-still-on-scale", "brewer still on")
        equal(Filter.updatePlausiblePeakWeight(100, 150, 100), 101.5, "a spike rises at 15 g/s at most")
        equal(Filter.updatePlausiblePeakWeight(100, 90, 100), 100, "the peak never falls")
        equal(Filter.updatePlausiblePeakWeight(100, 200, 1000), 103.75, "the elapsed time is bounded to 250 ms")
        const c = new Filter.BrewerRemovalConfirmation()
        equal(c.update(false, 0, 100).type, "idle", "idle")
        equal(c.update(true, 0, 50).type, "started", "started")
        equal(c.update(true, 1000, 50.5).type, "pending", "pending")
        equal(c.update(true, 3000, 50.2).type, "confirmed", "confirmed after 3 s of a stable drop")
        const d = new Filter.BrewerRemovalConfirmation()
        d.update(true, 0, 50)
        equal(d.update(false, 500, 100).type, "cancelled", "cancelled when the weight returns")
        const e = new Filter.BrewerRemovalConfirmation()
        e.update(true, 0, 50)
        e.update(true, 2800, 60)
        equal(e.update(true, 3000, 60).type, "pending", "a moving scale is not stable yet")
        equal(e.update(true, 3500, 60).type, "confirmed", "stable for 700 ms")
    }

    function run() {
        failures = []
        passed = 0
        const suites = [["setupFlow", setupFlow], ["contract", contract], ["detector", detector], ["weightFilter", weightFilter]]
        for (const [name, suite] of suites) {
            try { suite() } catch (error) { failures.push(name + " threw: " + error) }
        }
        return JSON.stringify({ passed: passed, failures: failures })
    }
}
