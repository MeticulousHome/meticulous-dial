.pragma library
// The pure parts of the React Dial's bug report (src/components/BugReport/reportSubmission.ts,
// reportHandoff.ts, contactEmailEdit.ts, dispatchedReports.ts' outcome text, the issue date helpers of
// BugReport.tsx and the address helpers of ReportContactEmail.tsx), and the @meticulous-home/espresso-api
// 0.15 error helpers. Shared module state (.pragma library): the hand-off of a collection run and of the
// contact email decision across the bubble closing for the contact email screen, as in React.

// ---- reportSubmission.ts

// Every failure the user can land on gets a stable code, so support can map the short on-screen message
// back to the stage that actually failed.
var FAILURE_DETAILS = {
    creation: { code: "BR-01", message: "We could not collect the information needed for your report." },
    reportLoad: { code: "BR-02", message: "We could not prepare your report for sending." },
    TicketTrackRequest: { code: "BR-03", message: "We could not get a tracking number for your report." },
    reportUpdate: { code: "BR-04", message: "We could not link the tracking number to your report." },
    sentrySubmission: { code: "BR-05", message: "We could not send your report." },
    submissionMark: { code: "BR-06", message: "We could not update your reports record." },
    submissionTimeout: { code: "BR-07", message: "Sending your report took too long and was cancelled." },
    noSerial: { code: "BR-08", message: "This machine has no serial number, so a report cannot be filed." },
    offline: { code: "BR-09", message: "No internet connection. Connect to Wi-Fi or report from the mobile app." },
    diskSpace: { code: "BR-10", message: "Not enough free space on the machine to collect a report." },
    busy: { code: "BR-11", message: "Another report is being collected. Try again in a few minutes." }
}

var BLOCKER_FAILURE = {
    NO_SERIAL_NUMBER: "noSerial",
    NETWORK_UNREACHABLE: "offline",
    INSUFFICIENT_DISK_SPACE: "diskSpace",
    COLLECTION_IN_PROGRESS: "busy"
}

var CREATE_ERROR_FAILURE = {
    INSUFFICIENT_DISK_SPACE: "diskSpace",
    COLLECTION_IN_PROGRESS: "busy"
}

var SENTRY_DELIVERY_TIMEOUT_MS = 30 * 1000
var RETRY_DELAYS_MS = [2000, 5000, 10000]

function failureView(type, note) {
    var d = FAILURE_DETAILS[type]
    return { code: d.code, message: d.message, note: note }
}

function getContentType(filename) {
    if (filename.endsWith(".json")) return "application/json"
    if (filename.endsWith(".zst")) return "application/zstd"
    if (filename.endsWith(".txt") || filename.endsWith(".log")) return "text/plain"
    if (filename.endsWith(".csv")) return "text/csv"
    return "application/octet-stream"
}

function isReportError(response) {
    return typeof response === "object" && response !== null && !(response instanceof Uint8Array)
        && "error" in response && typeof response.error === "string"
}

function isOfflineError(error) {
    return error instanceof Error && /Network Error|timeout|ERR_NETWORK|ECONN|ENOTFOUND/i.test(error.message)
}

function getTicketEventID(draftInfo) {
    var machineID = draftInfo.machineID ? String(draftInfo.machineID).trim() : ""
    var localID = draftInfo.localID ? String(draftInfo.localID).trim() : ""
    if (!machineID || !localID) throw new Error("Draft info is missing machineID or localID")
    return machineID + "-" + localID
}

function buildDraftAttachment(draftFile) {
    var name = "bug-report-information.tar.zst"
    return { name: name, data: draftFile, contentType: getContentType(name) }
}

function shortTag(value) { return String(value).slice(0, 200) }

function reportInfoTags(reportInfo) {
    var scalars = ["localID", "machineID", "ticket", "issueTime", "dateAndTime", "eventID", "baseEventID"]
    var tags = {}
    scalars.forEach(function (key) {
        if (reportInfo && reportInfo[key] !== null && reportInfo[key] !== undefined) tags[key] = shortTag(reportInfo[key])
    })
    return tags
}

