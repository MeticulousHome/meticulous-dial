.pragma library
// src/features/freePour/profileApi.ts: the installed Pour Over profiles on the machine. `api` is the Api
// singleton (a library has no QML context). The list itself, with its refetch and the delete, lives in
// Profiles (Core): Profiles.pourOverProfiles, refetchPourOver(), deletePourOverProfile(), pourOverImageUrl().
.import "ProfileContract.js" as Contract

const POUR_OVER_PROFILES_QUERY_KEY = "pour-over-profiles"
const REQUEST_TIMEOUT_MS = 5000

function getPourOverProfileImageUrl(api, profileId) {
    return api.base + "/api/v1/pour-over/profile/image/" + encodeURIComponent(profileId)
}

// fetch with a 5 s abort: resolves with the parsed body, rejects with an Error carrying the machine's
// message (or "Machine returned <status>").
function request(api, method, path) {
    return api.request(method, path, null, { timeout: REQUEST_TIMEOUT_MS }).catch(error => {
        if (error && error.status === 0 && /timeout/.test(String(error.message)))
            throw new Error("Machine profile request timed out")
        const body = error ? error.data : null
        const message = body && typeof body.error === "string" ? body.error
                      : "Machine returned " + (error && error.status !== undefined ? error.status : 0)
        throw new Error(message)
    })
}

function parseInstalledProfile(value) {
    const result = Contract.parsePourOverProfile(value)
    if (result.success === true) return result.dialProfile
    const profileId = value && typeof value === "object" && "id" in value
                    ? String(value.id === null || value.id === undefined ? "" : value.id) : ""
    console.error("Rejected installed Pour Over profile " + (profileId || "<unknown>"), JSON.stringify(result.issues))
    return null
}

function getInstalledPourOverProfiles(api) {
    return request(api, "GET", "/api/v1/pour-over/profile/list").then(body => {
        if (!body || !Array.isArray(body.profiles)) throw new Error("Machine returned an invalid Pour Over profile list")
        return body.profiles.map(parseInstalledProfile).filter(profile => profile !== null)
    })
}

function getInstalledPourOverProfile(api, profileId) {
    return request(api, "GET", "/api/v1/pour-over/profile/get/" + encodeURIComponent(profileId) + "?include_image=false")
        .then(body => {
            const profile = parseInstalledProfile(body)
            if (!profile) throw new Error("Machine returned an invalid Pour Over profile")
            return profile
        })
}

function deleteInstalledPourOverProfile(api, profileId) {
    return request(api, "DELETE", "/api/v1/pour-over/profile/delete/" + encodeURIComponent(profileId)).then(() => undefined)
}
