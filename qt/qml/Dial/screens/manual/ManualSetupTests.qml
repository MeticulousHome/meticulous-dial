// The cases of tests/manualSetup.test.mts against ManualSetup.js, run in the Dial's own engine:
// qt/tests/e2e/test_freepour.py creates this object through the test port and calls run(), which answers
// JSON { passed, failures: [message] }.
import QtQuick
import "ManualSetup.js" as M

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
    function expectThrow(fn, message) {
        let threw = false
        try { fn() } catch (e) { threw = true }
        check(threw, message)
    }
    function saved() {
        return Object.assign(M.defaultManualProfile(), { name: "Manual mode", temperature: 92, final_weight: 36,
                                                          display: { image: "manual.png", accentColor: "#F5C444" } })
    }

    function cases() {
        // the default document is the seeded manual profile
        const profile = M.defaultManualProfile()
        equal(profile.id, M.MANUAL_MODE_PROFILE_ID, "id")
        equal(profile.id, "4d616e75-616c-4d6f-8465-000000000001", "the backend's id")
        equal(profile.name, "Manual mode", "name")
        equal(profile.author, "Meticulous", "author")
        equal(profile.author_id, "00000000-0000-0000-0000-000000000000", "author_id")
        equal(profile.previous_authors, [], "previous_authors")
        equal(profile.temperature, 90, "temperature")
        equal(profile.final_weight, M.MANUAL_WEIGHT_DISABLED, "final_weight")
        equal(profile.variables, [], "variables")
        equal(profile.display, {}, "display")
        equal(profile.manual, true, "manual")
        equal(profile.stages, [
            { name: "Manual pressure", key: "manual_pressure", type: "pressure",
              dynamics: { points: [[0, 0]], over: "time", interpolation: "none" },
              exit_triggers: [{ type: "user_interaction", value: 1 }], limits: [] },
            { name: "Manual flow", key: "manual_flow", type: "flow",
              dynamics: { points: [[0, 0]], over: "time", interpolation: "none" },
              exit_triggers: [{ type: "user_interaction", value: 1 }], limits: [] }
        ], "stages")

        // the default document is a fresh object each time
        const first = M.defaultManualProfile()
        first.stages[0].name = "edited"
        equal(M.defaultManualProfile().stages[0].name, "Manual pressure", "fresh default")

        // orderStagesForStart puts the chosen control first
        const stages = M.defaultManualProfile().stages
        equal(M.orderStagesForStart(stages, "pressure").map(s => s.type), ["pressure", "flow"], "pressure first")
        equal(M.orderStagesForStart(stages, "flow").map(s => s.type), ["flow", "pressure"], "flow first")
        // ... and reorders a document saved the other way round
        const flowFirst = M.orderStagesForStart(stages, "flow")
        equal(M.orderStagesForStart(flowFirst, "pressure").map(s => s.key), ["manual_pressure", "manual_flow"], "reorder")
        // ... and rejects anything that is not the manual pair
        expectThrow(() => M.orderStagesForStart([], "pressure"), "rejects no stages")
        expectThrow(() => M.orderStagesForStart([stages[0]], "pressure"), "rejects one stage")
        expectThrow(() => M.orderStagesForStart([stages[0], stages[0]], "pressure"), "rejects two pressure stages")
        expectThrow(() => M.orderStagesForStart(stages.concat([stages[1]]), "flow"), "rejects three stages")

        // startControlOf reads the saved stage order
        equal(M.startControlOf(profile), "pressure", "startControlOf pressure")
        equal(M.startControlOf(Object.assign({}, profile, { stages: M.orderStagesForStart(profile.stages, "flow") })), "flow", "startControlOf flow")

        // applyManualSetup writes the three answers and keeps everything else
        const s = saved()
        const applied = M.applyManualSetup(s, { temperature: 94.5, finalWeight: 42, start: "flow" })
        equal(applied.temperature, 94.5, "applied temperature")
        equal(applied.final_weight, 42, "applied final_weight")
        equal(applied.manual, true, "applied manual")
        equal(applied.stages.map(x => x.key), ["manual_flow", "manual_pressure"], "applied order")
        equal(applied.id, M.MANUAL_MODE_PROFILE_ID, "applied id")
        equal(applied.name, s.name, "applied name")
        equal(applied.author, s.author, "applied author")
        equal(applied.display, s.display, "applied display")
        equal(applied.stages[0].dynamics, { points: [[0, 0]], over: "time", interpolation: "none" }, "applied dynamics")
        equal(applied.stages[0].exit_triggers, [{ type: "user_interaction", value: 1 }], "applied exit triggers")

        // applyManualSetup does not mutate the profile it was given
        const untouched = saved()
        M.applyManualSetup(untouched, { temperature: 88, finalWeight: M.MANUAL_WEIGHT_DISABLED, start: "flow" })
        equal(untouched.temperature, 92, "no mutation: temperature")
        equal(untouched.final_weight, 36, "no mutation: final_weight")
        equal(untouched.stages.map(x => x.key), ["manual_pressure", "manual_flow"], "no mutation: stages")

        // applyManualSetup keeps manual true even on a document that lost it
        const withoutManual = saved()
        delete withoutManual.manual
        equal(M.applyManualSetup(withoutManual, { temperature: 90, finalWeight: 36, start: "pressure" }).manual, true, "manual restored")

        // the disabled-weight sentinel is the schema maximum of 2000 g
        equal(M.MANUAL_WEIGHT_DISABLED, 2000, "sentinel")
        equal(M.isWeightDisabled(2000), true, "2000 disabled")
        equal(M.isWeightDisabled(1999.5), false, "1999.5 enabled")
        equal(M.isWeightDisabled(2001), true, "2001 disabled")
        equal(M.isWeightDisabled(36), false, "36 enabled")
        equal(M.isWeightDisabled(0), false, "0 enabled")

        // outputStepHint
        equal(M.outputStepHint(M.MANUAL_WEIGHT_DISABLED), "Rotate knob to set weight", "hint while off")
        equal(M.outputStepHint(36), "Long press disables the final weight", "hint at 36")
        equal(M.outputStepHint(0), "Long press disables the final weight", "hint at 0")

        // nextWeight steps by half a gram inside the gauge
        equal(M.nextWeight(36, 36, "right"), 36.5, "36 right")
        equal(M.nextWeight(36, 36, "left"), 35.5, "36 left")
        equal(M.nextWeight(36.3, 36.3, "right"), 36.8, "36.3 right")
        // ... stops at the ends of the gauge
        equal(M.nextWeight(M.MANUAL_WEIGHT_MAX, 36, "right"), M.MANUAL_WEIGHT_MAX, "max")
        equal(M.nextWeight(M.MANUAL_WEIGHT_MIN, 36, "left"), M.MANUAL_WEIGHT_MIN, "min")
        equal(M.nextWeight(0.4, 36, "left"), M.MANUAL_WEIGHT_MIN, "0.4 left")
        // ... returns a disabled weight to where the user left it
        equal(M.nextWeight(M.MANUAL_WEIGHT_DISABLED, 42, "right"), 42, "resume 42 right")
        equal(M.nextWeight(M.MANUAL_WEIGHT_DISABLED, 42, "left"), 42, "resume 42 left")
        equal(M.nextWeight(M.MANUAL_WEIGHT_DISABLED, null, "right"), M.MANUAL_WEIGHT_RESUME, "resume default")
        equal(M.nextWeight(M.MANUAL_WEIGHT_DISABLED, undefined, "left"), M.MANUAL_WEIGHT_RESUME, "resume default (undefined)")
        equal(M.nextWeight(M.MANUAL_WEIGHT_DISABLED, 4000, "right"), M.MANUAL_WEIGHT_MAX, "resume clamped")

        // nextTemperature steps by half a degree and stops at the ends
        equal(M.nextTemperature(90, "right"), 90.5, "90 right")
        equal(M.nextTemperature(90, "left"), 89.5, "90 left")
        equal(M.nextTemperature(M.MANUAL_TEMPERATURE_MAX, "right"), M.MANUAL_TEMPERATURE_MAX, "max temperature")
        equal(M.nextTemperature(0, "left"), 0, "min temperature")
    }

    function run() {
        failures = []
        passed = 0
        try { cases() } catch (error) { failures.push("threw: " + error) }
        return JSON.stringify({ passed: passed, failures: failures })
    }
}