// ---- espresso-api: report calls resolve with the body or an APIError, never throw

var REPORT_ERROR_CODES = ["INVALID_BODY", "INVALID_LOCAL_ID", "UNKNOWN_LOCAL_ID", "FORBIDDEN_UPDATE",
                          "COLLECTION_IN_PROGRESS", "INSUFFICIENT_DISK_SPACE", "DUPLICATE_LOCAL_ID", "INTERNAL"]
var REPORT_INFO_KEYS = ["description", "dateAndTime", "issueTime", "attachments", "multimedia", "machineID",
                        "eventID", "baseEventID", "ticket", "localID"]

function isObject(value) { return typeof value === "object" && value !== null && !Array.isArray(value) }
function isAPIError(value) { return isObject(value) && typeof value.error === "string" }

function getReportErrorCode(value) {
    if (!isAPIError(value)) return undefined
    var code = value.data ? value.data.code : undefined
    return typeof code === "string" && REPORT_ERROR_CODES.indexOf(code) >= 0 ? code : undefined
}

function parseAPIError(value, description, data) {
    if (isAPIError(value)) return value
    var error = { error: "Request failed", description: description ? description : "" }
    if (typeof value === "string" && value.length > 0) error.error = value
    else error.data = { value: value }
    if (data) error.data = error.data ? Object.assign({}, error.data, { data: data }) : data
    return error
}

// The patch of updateReport keeps only the ReportInfo keys, undefined as null.
function normalizeReportPatch(patch) {
    var out = {}
    REPORT_INFO_KEYS.forEach(function (key) {
        if (key in patch) out[key] = patch[key] === undefined ? null : patch[key]
    })
    return out
}

// ---- dispatchedReports.ts

// One-paragraph notification text for an outcome.
function describeDispatchedReportOutcome(outcome) {
    var subject = "The report with ticket number " + outcome.ticket + " from the mobile app"
    if (outcome.ok || !outcome.failure) return subject + " was sent together with the machine's diagnostics."
    var f = outcome.failure
    return subject + " could not be sent. " + f.message + (f.note ? " " + f.note : "") + " Error code " + f.code + "."
}

// ---- reportHandoff.ts

// The bubble holds `run` and acts on its outcome, unless it let go of the run by then: handed over,
// cancelled or destroyed.
function holdRun(hold, run, act) {
    hold.current = run
    run.outcome.then(function (outcome) {
        if (hold.current !== run) return
        hold.current = null
        act(outcome)
    })
}

var _handedOverRun = null
var _contactDecision = null

var reportHandoff = {
    // The bubble is about to close for the contact email screen.
    detach: function (hold) {
        _handedOverRun = hold.current
        hold.current = null
    },
    // The bubble is back; the run is its own again.
    takeRun: function () {
        var run = _handedOverRun
        _handedOverRun = null
        return run
    },
    // What the contact email screen ended with: an address, or none.
    setContactDecision: function (email) { _contactDecision = { email: email } },
    takeContactDecision: function () {
        var decision = _contactDecision
        _contactDecision = null
        return decision
    }
}

// ---- contactEmailEdit.ts

var _pendingEdit = null
var _returnPending = false

var contactEmailEdit = {
    // The bubble is about to open the route to change `email`.
    open: function (email) { _pendingEdit = { email: email } },
    // Read once by the route on mount; null when opened for a report.
    take: function () {
        var edit = _pendingEdit
        _pendingEdit = null
        return edit
    },
    // The route is done; the bubble reopens on "Your contact info".
    markReturn: function () { _returnPending = true },
    takeReturn: function () {
        var pending = _returnPending
        _returnPending = false
        return pending
    }
}

// ---- AbortController / AbortSignal (the JS engine has none)

