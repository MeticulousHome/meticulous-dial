pragma Singleton
// Reports handed over by the mobile app (src/components/BugReport/dispatchedReports.ts and the
// upload_report part of SocketProviderValue.tsx). The phone only mints the localID, gets the ticket and
// dispatches; the backend emits `upload_report` (Backend.uploadReport) and the dial does the rest here,
// headless: collect (create with the given localID), link the ticket, fetch the archive, deliver to
// Sentry, mark submitted. The outcome is announced as a notification, so a brew is never interrupted.
//
// One at a time. The backend keeps a dispatch queued until it is collected, so the pending list is
// replayed on every connect (Backend.connectedToServer) and when this starts while connected.
//
// It has to exist from the start: main.qml (core) creates it with `DispatchedReports.start()`; until it
// does, the bug report screen starts it when it opens (see the parity notes).
import QtQuick
import Dial
import "ReportLib.js" as ReportLib

QtObject {
    id: dispatched

    // A dial-started report may hold the collection lock for minutes, so a dispatched one waits for it
    // rather than giving up after the short retries used for the other stages.
    readonly property int busyRetryDelayMs: 30 * 1000
    readonly property int busyRetryLimit: 20
    // Collection plus upload; generous because the archive can be large.
    readonly property int dispatchTimeoutMs: 15 * 60 * 1000
    // A dispatch that keeps failing is retried on later reconnects, but not forever within one session.
    readonly property int attemptLimit: 3

    property bool started: false
    property var _queue: []
    property var _attempts: ({})
    property string active: ""

    // For tests and diagnosis: the outcomes so far.
    property var outcomes: []
    signal outcome(var outcome)

    function start() {
        if (started) return
        started = true
        if (Backend.connected) syncPendingLogged()
    }

    property Connections _backend: Connections {
        target: Backend
        enabled: dispatched.started
        function onUploadReport(event) { dispatched.enqueue(event) }
        function onConnectedToServer() { dispatched.syncPendingLogged() }
    }

    function _notify(result) {
        outcomes = outcomes.concat([result])
        outcome(result)
        Notifications.addOne({
            id: "dispatched-report-" + result.localID,
            message: ReportLib.describeDispatchedReportOutcome(result),
            responses: ["Ok"],
            timestamp: new Date().toISOString()
        })
    }

    function _collectDraft(event, signal) {
        const attemptCollect = (busyRetries) => ReportApi.withRetry(() => ReportApi.createReport({ localID: event.localID }, { signal: signal }).then(result => {
            if (ReportLib.isReportError(result))
                throw Object.assign(new Error(result.error), { reportCode: ReportLib.getReportErrorCode(result) })
            return result
        }), signal, "collect " + event.localID).catch(error => {
            if (error && error.reportCode === "COLLECTION_IN_PROGRESS" && busyRetries < busyRetryLimit) return null
            throw error
        }).then(created => {
            if (created) return created
            return ReportApi.sleep(busyRetryDelayMs, signal).then(() => attemptCollect(busyRetries + 1))
        })
        return attemptCollect(0)
    }

    function _upload(event) {
        const controller = new ReportLib.AbortController()
        const signal = controller.signal
        const timeout = ReportApi.after(dispatchTimeoutMs, () => controller.abort())
        let stage = "collecting"
        return _collectDraft(event, signal).then(draft => {
            if (!draft.machineID || !String(draft.machineID).trim())
                throw Object.assign(new Error("Draft has no machineID"), { failure: "noSerial" })
            stage = "updatingReport"
            return ReportApi.updateReport(event.localID, { ticket: event.ticket, description: event.description },
                                          { signal: signal, timeout: 30000 })
        }).then(reportInfo => {
            if (ReportLib.isReportError(reportInfo)) throw new Error(reportInfo.error)
            stage = "fetchingFile"
            return ReportApi.getDraftReport(event.localID, { signal: signal }).then(draftFile => {
                if (ReportLib.isReportError(draftFile)) throw new Error(draftFile.error)
                const attachment = ReportLib.buildDraftAttachment(draftFile)
                stage = "sendingFeedback"
                // Single attempt, as in the interactive flow: a feedback is create-only.
                return ReportApi.sendSentryFeedback({ reportInfo: reportInfo, attachment: attachment, signal: signal,
                                                      contact: { name: event.name, email: event.email }, origin: "mobile" })
            })
        }).then(eventID => {
            stage = "savingRecord"
            return ReportApi.markSubmittedReport({ localID: event.localID, eventID: eventID, ticket: event.ticket,
                                                   submissionTime: Math.floor(Date.now() / 1000) },
                                                 { signal: signal, timeout: 60000 })
        }).then(marked => {
            if (ReportLib.isReportError(marked)) throw new Error(marked.error)
            return { localID: event.localID, ticket: event.ticket, ok: true }
        }).catch(error => {
            const stageFailure = { collecting: "creation", updatingReport: "reportUpdate", fetchingFile: "reportLoad",
                                   sendingFeedback: "sentrySubmission", savingRecord: "submissionMark" }
            const failureType = signal.aborted ? "submissionTimeout"
                : ((error && error.failure)
                   || (stage === "collecting" ? ReportLib.CREATE_ERROR_FAILURE[error && error.reportCode] : undefined)
                   || stageFailure[stage])
            const d = ReportLib.FAILURE_DETAILS[failureType]
            ReportApi.captureException(error, d.code)
            return {
                localID: event.localID, ticket: event.ticket, ok: false,
                failure: { code: d.code, message: d.message,
                           note: stage === "savingRecord" ? "We received the report with ticket number " + event.ticket + "." : undefined }
            }
        }).then(result => {
            timeout.cancel()
            return result
        })
    }

    function _drain() {
        if (active !== "") return
        const next = _queue.shift()
        if (!next) return
        active = next.localID
        _attempts[next.localID] = (_attempts[next.localID] || 0) + 1
        _upload(next).then(result => {
            try { _notify(result) } catch (e) { console.error("[dispatched-report] outcome listener failed", e) }
        }).then(() => {
            active = ""
            _drain()
        })
    }

    // Queue a dispatch from the live `upload_report` event.
    function enqueue(event) {
        if (!event || !event.localID || typeof event.ticket !== "number") {
            console.warn("[dispatched-report] ignoring malformed event", JSON.stringify(event))
            return
        }
        if (active === event.localID || _queue.some(q => q.localID === event.localID)
                || (_attempts[event.localID] || 0) >= attemptLimit)
            return
        _queue.push(event)
        _drain()
    }

    // Replay what the backend still has queued: the live event is lost while the dial is restarting or
    // disconnected.
    function syncPending() {
        return ReportApi.getPendingReportDispatches({ timeout: 15000 }).then(pending => {
            if (ReportLib.isReportError(pending)) {
                // Older backends have no dispatch endpoint; nothing to replay.
                console.warn("[dispatched-report] pending list unavailable", JSON.stringify(pending))
                return
            }
            ;(pending || []).forEach(event => enqueue(event))
        })
    }
    function syncPendingLogged() {
        syncPending().catch(error => console.warn("[dispatched-report] pending sync failed", error && error.message))
    }
}
