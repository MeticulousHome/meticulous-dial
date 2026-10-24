pragma Singleton
// The network side of the bug report: the report calls of @meticulous-home/espresso-api 0.15 as the React
// Dial uses them (they resolve with the body or an APIError and never throw), the ticket service, and the
// Sentry feedback that delivers a report (reportSubmission.ts's sendSentryFeedback / captureException).
//
// Its own XMLHttpRequest wrapper rather than Core's Api: a collection is cancelled by aborting the request
// (the backend stops collecting when the client goes away), and the draft archive is binary.
//
// Sentry: the React Dial initializes it only in its production build under Tauri (App.tsx), so a browser
// build never delivers a report (BR-05). Here it is on when the Dial runs on the machine (eglfs / wayland /
// linuxfb), off under the development X server; DIAL_SENTRY_DSN overrides the DSN (empty: off) and
// DIAL_TICKET_SERVICE_URL the ticket service. With the test port open, the storage key
// "support.reportServices" ({ ticketServiceUrl, sentryDsn }) overrides both, so end-to-end tests answer
// them locally instead of reaching the real services.
import QtQuick
import Dial
import Dial.Native
import "ReportLib.js" as ReportLib

QtObject {
    id: reportApi

    readonly property string sentryDsnDefault: "https://d958eb514629903cf133ad2b19e80ead@sentry.meticulousespresso.com/8"
    readonly property string ticketServiceUrlDefault: "https://a3qhsgqqfk.execute-api.us-east-1.amazonaws.com/Prod/ticket"
    readonly property bool onMachine: ["eglfs", "wayland", "wayland-egl", "linuxfb"].indexOf(Native.platformName) >= 0
    readonly property string sdkName: "meticulous-dial-qt"

    function _overrides() {
        if (Native.testPort <= 0) return null
        // Stored as a JSON string (Native.storage keeps strings, numbers and booleans).
        let o = Native.storageGet("support.reportServices", null)
        if (typeof o === "string") {
            try { o = JSON.parse(o) } catch (e) { o = null }
        }
        return o && typeof o === "object" ? o : null
    }
    function ticketServiceUrl() {
        const o = _overrides()
        if (o && o.ticketServiceUrl) return String(o.ticketServiceUrl)
        return Native.env("DIAL_TICKET_SERVICE_URL", ticketServiceUrlDefault)
    }
    function sentryDsn() {
        const o = _overrides()
        if (o && o.sentryDsn !== undefined && o.sentryDsn !== null) return String(o.sentryDsn)
        return Native.env("DIAL_SENTRY_DSN", onMachine ? sentryDsnDefault : "")
    }
    function origin(url) {
        const m = /^(https?:\/\/[^\/?#]+)/.exec(url)
        return m ? m[1].replace(/\/\/[^@\/]*@/, "//") : url
    }
    // REPORT_PROBE_URLS: exactly the two origins the report flow reaches (the real ones: the backend
    // refuses to probe private addresses, and a test's stand-ins are reached from the dial anyway).
    function probeUrls() { return [origin(sentryDsnDefault), origin(ticketServiceUrlDefault)] }

    // ---- timers

    // setTimeout: returns { cancel() }.
    function after(ms, fn) {
        const timer = Qt.createQmlObject("import QtQml; Timer { repeat: false }", reportApi)
        let live = true
        timer.interval = Math.max(0, ms)
        timer.triggered.connect(() => {
            if (!live) return
            live = false
            timer.destroy()
            fn()
        })
        timer.start()
        return { cancel: () => { if (live) { live = false; timer.stop(); timer.destroy() } } }
    }

    function sleep(ms, signal) {
        return new Promise((resolve, reject) => {
            const t = after(ms, resolve)
            if (signal) signal.addEventListener("abort", () => {
                t.cancel()
                reject(new Error("aborted"))
            })
        })
    }

    function withRetry(attempt, signal, label, delays) {
        delays = delays || ReportLib.RETRY_DELAYS_MS
        let lastError
        const tryAt = (index) => {
            if (signal.aborted) return Promise.reject(lastError !== undefined ? lastError : new Error("aborted"))
            // An attempt that throws counts as a failed one, as an async function's would.
            return Promise.resolve().then(() => attempt()).catch(error => {
                lastError = error
                console.warn("[bug-report] " + label + " attempt " + (index + 1) + " failed: " + error)
                if (index < delays.length) return sleep(delays[index], signal).then(() => tryAt(index + 1))
                throw lastError
            })
        }
        return tryAt(0)
    }

    // ---- HTTP, as axios: resolves { status, data } for a 2xx answer; rejects with an Error whose
    // `response` is { status, data } for any other answer, "Network Error" without one, "timeout of N ms
    // exceeded" on a timeout and "canceled" when the signal aborts. options: { timeout, signal,
    // responseType ("json" | "arraybuffer"), headers }.
    function http(method, url, body, options) {
        options = options || {}
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            let done = false
            let timer = null
            let onAbort = null
            const finish = (fn, value) => {
                if (done) return
                done = true
                if (timer) timer.cancel()
                if (options.signal && onAbort) options.signal.removeEventListener("abort", onAbort)
                fn(value)
            }
            onAbort = () => {
                if (done) return
                finish(reject, Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }))
                xhr.abort()
            }
            if (options.signal) {
                if (options.signal.aborted) {
                    reject(Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }))
                    return
                }
                options.signal.addEventListener("abort", onAbort)
            }
            if (options.timeout) {
                timer = after(options.timeout, () => {
                    if (done) return
                    timer = null
                    finish(reject, Object.assign(new Error("timeout of " + options.timeout + "ms exceeded"), { code: "ECONNABORTED" }))
                    xhr.abort()
                })
            }
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== XMLHttpRequest.DONE || done) return
                let data
                if (options.responseType === "arraybuffer") {
                    data = xhr.response ? new Uint8Array(xhr.response) : new Uint8Array(0)
                } else {
                    data = xhr.responseText
                    if (data && data.length) {
                        try { data = JSON.parse(data) } catch (e) { /* not JSON: keep the text */ }
                    }
                }
                if (xhr.status === 0) {
                    finish(reject, Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }))
                } else if (xhr.status >= 200 && xhr.status < 300) {
                    finish(resolve, { status: xhr.status, data: data })
                } else {
                    finish(reject, Object.assign(new Error("Request failed with status code " + xhr.status),
                                                 { response: { status: xhr.status, data: data } }))
                }
            }
            xhr.open(method, url.startsWith("http") ? url : Api.base + url)
            if (options.responseType === "arraybuffer") xhr.responseType = "arraybuffer"
            const headers = Object.assign({ Accept: "application/json" }, options.headers || {})
            for (const k in headers) xhr.setRequestHeader(k, headers[k])
            if (body instanceof Uint8Array) {
                xhr.send(body.buffer.byteLength === body.length ? body.buffer : body.slice().buffer)
            } else if (body !== undefined && body !== null) {
                xhr.setRequestHeader("Content-Type", "application/json")
                xhr.send(JSON.stringify(body))
            } else {
                xhr.send()
            }
        })
    }

    // The body of a failed answer as espresso-api passes it on (error.response?.data), decoded when binary.
    function _errorBody(error) {
        if (!error || !error.response) return undefined
        const data = error.response.data
        if (data instanceof Uint8Array) {
            const text = ReportLib.utf8Decode(data)
            try { return JSON.parse(text) } catch (e) { return text }
        }
        return data
    }
    function _report(promise, pick) {
        return promise.then(r => pick ? pick(r.data) : r.data)
                      .catch(error => ReportLib.parseAPIError(error && error.response ? _errorBody(error) : undefined))
    }
    function _opts(options, defaults) {
        options = options || defaults || {}
        return { signal: options.signal, timeout: options.timeout }
    }

    // ---- the report calls (espresso-api 0.15)
    function createReport(request, options) {
        return _report(http("POST", "/api/v1/reports/create", request === undefined ? null : request, _opts(options)))
    }
    function requestReport(options) {
        return _report(http("POST", "/api/v1/reports/request", null, _opts(options, { timeout: 15000 })))
    }
    function dispatchReport(dispatch, options) {
        return _report(http("POST", "/api/v1/reports/dispatch", dispatch, _opts(options, { timeout: 15000 })))
    }
    function getPendingReportDispatches(options) {
        return _report(http("GET", "/api/v1/reports/dispatch", null, _opts(options, { timeout: 15000 })),
                       data => ReportLib.isAPIError(data) ? data : (data ? data.content : data))
    }
    function getReportPreflight(probes, options) {
        const q = (probes || []).slice(0, 4).map(p => "probe=" + encodeURIComponent(p)).join("&")
        return _report(http("GET", "/api/v1/reports/preflight" + (q ? "?" + q : ""), null, _opts(options, { timeout: 15000 })))
    }
    function getDraftReport(localID, options) {
        const o = _opts(options)
        o.responseType = "arraybuffer"
        o.headers = { Accept: "application/octet-stream" }
        return _report(http("GET", "/api/v1/reports/draft/" + encodeURIComponent(localID), null, o))
    }
    function deleteDraftReport(localID, options) {
        return _report(http("DELETE", "/api/v1/reports/draft/" + encodeURIComponent(localID), null, _opts(options)),
                       data => ReportLib.isAPIError(data) ? data : undefined)
    }
    function updateReport(id, patch, options) {
        return _report(http("PUT", "/api/v1/reports/draft/" + encodeURIComponent(id), ReportLib.normalizeReportPatch(patch), _opts(options)))
    }
    function markSubmittedReport(info, options) {
        return _report(http("POST", "/api/v1/reports/submit", info, _opts(options)),
                       data => ReportLib.isAPIError(data) ? data : undefined)
    }
    // The ticket service (a third party): only the report's event id goes there.
    function getMeticulousReportTracking(serviceUrl, payload, options) {
        return http("POST", serviceUrl, payload, _opts(options, { timeout: 15000 })).then(r => {
            if (ReportLib.isAPIError(r.data)) return r.data
            const ticket = r.data ? r.data.ticket : undefined
            if (typeof ticket !== "number" || !Number.isSafeInteger(ticket))
                return ReportLib.parseAPIError("Ticket service returned no ticket", undefined, { value: r.data })
            return ticket
        }).catch(error => ReportLib.parseAPIError(error && error.response ? _errorBody(error) : undefined))
    }

    // ---- Sentry

    function _dsnParts(dsn) {
        const m = /^(https?):\/\/([^@\/]+)@([^\/]+)\/(.+)$/.exec(dsn)
        return m ? { scheme: m[1], key: m[2], host: m[3], project: m[4] } : null
    }
    function _envelopeUrl(parts) {
        return parts.scheme + "://" + parts.host + "/api/" + parts.project + "/envelope/?sentry_version=7&sentry_key="
            + parts.key + "&sentry_client=" + encodeURIComponent(sdkName + "/" + Native.version)
    }
    // The tags every event of the Dial carries (App.tsx's initialScope and SentryRuntimeMetadata).
    function _scopeTags() {
        const tags = { "dial-version": Native.version }
        const info = Device.info
        if (info) {
            if (info.serial !== undefined && info.serial !== null) tags.serial = String(info.serial)
            if (info.image_version) tags["build-version"] = String(info.image_version)
            if (info.image_build_channel) tags["build-channel"] = String(info.image_build_channel)
        }
        return tags
    }
    function _baseEvent(eventId) {
        return {
            event_id: eventId,
            timestamp: Date.now() / 1000,
            platform: "javascript",
            release: "meticulous-dial-qt@" + Native.version,
            environment: "production",
            sdk: { name: sdkName, version: Native.version }
        }
    }
    function _envelope(parts, dsn, event, itemType, attachments) {
        const chunks = []
        const line = (obj) => chunks.push(ReportLib.utf8Encode(JSON.stringify(obj) + "\n"))
        line({ event_id: event.event_id, sent_at: new Date().toISOString(), dsn: dsn, sdk: event.sdk })
        const payload = ReportLib.utf8Encode(JSON.stringify(event))
        line({ type: itemType, length: payload.length })
        chunks.push(payload)
        chunks.push(ReportLib.utf8Encode("\n"))
        ;(attachments || []).forEach(a => {
            line({ type: "attachment", length: a.data.length, filename: a.filename, content_type: a.contentType })
            chunks.push(a.data)
            chunks.push(ReportLib.utf8Encode("\n"))
        })
        return ReportLib.concatBytes(chunks)
    }

    // Resolves with the event id only when Sentry acknowledged the feedback with a 2xx.
    // `origin` says who asked for the report; the dial is always the sender.
    function sendSentryFeedback(args) {
        const dsn = sentryDsn()
        const parts = dsn ? _dsnParts(dsn) : null
        if (!parts) return Promise.reject(new Error("Sentry is not initialized"))
        const reportInfo = args.reportInfo || {}
        const contact = args.contact || {}
        const origin = args.origin || "dial"
        const contactName = contact.name ? String(contact.name).trim() : ""
        const contactEmail = contact.email ? String(contact.email).trim() : ""
        const defaultMessage = origin === "mobile" ? "Bug report dispatched from the mobile app"
                                                   : "Bug report submitted through quick report"
        const feedback = { message: reportInfo.description || defaultMessage, source: "custom" }
        if (contactName) feedback.name = contactName
        else if (reportInfo.machineID) feedback.name = reportInfo.machineID
        if (contactEmail) feedback.contact_email = contactEmail
        if (reportInfo.baseEventID) feedback.associated_event_id = reportInfo.baseEventID
        const eventId = ReportLib.randomHex32()
        const event = Object.assign(_baseEvent(eventId), {
            type: "feedback",
            level: "info",
            tags: Object.assign(_scopeTags(), ReportLib.reportInfoTags(reportInfo), {
                "meticulous.report_source": "dial",
                "meticulous.report_origin": origin,
                "meticulous.report_attachment_bytes": String(args.attachment.data.length)
            }),
            contexts: {
                feedback: feedback,
                report: {
                    attachments: reportInfo.attachments !== undefined ? reportInfo.attachments : null,
                    description: reportInfo.description !== undefined ? reportInfo.description : null,
                    multimedia: reportInfo.multimedia !== undefined ? reportInfo.multimedia : null
                }
            }
        })
        const body = _envelope(parts, dsn, event, "feedback", [{
            filename: args.attachment.name.replace(/\//g, "_"),
            data: args.attachment.data,
            contentType: args.attachment.contentType
        }])
        return http("POST", _envelopeUrl(parts), body, {
            signal: args.signal,
            timeout: ReportLib.SENTRY_DELIVERY_TIMEOUT_MS,
            headers: { "Content-Type": "application/x-sentry-envelope" }
        }).then(() => eventId).catch(error => {
            if (error && error.code === "ERR_CANCELED") throw new Error("Report submission aborted")
            if (error && error.code === "ECONNABORTED") throw new Error("Sentry did not acknowledge the report in time")
            if (error && error.response) throw new Error("Sentry rejected the report with HTTP " + error.response.status)
            throw new Error("Sentry transport failed (no response)")
        })
    }

    // captureException: logged, and sent to Sentry when it is on, tagged with the failure code.
    function captureException(error, errorCode) {
        console.error(errorCode ? "[" + errorCode + "]" : "", error && error.message ? error.message : JSON.stringify(error))
        const dsn = sentryDsn()
        const parts = dsn ? _dsnParts(dsn) : null
        if (!parts) return
        const isError = error instanceof Error
        const event = Object.assign(_baseEvent(ReportLib.randomHex32()), {
            level: "error",
            exception: { values: [{ type: isError ? (error.name || "Error") : "Error",
                                    value: isError ? error.message : (typeof error === "string" ? error : JSON.stringify(error)) }] },
            tags: Object.assign(_scopeTags(), errorCode ? { "meticulous.bug_report_error_code": errorCode } : {})
        })
        http("POST", _envelopeUrl(parts), _envelope(parts, dsn, event, "event"), {
            timeout: ReportLib.SENTRY_DELIVERY_TIMEOUT_MS,
            headers: { "Content-Type": "application/x-sentry-envelope" }
        }).catch(e => console.warn("[bug-report] Sentry did not take the exception:", e.message))
    }
}
