.pragma library
// src/features/freePour/setupFlow.ts
// SetupStage: server | brewer | coffee; SetupStatus: idle | saving | taring | tare-timeout

// Setup loads only need to clear scale noise. A just-tared zero represents an
// integrated brewer; otherwise require a meaningful load change.
const SETUP_LOAD_CHANGE_G = 1.2
const SETUP_ZERO_WEIGHT_TOLERANCE_G = 0.6
const PRE_GRIND_DOSE_TOLERANCE_G = 0.5

function hasDosingCup(weight) {
    return Number.isFinite(weight) && weight >= SETUP_LOAD_CHANGE_G
}

function dosingCupWasRemoved(weight) {
    return Number.isFinite(weight) && weight <= -SETUP_LOAD_CHANGE_G
}

function isTargetBeanDose(weight, targetDose) {
    return Number.isFinite(weight) && Number.isFinite(targetDose)
        && targetDose >= 5 && targetDose <= 40
        && Math.abs(weight - targetDose) <= PRE_GRIND_DOSE_TOLERANCE_G
}

function canTareDosingCup(o) {
    return o.status === "idle" && o.stable && hasDosingCup(o.weight)
}

function canRecordBeanDose(o) {
    return o.status === "idle" && o.stable && isTargetBeanDose(o.weight, o.targetDose)
}

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
