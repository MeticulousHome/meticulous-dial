.pragma library
// src/features/freePour/profileContract.ts: the portable Pour Over profile (version 1) as the Dial checks it
// at the display boundary, and its Dial shape (PourOverProfile: { id, name, author, display, doseG,
// temperatureC, targetWaterG, targetDurationMs, pourTargets: [{ number, startTimeMs, stopWeightG, flowGps,
// flowRangeGps? }] }).
//
// parsePourOverProfile(value) -> { success: true, profile, dialProfile } | { success: false, issues }
// (issue: { path, message, code }). Profiles.parsePourOverProfile is the hook the installed-profile list
// uses: main.qml installs this function there.

const POUR_OVER_PROFILE_SCHEMA_VERSION = 1

// The name of the TypeScript type, which tests/pourOverProfileContract.test.ts imports as a value
// (qt/tests/js runs that test against this file).
const PortablePourOverProfile = null

function issue(path, message, code) {
    return { path: path, message: message, code: code }
}

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function allowedKeys(value, allowed, path, issues) {
    for (const key of Object.keys(value)) {
        if (allowed.indexOf(key) < 0) issues.push(issue(path.concat([key]), "Unknown profile field", "additional_property"))
    }
}

function requiredString(value, path, issues, maximumLength, uuid) {
    if (typeof value !== "string" || value.length < 1 || value.length > maximumLength || (uuid && !UUID_PATTERN.test(value)))
        issues.push(issue(path, "Invalid text value", "schema"))
}

function requiredNumber(value, path, issues, minimum, maximum, exclusiveMinimum) {
    if (typeof value !== "number" || !Number.isFinite(value)
            || (exclusiveMinimum ? value <= minimum : value < minimum) || value > maximum)
        issues.push(issue(path, "Invalid numeric value", "schema"))
}

