.pragma library
// src/features/freePour/logging.ts: one JSON line per event, "[FreePour] {...}", into the journal (console.*
// reaches it through the host's message handler).

function serializeError(error) {
    if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack }
    // Api rejections are { status, data, message }: keep their message, as String(error) would not.
    if (error && typeof error === "object" && typeof error.message === "string")
        return { message: error.message }
    return { message: String(error) }
}

function logFreePour(event, details) {
    console.info("[FreePour] " + JSON.stringify(Object.assign({ event: event }, details || {})))
}

function logFreePourError(event, error, details) {
    console.error("[FreePour] " + JSON.stringify(Object.assign({ event: event }, details || {}, { error: serializeError(error) })))
}
