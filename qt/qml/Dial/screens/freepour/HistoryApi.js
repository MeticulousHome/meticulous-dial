.pragma library
// src/features/freePour/historyApi.ts: the backend's Pour Over history. `api` is the Api singleton.
// PourOverHistoryMetadata: { id, file, completedAt, ... }; the save answers { status: created | existing, history }.

const HISTORY_REQUEST_TIMEOUT_MS = 10000

// apiError: "<the body's error, or the fallback> (<status>)"
function apiError(error, fallback) {
    let message = fallback
    const body = error ? error.data : null
    if (body && typeof body === "object" && body.error) message = body.error
    return new Error(message + " (" + (error && error.status !== undefined ? error.status : 0) + ")")
}

function historyRequest(api, method, path, body) {
    return api.request(method, path, body === undefined ? null : body, { timeout: HISTORY_REQUEST_TIMEOUT_MS, withStatus: true })
}

function persistFreePourSession(api, session) {
    return historyRequest(api, "POST", "/api/v1/history/pour-over", session)
        .then(answer => answer.data, error => { throw apiError(error, "Could not save Pour Over history") })
}

function fetchBackendSession(api, metadata) {
    const encodedPath = String(metadata.file).split("/").map(segment => encodeURIComponent(segment)).join("/")
    return historyRequest(api, "GET", "/api/v1/history/pour-over/files/" + encodedPath)
        .then(answer => answer.data, error => { throw apiError(error, "Could not read Pour Over record") })
}

// The newest Pour Over brew the backend holds, or null when it has none (404).
function getLatestBackendFreePourSession(api) {
    return historyRequest(api, "GET", "/api/v1/history/pour-over/last").then(
        answer => fetchBackendSession(api, answer.data),
        error => {
            if (error && error.status === 404) return null
            throw apiError(error, "Could not read Pour Over history")
        })
}