// Lightweight defense at the display boundary. The backend owns the complete JSON Schema validation before
// persistence; repeating the full schema in the Dial costs memory and creates a second contract that can
// drift.
function structuralIssues(value) {
    const issues = []
    if (!isRecord(value)) return [issue([], "Profile must be an object", "schema")]

    allowedKeys(value, ["version", "brew_type", "id", "name", "author", "author_id", "previous_authors",
                        "display", "recipe", "stages"], [], issues)
    if (value.version !== POUR_OVER_PROFILE_SCHEMA_VERSION)
        issues.push(issue(["version"], "Unsupported profile version", "schema"))
    if (value.brew_type !== "pour_over")
        issues.push(issue(["brew_type"], "Unsupported brew type", "schema"))
    requiredString(value.id, ["id"], issues, 36, true)
    requiredString(value.name, ["name"], issues, 120)
    requiredString(value.author, ["author"], issues, 120)
    requiredString(value.author_id, ["author_id"], issues, 36, true)

    if (value.display !== undefined) {
        if (!isRecord(value.display)) {
            issues.push(issue(["display"], "Display must be an object", "schema"))
        } else {
            allowedKeys(value.display, ["image", "accentColor", "shortDescription", "description"], ["display"], issues)
            const displayLimits = [["image", 410000], ["accentColor", 7], ["shortDescription", 100], ["description", 500]]
            for (const [key, limit] of displayLimits) {
                if (value.display[key] !== undefined) requiredString(value.display[key], ["display", key], issues, limit)
            }
            if (typeof value.display.image === "string" && !value.display.image.startsWith("data:image/jpeg;base64,"))
                issues.push(issue(["display", "image"], "Image must be an embedded JPEG", "schema"))
            if (typeof value.display.accentColor === "string" && !/^#[0-9a-f]{6}$/i.test(value.display.accentColor))
                issues.push(issue(["display", "accentColor"], "Invalid accent color", "schema"))
        }
    }

    if (!isRecord(value.recipe)) {
        issues.push(issue(["recipe"], "Recipe must be an object", "schema"))
    } else {
        allowedKeys(value.recipe, ["coffee_dose_g", "total_water_g", "water_temperature_c", "target_total_time_s",
                                   "target_total_time_max_s", "brewer", "filter", "grind", "water", "preparation"],
                    ["recipe"], issues)
        requiredNumber(value.recipe.coffee_dose_g, ["recipe", "coffee_dose_g"], issues, 5, 40)
        requiredNumber(value.recipe.total_water_g, ["recipe", "total_water_g"], issues, 0, 2000, true)
        requiredNumber(value.recipe.water_temperature_c, ["recipe", "water_temperature_c"], issues, 70, 100)
        requiredNumber(value.recipe.target_total_time_s, ["recipe", "target_total_time_s"], issues, 0, 600, true)
        if (value.recipe.target_total_time_max_s !== undefined)
            requiredNumber(value.recipe.target_total_time_max_s, ["recipe", "target_total_time_max_s"], issues, 0, 600, true)
    }

    if (!Array.isArray(value.stages) || value.stages.length < 1 || value.stages.length > 5) {
        issues.push(issue(["stages"], "Profiles require one to five pours", "schema"))
    } else {
        value.stages.forEach((stageValue, index) => {
            const stagePath = ["stages", index]
            if (!isRecord(stageValue)) {
                issues.push(issue(stagePath, "Pour must be an object", "schema"))
                return
            }
            allowedKeys(stageValue, ["key", "name", "starts_at_s", "temperature_c", "pour", "note"], stagePath, issues)
            requiredString(stageValue.key, stagePath.concat(["key"]), issues, 80)
            requiredString(stageValue.name, stagePath.concat(["name"]), issues, 80)
            requiredNumber(stageValue.starts_at_s, stagePath.concat(["starts_at_s"]), issues, 0, 600)
            if (!isRecord(stageValue.pour)) {
                issues.push(issue(stagePath.concat(["pour"]), "Pour guidance is required", "schema"))
                return
            }
            allowedKeys(stageValue.pour, ["water_g", "duration_s", "target_cumulative_water_g", "flow_rate_g_s",
                                          "flow_range_g_s", "pattern", "direction", "height_cm"],
                        stagePath.concat(["pour"]), issues)
            for (const key of ["water_g", "duration_s", "target_cumulative_water_g", "flow_rate_g_s"]) {
                requiredNumber(stageValue.pour[key], stagePath.concat(["pour", key]), issues, 0,
                               key === "flow_rate_g_s" ? 100 : key === "duration_s" ? 600 : 2000, true)
            }
            const range = stageValue.pour.flow_range_g_s
            if (range !== undefined) {
                if (!Array.isArray(range) || range.length !== 2) {
                    issues.push(issue(stagePath.concat(["pour", "flow_range_g_s"]), "Flow range requires two numbers", "schema"))
                } else {
                    requiredNumber(range[0], stagePath.concat(["pour", "flow_range_g_s", 0]), issues, 0, 100)
                    requiredNumber(range[1], stagePath.concat(["pour", "flow_range_g_s", 1]), issues, 0, 100, true)
                }
            }
        })
    }
    return issues
}

function semanticIssues(profile) {
    const issues = []
    if (!profile.name.trim()) issues.push(issue(["name"], "Text cannot be blank", "blank"))
    if (!profile.author.trim()) issues.push(issue(["author"], "Text cannot be blank", "blank"))

    const maximumTime = profile.recipe.target_total_time_max_s
    if (maximumTime !== undefined && maximumTime < profile.recipe.target_total_time_s)
        issues.push(issue(["recipe", "target_total_time_max_s"],
                          "Upper target time cannot be earlier than the target time", "time_range"))

    const keys = []
    let cumulativeWater = 0
    let previousEnd = 0
    profile.stages.forEach((stage, index) => {
        if (!stage.key.trim()) issues.push(issue(["stages", index, "key"], "Key cannot be blank", "blank"))
        if (!stage.name.trim()) issues.push(issue(["stages", index, "name"], "Name cannot be blank", "blank"))
        if (keys.indexOf(stage.key) >= 0)
            issues.push(issue(["stages", index, "key"], "Stage keys must be unique", "duplicate"))
        keys.push(stage.key)

        if (index === 0 && stage.starts_at_s !== 0)
            issues.push(issue(["stages", index, "starts_at_s"], "The first pour must start at 0 seconds", "first_start"))
        if (index > 0 && stage.starts_at_s + 0.001 < previousEnd)
            issues.push(issue(["stages", index, "starts_at_s"], "A pour cannot start before the previous pour ends", "overlap"))

        cumulativeWater += stage.pour.water_g
        const expectedFlow = stage.pour.water_g / stage.pour.duration_s
        const flowTolerance = Math.max(0.1, expectedFlow * 0.02)
        if (Math.abs(stage.pour.flow_rate_g_s - expectedFlow) > flowTolerance)
            issues.push(issue(["stages", index, "pour", "flow_rate_g_s"],
                              "Flow must equal water divided by duration (" + expectedFlow.toFixed(2) + " g/s)",
                              "flow_consistency"))
        if (Math.abs(stage.pour.target_cumulative_water_g - cumulativeWater) > 0.1)
            issues.push(issue(["stages", index, "pour", "target_cumulative_water_g"],
                              "Cumulative target must be " + cumulativeWater.toFixed(1) + " g", "water_consistency"))
        const flowRange = stage.pour.flow_range_g_s
        if (flowRange) {
            if (flowRange[0] > flowRange[1])
                issues.push(issue(["stages", index, "pour", "flow_range_g_s"], "Flow range must be ordered", "flow_range"))
            else if (stage.pour.flow_rate_g_s < flowRange[0] || stage.pour.flow_rate_g_s > flowRange[1])
                issues.push(issue(["stages", index, "pour", "flow_range_g_s"],
                                  "Flow target must sit inside the flow range", "flow_range"))
        }
        previousEnd = stage.starts_at_s + stage.pour.duration_s
    })

    if (Math.abs(cumulativeWater - profile.recipe.total_water_g) > 0.1)
        issues.push(issue(["recipe", "total_water_g"],
                          "Total water must equal the " + cumulativeWater.toFixed(1) + " g across all pours",
                          "water_consistency"))
    if (previousEnd > profile.recipe.target_total_time_s + 0.001)
        issues.push(issue(["recipe", "target_total_time_s"], "Target brew time cannot end before the final pour",
                          "time_consistency"))
    return issues
}

function toDialPourOverProfile(profile) {
    return {
        id: profile.id,
        name: profile.name,
        author: profile.author,
        display: profile.display,
        doseG: profile.recipe.coffee_dose_g,
        temperatureC: profile.recipe.water_temperature_c,
        targetWaterG: profile.recipe.total_water_g,
        targetDurationMs: Math.round(profile.recipe.target_total_time_s * 1000),
        pourTargets: profile.stages.map((stage, index) => {
            const target = {
                number: index + 1,
                startTimeMs: Math.round(stage.starts_at_s * 1000),
                stopWeightG: stage.pour.target_cumulative_water_g,
                flowGps: stage.pour.flow_rate_g_s
            }
            return stage.pour.flow_range_g_s === null || stage.pour.flow_range_g_s === undefined
                ? target : Object.assign({}, target, { flowRangeGps: stage.pour.flow_range_g_s })
        })
    }
}

function parsePourOverProfile(value) {
    const structure = structuralIssues(value)
    if (structure.length) return { success: false, issues: structure }
    const issues = semanticIssues(value)
    if (issues.length) return { success: false, issues: issues }
    return { success: true, profile: value, dialProfile: toDialPourOverProfile(value) }
}

function assertPourOverProfile(value) {
    const result = parsePourOverProfile(value)
    if (result.success === true) return result.profile
    const error = new Error("Invalid Pour Over profile")
    error.issues = result.issues
    throw error
}
