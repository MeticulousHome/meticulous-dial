.pragma library
// What "Pair a device" (PairDevice.qml) shows for each answer of POST /api/v1/auth/pairing?mode=new, kept
// out of the QML so it can be tested (qt/tests/js/pairing.test.mts). The backend's device authorization
// contract: a code is 8 Crockford base32 characters (no I, L, O or U), shown as ABCD-EFGH, valid for
// `expires_in` seconds; `pair_url` is what the QR code carries. A backend without device authorization
// answers 404.
//
// States: "loading" (asking for a code), "ready" (QR code and countdown), "expired", "failed" (no answer
// or an answer we cannot use) and "unsupported" (the backend has no pairing).

const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const CODE_LENGTH = 8

const UNSUPPORTED_TEXT = "This machine's software does not support pairing yet"
const FAILED_TEXT = "Could not create a pairing code"
const EXPIRED_TEXT = "This pairing code expired"
const LOADING_TEXT = "Creating a pairing code..."

function isCode(code) {
    if (typeof code !== "string" || code.length !== CODE_LENGTH) return false
    for (let i = 0; i < code.length; i++) {
        if (CODE_ALPHABET.indexOf(code[i]) < 0) return false
    }
    return true
}

// "ABCDEFGH" -> "ABCD-EFGH", the way every client shows a code so it is easy to read out and type.
function displayCode(code) {
    if (!isCode(code)) return ""
    return code.slice(0, 4) + "-" + code.slice(4)
}

// Whole seconds left of a code valid `expiresIn` s, `elapsedMs` after it arrived. Rounded up, so the
// countdown reads 10:00 when the code arrives and the code expires when it reaches 0:00.
function secondsLeft(expiresIn, elapsedMs) {
    const total = Number(expiresIn)
    const elapsed = Number(elapsedMs)
    if (!isFinite(total) || total <= 0) return 0
    const left = Math.ceil((total * 1000 - Math.max(0, isFinite(elapsed) ? elapsed : 0)) / 1000)
    return Math.max(0, left)
}

// 125 -> "2:05".
function countdownText(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0))
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0")
}

// The screen's state from a 2xx answer: { state: "ready", code, pairUrl, expiresIn } when it holds a code,
// a pair URL and a lifetime, else { state: "failed" }.
function fromAnswer(data) {
    if (!data || typeof data !== "object") return { state: "failed" }
    const code = data.code
    const pairUrl = data.pair_url
    const expiresIn = Number(data.expires_in)
    if (!isCode(code) || typeof pairUrl !== "string" || pairUrl.length === 0 || !isFinite(expiresIn) || expiresIn <= 0)
        return { state: "failed" }
    return { state: "ready", code: code, pairUrl: pairUrl, expiresIn: expiresIn }
}

// The screen's state from a rejected call (Api.qml's { status, data, message }; status 0 is no answer).
function fromError(error) {
    return { state: error && error.status === 404 ? "unsupported" : "failed" }
}

// A ready code turns expired when its countdown reaches zero.
function afterTick(state, left) {
    return state === "ready" && left <= 0 ? "expired" : state
}

// The pills under the code: another code only makes sense after one expired or could not be made.
function actions(state) {
    return state === "expired" || state === "failed" ? ["New code", "Back"] : ["Back"]
}

// The text in place of the QR code, for every state but "ready".
function placeholderText(state) {
    switch (state) {
    case "unsupported": return UNSUPPORTED_TEXT
    case "failed": return FAILED_TEXT
    case "expired": return EXPIRED_TEXT
    case "loading": return LOADING_TEXT
    }
    return ""
}

// The line under the code (ready) or the placeholder (the others).
function hintText(state, left) {
    switch (state) {
    case "ready": return "Expires in " + countdownText(left)
    case "expired":
    case "failed": return "Choose New code to try again."
    case "loading": return "Keep this screen open."
    }
    return ""
}
