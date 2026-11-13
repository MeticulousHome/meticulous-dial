.pragma library
// src/components/ManualModeSetup/manualSetup.ts: the pure editing rules of the manual profile.
//
// The setup flow only ever changes three things on the seeded document - the temperature, the final weight
// and which of the two stages the shot starts in - and everything else has to survive the round trip
// untouched, because the backend converts that same document into the node program the machine runs.
// ManualSetup: { temperature, finalWeight, start: "pressure" | "flow" }
// Self-contained (qt/tests/js loads it alone): the two constants of src/constants/manualMode.ts are
// repeated here with the values Core/Constants.js has.

// The backend seeds and owns the single "Manual mode" profile; the dial mirrors only its id.
const MANUAL_MODE_PROFILE_ID = "4d616e75-616c-4d6f-8465-000000000001"
// A final_weight at or above this is "no weight stop" (the profile schema's maximum).
const MANUAL_WEIGHT_DISABLED = 2000

const MANUAL_TEMPERATURE_MIN = 0
const MANUAL_TEMPERATURE_MAX = 99
const MANUAL_TEMPERATURE_STEP = 0.5
const MANUAL_TEMPERATURE_DEFAULT = 90

const MANUAL_WEIGHT_MIN = 0
const MANUAL_WEIGHT_MAX = 100
const MANUAL_WEIGHT_STEP = 0.5

// Where the gauge resumes when a disabled weight is turned back on.
const MANUAL_WEIGHT_RESUME = 36

function round1(value) { return Math.round(value * 10) / 10 }

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)) }

// final_weight >= 2000 is the "no weight stop" convention: the machine can never reach it, so the shot ends
// on the long press instead.
function isWeightDisabled(value) { return value >= MANUAL_WEIGHT_DISABLED }

function nextTemperature(current, direction) {
    return clamp(round1(current + (direction === "left" ? -MANUAL_TEMPERATURE_STEP : MANUAL_TEMPERATURE_STEP)),
                 MANUAL_TEMPERATURE_MIN, MANUAL_TEMPERATURE_MAX)
}

// Steps the final weight. A disabled weight sits far outside the 0-100 gauge, so the first detent out of
// `Off` puts the gauge back where the user left it rather than one step below an unreachable 2000 g;
// further detents step from there.
function nextWeight(current, previousEnabled, direction) {
    if (isWeightDisabled(current)) {
        const resume = previousEnabled === null || previousEnabled === undefined ? MANUAL_WEIGHT_RESUME : previousEnabled
        return clamp(round1(resume), MANUAL_WEIGHT_MIN, MANUAL_WEIGHT_MAX)
    }
    return clamp(round1(current + (direction === "left" ? -MANUAL_WEIGHT_STEP : MANUAL_WEIGHT_STEP)),
                 MANUAL_WEIGHT_MIN, MANUAL_WEIGHT_MAX)
}

// Line 1 of the output step's legend: what the knob does from here. While the weight is off the gauge is
// not on screen at all, so the long-press hint would point at nothing - say how to bring the weight back.
function outputStepHint(finalWeight) {
    return isWeightDisabled(finalWeight) ? "Rotate knob to set weight" : "Long press disables the final weight"
}

// Puts the stage the shot starts in first. The order in the array is the answer to "start on pressure or
// flow": the backend reads stages[0] as the first stage of the program. Throws when the document is not the
// manual pair, because reordering anything else would silently produce a profile the backend cannot convert.
function orderStagesForStart(stages, start) {
    const list = stages || []
    const pressure = list.filter(stage => stage.type === "pressure")
    const flow = list.filter(stage => stage.type === "flow")
    if (list.length !== 2 || pressure.length !== 1 || flow.length !== 1)
        throw new Error("A manual profile must hold exactly one pressure stage and one flow stage")
    return start === "flow" ? [flow[0], pressure[0]] : [pressure[0], flow[0]]
}

// The control the saved document starts in, for pre-selecting the choice.
function startControlOf(profile) {
    return profile && profile.stages && profile.stages[0] && profile.stages[0].type === "flow" ? "flow" : "pressure"
}

// Applies the three answers to the profile, leaving every other field - id, name, authors, display, the
// stages' dynamics, exit triggers and limits - as it was, and keeping manual: true so the backend still
// converts it into the manual node program.
function applyManualSetup(profile, setup) {
    return Object.assign({}, profile, {
        temperature: setup.temperature,
        final_weight: setup.finalWeight,
        manual: true,
        stages: orderStagesForStart(profile ? profile.stages : undefined, setup.start)
    })
}

// The seeded document, used when the machine has no manual profile yet (the GET answers 404). It mirrors
// the backend's own seed so the first save writes the profile the backend would have written.
function defaultManualProfile() {
    return {
        id: MANUAL_MODE_PROFILE_ID,
        name: "Manual mode",
        author: "Meticulous",
        author_id: "00000000-0000-0000-0000-000000000000",
        previous_authors: [],
        temperature: MANUAL_TEMPERATURE_DEFAULT,
        final_weight: MANUAL_WEIGHT_DISABLED,
        variables: [],
        display: {},
        manual: true,
        stages: [
            {
                name: "Manual pressure",
                key: "manual_pressure",
                type: "pressure",
                dynamics: { points: [[0, 0]], over: "time", interpolation: "none" },
                exit_triggers: [{ type: "user_interaction", value: 1 }],
                limits: []
            },
            {
                name: "Manual flow",
                key: "manual_flow",
                type: "flow",
                dynamics: { points: [[0, 0]], over: "time", interpolation: "none" },
                exit_triggers: [{ type: "user_interaction", value: 1 }],
                limits: []
            }
        ]
    }
}
