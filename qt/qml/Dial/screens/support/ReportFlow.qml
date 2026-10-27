pragma Singleton
// What of the bug report outlives the bubble (it closes for the contact email screen, and navigation can
// unmount it while a report is being sent):
//  - the collection run (reportCollection.ts): preflight, then POST /reports/create, as a run with its own
//    promise and abort controller; cancelling aborts the request so the machine stops collecting;
//  - the submission of BugReport.tsx's submitReport: ticket, link it to the draft, fetch the archive, Sentry,
//    mark submitted, under a 5 minute cap, kept in `inFlight` so the next bubble shows its outcome.
// The bubble that started a submission follows it through the signals carrying its owner token.
import QtQuick
import Dial
import "ReportLib.js" as ReportLib

QtObject {
    id: flow

    readonly property int slowCollectionMs: 60 * 1000
    // The submitted screen waits on the closing animation, capped (a dropped "complete" would strand the
    // user on a screen with no options): the collecting loop's boundary (2.0 s), the bridge (2.4 s) and
    // Finished (1.1 s) with room for a slow frame rate.
    readonly property int finishedAnimationTimeoutMs: 12 * 1000
    readonly property int submissionTimeoutMs: 5 * 60 * 1000

    // { localID, outcome: Promise<{ ticket, failure }> } while a submission runs.
    property var inFlight: null

    // The bubble `owner` shows these for its submission.
    signal submissionFailed(string owner, var failure)
    // Plays Finished; the bubble calls finishedAnimationEnded(owner) when it played out.
    signal finishRequested(string owner)
    signal submissionSucceeded(string owner, var ticket)
    signal ticketReserved(string owner, var ticket)

    property var _finishedResolvers: ({})

    // ---- reportCollection.ts

    function _deleteCancelledDraft(localID) {
        return ReportApi.deleteDraftReport(localID).then(response => {
            if (ReportLib.isReportError(response)) throw new Error(response.error)
        }).catch(error => {
            // Cancellation is already complete from the user's perspective. Keep this failure out of
            // the UI, while retaining it for diagnosis.
            ReportApi.captureException(error)
        })
    }

    function _collect(run, issueTime) {
        const signal = run.controller.signal
        return ReportApi.getReportPreflight(ReportApi.probeUrls(), { signal: signal, timeout: 20000 }).then(preflight => {
            if (run.cancelled) return null
            if (!ReportLib.isReportError(preflight)) {
                const blocker = preflight && preflight.blockers ? preflight.blockers[0] : undefined
                if (blocker && ReportLib.BLOCKER_FAILURE[blocker])
                    return { failure: ReportLib.BLOCKER_FAILURE[blocker], error: preflight }
            } else {
                // Old backends do not have preflight. Any API error is non-blocking.
                console.warn("[bug-report] preflight unavailable, continuing", JSON.stringify(preflight))
            }
            const create = issueTime === undefined || issueTime === null
                ? ReportApi.createReport(undefined, { signal: signal })
                : ReportApi.createReport({ issueTime: issueTime }, { signal: signal })
            return create.then(createResponse => {
                if (ReportLib.isReportError(createResponse)) {
                    throw Object.assign(new Error(createResponse.error), { reportCode: ReportLib.getReportErrorCode(createResponse) })
                }
                if (run.cancelled) return _deleteCancelledDraft(createResponse.localID).then(() => null)
                if (!createResponse.machineID || !String(createResponse.machineID).trim()) {
                    return _deleteCancelledDraft(createResponse.localID).then(() => ({
                        failure: "noSerial", error: new Error("Draft has no machineID")
                    }))
                }
                return { draft: createResponse }
            })
        }).catch(error => {
            if (run.cancelled) {
                // Aborting makes createReport() resolve to an APIError that surfaces here as a throw,
                // indistinguishable from a genuine failure: decided from the run's own token.
                console.error("[bug-report] discarded error from a cancelled report creation", error && error.message)
                return null
            }
            const failure = (error && error.failure)
                || ReportLib.CREATE_ERROR_FAILURE[(error && error.reportCode) || "INTERNAL"]
                || "creation"
            return { failure: failure, error: error }
        })
    }

    function startCollection(issueTime) {
        const run = {
            cancelled: false,
            controller: new ReportLib.AbortController(),
            slow: false,
            onSlow: null,
            outcome: Promise.resolve(null)
        }
        const slowTimer = ReportApi.after(slowCollectionMs, () => {
            run.slow = true
            if (run.onSlow) run.onSlow()
        })
        run.outcome = _collect(run, issueTime).then(outcome => {
            slowTimer.cancel()
            return outcome
        }, error => {
            slowTimer.cancel()
            throw error
        })
        return run
    }

    // Stops the in-flight request so the machine stops collecting.
    function cancelCollection(run) {
        run.cancelled = true
        run.controller.abort()
    }

    // ---- BugReport.tsx: submitReport

    function finishedAnimationEnded(owner) {
        const resolve = _finishedResolvers[owner]
        delete _finishedResolvers[owner]
        if (resolve) resolve()
    }

    function _playFinishedAnimation(owner) {
        return new Promise(resolve => {
            const safety = ReportApi.after(finishedAnimationTimeoutMs, () => {
                delete _finishedResolvers[owner]
                resolve()
            })
            _finishedResolvers[owner] = () => {
                safety.cancel()
                resolve()
            }
            finishRequested(owner)
        })
    }

    // Submits a collected draft for the bubble `owner` with the contact email (or null).
    function submit(owner, draftInfo, contactEmail) {
        if (!draftInfo.localID) {
            const view = ReportLib.failureView("reportLoad")
            ReportApi.captureException("No draft report", view.code)
            submissionFailed(owner, view)
            return
        }
        const controller = new ReportLib.AbortController()
        const signal = controller.signal
        let resolveOutcome
        const outcome = new Promise(resolve => { resolveOutcome = resolve })
        const submission = { localID: draftInfo.localID, outcome: outcome }
        inFlight = submission
        let outcomeFailure = null
        let ticket = null
        let stage = null
        let timedOut = false

        const fail = (type, error, note) => {
            const view = ReportLib.failureView(type, note)
            ReportApi.captureException(error, view.code)
            submissionFailed(owner, view)
            outcomeFailure = view
        }
        const reservedNote = () => ticket !== null
            ? "A ticket number " + ticket + " was reserved. Save it in case the report arrived." : undefined

        const submissionTimeout = ReportApi.after(submissionTimeoutMs, () => {
            timedOut = true
            controller.abort()
            fail("submissionTimeout", "Report submission timed out", reservedNote())
        })

        stage = "ticketing"
        ReportApi.withRetry(() => ReportApi.getMeticulousReportTracking(
                ReportApi.ticketServiceUrl(), { eventID: ReportLib.getTicketEventID(draftInfo) },
                { signal: signal, timeout: 15000 }).then(result => {
            if (ReportLib.isReportError(result)) throw new Error(result.error)
            if (!Number.isSafeInteger(result)) throw new Error("Ticket service returned no ticket")
            return result
        }), signal, "ticket").then(value => {
            ticket = value
            ticketReserved(owner, ticket)
            stage = "updatingReport"
            return ReportApi.updateReport(draftInfo.localID, { ticket: ticket }, { signal: signal, timeout: 30000 })
        }).then(reportInfo => {
            if (ReportLib.isReportError(reportInfo)) throw new Error(reportInfo.error)
            stage = "fetchingFile"
            return ReportApi.getDraftReport(draftInfo.localID, { signal: signal }).then(draftFile => {
                if (ReportLib.isReportError(draftFile)) throw new Error(draftFile.error)
                stage = "buildingFeedback"
                const attachment = ReportLib.buildDraftAttachment(draftFile)
                stage = "sendingFeedback"
                // Single attempt on purpose: a feedback is create-only, so a retry after an ambiguous
                // transport result files a brand-new duplicate report rather than re-sending this one.
                return ReportApi.sendSentryFeedback({ reportInfo: reportInfo, attachment: attachment, signal: signal,
                                                      contact: { email: contactEmail } })
            })
        }).then(eventID => {
            stage = "savingRecord"
            return ReportApi.markSubmittedReport({
                localID: draftInfo.localID, eventID: eventID, ticket: ticket,
                submissionTime: Math.floor(Date.now() / 1000)
            }, { signal: signal, timeout: 60000 })
        }).then(marked => {
            if (ReportLib.isReportError(marked)) throw new Error(marked.error)
            // The report is in. Everything left is animation, so retire the network timeout rather than
            // let it fail a submission that already succeeded.
            submissionTimeout.cancel()
            return _playFinishedAnimation(owner).then(() => {
                stage = null
                submissionSucceeded(owner, ticket)
            })
        }).catch(error => {
            if (timedOut || signal.aborted) return
            if (stage === "sendingFeedback") {
                fail("sentrySubmission", error)
            } else if (stage === "ticketing") {
                fail(ReportLib.isOfflineError(error) ? "offline" : "TicketTrackRequest", error)
            } else if (stage === "updatingReport") {
                fail("reportUpdate", error)
            } else if (stage === "savingRecord") {
                // The report itself made it through, so the ticket is still usable.
                fail("submissionMark", error,
                     "We received your report with ticket number " + ticket + ". Save it for further tracking.")
            } else {
                fail("reportLoad", error)
            }
        }).then(() => {
            submissionTimeout.cancel()
            resolveOutcome({ ticket: ticket, failure: outcomeFailure })
            if (inFlight === submission) inFlight = null
        })
    }
}