function AbortController() {
    var listeners = []
    var signal = {
        aborted: false,
        addEventListener: function (type, fn) { if (type === "abort") listeners.push(fn) },
        removeEventListener: function (type, fn) {
            var i = listeners.indexOf(fn)
            if (i >= 0) listeners.splice(i, 1)
        }
    }
    this.signal = signal
    this.abort = function () {
        if (signal.aborted) return
        signal.aborted = true
        listeners.slice().forEach(function (fn) {
            try { fn() } catch (e) { console.error("abort listener failed", e) }
        })
        listeners = []
    }
}

// ---- BugReport.tsx: issue date

var ISSUE_DATE_FIELDS = ["day", "month", "year", "hours", "minutes"]

function padTwo(value) { return value < 10 ? "0" + value : String(value) }

function formatIssueDate(date) {
    return padTwo(date.getDate()) + "." + padTwo(date.getMonth() + 1) + "." + date.getFullYear()
}

function formatIssueTime(date) { return padTwo(date.getHours()) + ":" + padTwo(date.getMinutes()) }

function toLabelledParts(formatted, separator, labels) {
    return formatted.split(separator).map(function (value, index) { return { label: labels[index], value: value } })
}

// The picker opens on the saved time (or now), minutes down to the half hour.
function issueDateDraftFrom(selectedIssueTimestamp, nowMs) {
    var d = new Date(selectedIssueTimestamp === undefined || selectedIssueTimestamp === null ? nowMs : selectedIssueTimestamp * 1000)
    d.setMinutes(Math.floor(d.getMinutes() / 30) * 30)
    return d
}

// One knob step on `field`; minutes in 30-minute steps; never later than now (rounded down).
function changeIssueDate(previousDate, field, direction, nowMs) {
    var nextDate = new Date(previousDate.getTime())
    nextDate.setMinutes(Math.floor(nextDate.getMinutes() / 30) * 30)
    switch (field) {
    case "day": nextDate.setDate(nextDate.getDate() + direction); break
    case "month": nextDate.setMonth(nextDate.getMonth() + direction); break
    case "year": nextDate.setFullYear(nextDate.getFullYear() + direction); break
    case "hours": nextDate.setHours(nextDate.getHours() + direction); break
    case "minutes": nextDate.setMinutes(nextDate.getMinutes() + direction * 30); break
    }
    if (nextDate.getTime() > nowMs) {
        nextDate.setTime(nowMs)
        nextDate.setMinutes(Math.floor(nextDate.getMinutes() / 30) * 30)
    }
    return nextDate
}

// ---- ReportContactEmail.tsx

var EMAIL_DOMAINS = ["gmail.com", "outlook.com", "proton.me", "hotmail.com", "icloud.com"]
var CUSTOM_DOMAIN_LABEL = "Custom"
var BACKSPACE_LABEL = "⌫"
var DOMAIN_OPTIONS = EMAIL_DOMAINS.concat([CUSTOM_DOMAIN_LABEL, BACKSPACE_LABEL])
var CUSTOM_DOMAIN_INDEX = DOMAIN_OPTIONS.indexOf(CUSTOM_DOMAIN_LABEL)
var BACKSPACE_INDEX = DOMAIN_OPTIONS.indexOf(BACKSPACE_LABEL)
// Encoder order on the confirm step, wrapping around at both ends.
var CONFIRM_FOCUS = ["ok", "local", "domain"]
var DECLINED_ACTIONS = [{ key: "ok", label: "Ok" }, { key: "enterEmail", label: "Enter email" }]

function stripSpaces(value) { return value.replace(/\s+/g, "") }

function splitEmail(email) {
    var at = email.indexOf("@")
    return at < 0 ? { localPart: email, domain: "" } : { localPart: email.slice(0, at), domain: email.slice(at + 1) }
}

function isListedDomain(domain) { return EMAIL_DOMAINS.indexOf(domain) >= 0 }

// Where the encoder starts on the domain list: on the current choice.
function domainIndexFor(domain) {
    if (!domain) return 0
    var index = EMAIL_DOMAINS.indexOf(domain)
    return index >= 0 ? index : CUSTOM_DOMAIN_INDEX
}

