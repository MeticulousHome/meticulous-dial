.pragma library
// src/constants/setting.ts and src/constants/manualMode.ts

// When the stage changes to one of these, the barometer is not shown.
const HIDDEN_STAGES = [
    "idle",
    "boot",
    "END_STAGE",
    "starting...",
    // The profile engine publishes its 'finished' label for a few milliseconds after the purge, before
    // 'idle'. It must not change screens, otherwise the brew complete screen is unmounted.
    "finished"
]

// Status names the firmware owns. A status outside this list while `extracting` is a user-defined stage
// of the loaded profile.
const MACHINE_OWNED_STAGES = [
    "heating", "click to start", "retracting", "closing valve", "purge", "remove cup", "click to purge",
    "Pour water and click to continue", "starting...", "home", "boot", "idle", "END_STAGE", "finished"
]

// The backend seeds and owns the single "Manual mode" profile; the dial mirrors only its id. A brew is
// recognised as manual by `profile.manual === true` and never by this id.
const MANUAL_MODE_PROFILE_ID = "4d616e75-616c-4d6f-8465-000000000001"

// A final_weight at or above this means "no weight stop" (the schema's maximum).
const MANUAL_WEIGHT_DISABLED = 2000

const MANUAL_TARGET_COLORS = { pressure: "#F5C444", flow: "#78D6FF" }

const DEFAULT_SETTING = [
    { type: "action", key: "brew_once", label: "brew without saving" },
    { type: "action", key: "save", label: "save" },
    { type: "action", key: "discard", label: "discard" }
]
const TEMPORARY_SETTINGS = [
    { type: "action", key: "brew_once", label: "brew without saving" },
    { type: "action", key: "save", label: "save permanently" },
    { type: "action", key: "discard", label: "discard" }
]

function isBrewComplete(state) { return state === "remove cup" || state === "click to purge" }
