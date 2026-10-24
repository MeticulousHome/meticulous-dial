.pragma library
// src/features/freePour/setupFlow.ts
// SetupStage: server | brewer | coffee; SetupStatus: idle | saving | taring | tare-timeout

// Setup loads only need to clear scale noise. A just-tared zero represents an
// integrated brewer; otherwise require a meaningful load change.
const SETUP_LOAD_CHANGE_G = 1.2
const SETUP_ZERO_WEIGHT_TOLERANCE_G = 0.6

function isZeroBrewerWeight(weight) {
    return Number.isFinite(weight) && Math.abs(weight) <= SETUP_ZERO_WEIGHT_TOLERANCE_G
}

function normalizeBrewerWeight(weight) {
    return isZeroBrewerWeight(weight) ? 0 : weight
}

function isValidSetupWeight(stage, weight) {
    if (!Number.isFinite(weight)) return false
    if (stage === "server") return true
    if (stage === "brewer") return isZeroBrewerWeight(weight) || weight >= SETUP_LOAD_CHANGE_G
    return weight >= 5 && weight <= 40
}

// canRecordSetupWeight({ stage, weight, stable, status })
function canRecordSetupWeight(o) {
    return o.status === "idle" && o.stable && isValidSetupWeight(o.stage, o.weight)
}

function nextStageAfterTare(stage) {
    if (stage === "server") return "brewer"
    if (stage === "brewer") return "coffee"
    return "ready"
}