// ---- bytes (the JS engine has no TextEncoder)

function utf8Encode(str) {
    var out = []
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i)
        if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
            var d = str.charCodeAt(i + 1)
            if (d >= 0xdc00 && d <= 0xdfff) {
                c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00)
                i++
            }
        }
        if (c < 0x80) out.push(c)
        else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
        else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
        else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    }
    return new Uint8Array(out)
}

function utf8Decode(bytes) {
    var s = ""
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
    try { return decodeURIComponent(escape(s)) } catch (e) { return s }
}

function concatBytes(parts) {
    var total = 0
    parts.forEach(function (p) { total += p.length })
    var out = new Uint8Array(total)
    var offset = 0
    parts.forEach(function (p) {
        out.set(p, offset)
        offset += p.length
    })
    return out
}

// A uuid4 without dashes (Sentry's event ids).
function randomHex32() {
    var s = ""
    for (var i = 0; i < 32; i++) {
        var n = Math.floor(Math.random() * 16)
        if (i === 12) n = 4
        if (i === 16) n = (n & 3) | 8
        s += n.toString(16)
    }
    return s
}

// ---- settings-explanation (settings.css): the text flows around two floats whose shape-outside polygons
// follow the round display. Floats: 50 % x 50 % of the explanation box (200 x floatHeight, left and right),
// shape-margin 1 % (4 px). Returns the line box's left and right edges in the explanation (0 ... width) for
// the band [top, bottom) measured from the explanation's top.
var _LEFT_SHAPE = [[0, -0.0965], [0.415, -0.093], [0.15, 0.1158], [0, 0.3267], [-25, 0.4474]]
var _RIGHT_SHAPE = [[0.085, -0.1316], [0.445, 0.1351], [0.655, 0.4666], [0.8214, 0.8644], [0.963, 1.3126],
                    [0.995, 1.9035], [1, -0.1316]]

function _polygon(shape, floatWidth, floatHeight, offsetX) {
    return shape.map(function (p) {
        // -25px is an absolute length; the rest are percentages of the float's margin box.
        var x = p[0] === -25 ? -25 : p[0] * floatWidth
        return [offsetX + x, p[1] * floatHeight]
    })
}

// The extreme x (max for the left float, min for the right) of the polygon grown by `margin` within the
// band [y0, y1], or null when it does not reach into the band.
function _extremeX(poly, y0, y1, margin, wantMax) {
    var best = null
    function consider(x, y) {
        var d = y < y0 ? y0 - y : y > y1 ? y - y1 : 0
        if (d > margin) return
        var reach = Math.sqrt(margin * margin - d * d)
        var c = wantMax ? x + reach : x - reach
        if (best === null || (wantMax ? c > best : c < best)) best = c
    }
    for (var i = 0; i < poly.length; i++) {
        var a = poly[i], b = poly[(i + 1) % poly.length]
        consider(a[0], a[1])
        // Points along the edge (1 px apart) and its crossings of the band's edges.
        var len = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
        var steps = Math.max(1, Math.ceil(len))
        for (var s = 1; s < steps; s++) consider(a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps)
        ;[y0, y1].forEach(function (y) {
            if ((a[1] - y) * (b[1] - y) < 0) consider(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)
        })
    }
    return best
}

function explanationLine(top, bottom, width, floatHeight) {
    var floatWidth = width / 2
    var margin = width * 0.01
    var left = 0, right = width
    var y0 = Math.max(top, 0), y1 = Math.min(bottom, floatHeight)
    if (floatHeight > 0 && y1 > y0) {
        var l = _extremeX(_polygon(_LEFT_SHAPE, floatWidth, floatHeight, 0), y0, y1, margin, true)
        if (l !== null) left = Math.min(Math.max(l, 0), floatWidth)
        var r = _extremeX(_polygon(_RIGHT_SHAPE, floatWidth, floatHeight, floatWidth), y0, y1, margin, false)
        if (r !== null) right = Math.max(Math.min(r, width), floatWidth)
    }
    return { left: left, right: right }
}
