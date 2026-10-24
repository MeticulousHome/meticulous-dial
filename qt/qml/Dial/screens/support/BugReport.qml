// Report an issue (src/components/BugReport/BugReport.tsx, bugReport.css), in the bubble (420 px panel):
//   message          what a report does; "Your contact info" (when an address is saved), "Contact us",
//                    "Report an issue", "Back"
//   contactUs        the support page as a QR code
//   yourContactInfo  the saved address (press: change it on the contact email screen) and "Remove contact
//                    info" (hold)
//   reportSetup      the issue date and time (now, or the one picked) and "Report" / "Select date" / "Back"
//   selectIssueDate  the picker: turn changes the field, press moves to the next, long press confirms,
//                    double press goes back
//   reportingBug     collecting (Cancel; after a minute the copy says it is slow), then sending; a failure
//                    shows its message and code with "Exit"
//   submitted        the ticket number, "Exit"
// "Report" without a saved address closes the bubble for the contact email screen while the machine
// collects; the run and the answer come back through ReportLib's hand-off. The collection and the
// submission live in ReportFlow, so they outlive the bubble. While busy the bubble is pinned and the dial
// does not go idle.
import QtQuick
import Dial
import Dial.Native
import "ReportLib.js" as ReportLib

Item {
    id: report
    anchors.fill: parent
    property bool inBubble: false

    readonly property string contactSupportNote: "Please contact us for further information."
    readonly property string supportWebsiteUrl: "https://meticuloushome.com/pages/contact"

    property string reportScreen: "message"   // message | reportSetup | selectIssueDate | reportingBug | contactUs | yourContactInfo | submitted
    property string reportStatus: "idle"      // idle | fetching | slowFetch | submitting | failed
    property int activeIndex: 0
    property var failure: null
    property var selectedIssueTimestamp: undefined
    property var issueDateDraft: new Date()
    property string activeIssueDateField: "day"
    property bool isFinishing: false
    property string holdAnimation: "stopped"
    // Refs of the React component.
    property var activeCreateRun: ({ current: null })
    property var draftInfo: null
    property var ticket: null
    // The email the current report goes out with: the saved setting, or what the user answered on the
    // contact email screen; null once declined.
    property var contactEmail: null
    property bool alive: true
    readonly property string owner: "bug-report-" + Math.random().toString(36).slice(2)

    // The address on file; "Your contact info" and the report legend show it.
    readonly property var savedEmail: {
        const v = BackendSettings.data ? BackendSettings.data.report_contact_mail : null
        const t = v ? String(v).trim() : ""
        return t.length ? t : null
    }
    readonly property bool busy: reportStatus === "fetching" || reportStatus === "slowFetch" || reportStatus === "submitting"
    readonly property string animationPhase: isFinishing ? "finished" : reportStatus === "submitting" ? "submitting" : "collecting"

    readonly property var options: {
        const o = (key, label, hold) => ({ key: key, label: label, useableWidthPercentage: 81, hold: !!hold })
        if (reportScreen === "message")
            return (savedEmail ? [o("yourContactInfo", "Your contact info")] : [])
                .concat([o("contactUs", "Contact us"), o("reportIssue", "Report an issue"), o("back", "Back")])
        if (reportScreen === "contactUs") return [o("back", "Back")]
        if (reportScreen === "yourContactInfo")
            return (savedEmail ? [o("editContactEmail", savedEmail), o("removeContactEmail", "Remove contact info", true)] : [])
                .concat([o("back", "Back")])
        if (reportScreen === "reportSetup")
            return [o("report", "Report"), o("selectDate", "Select date"), o("back", "Back")]
        if (reportScreen === "reportingBug" && (reportStatus === "fetching" || reportStatus === "slowFetch"))
            return [o("cancel", "Cancel")]
        if (reportScreen === "reportingBug" && reportStatus === "failed") return [o("exit", "Exit")]
        if (reportScreen === "submitted") return [o("exit", "Exit")]
        return []
    }

    // For the end-to-end tests.
    readonly property string dialProbe_reportScreen: reportScreen
    readonly property string dialProbe_reportStatus: reportStatus
    readonly property var dialProbe_ticket: ticket
    readonly property string dialProbe_animation: animationPhase
    readonly property string dialProbe_issueDate: ReportLib.formatIssueDate(issueDateDraft) + " " + ReportLib.formatIssueTime(issueDateDraft)
    readonly property string dialFocusedLabel: reportScreen === "selectIssueDate" ? activeIssueDateField : ""
    // Where a report would go (the tests check they answer it themselves before reporting).
    readonly property string dialProbe_reportServices: JSON.stringify({ ticket: ReportApi.ticketServiceUrl(), sentry: ReportApi.sentryDsn() })

    // ---- actions

    function exitToQuickSettings() {
        Nav.setBubblePinned(false)
        const targetScreen = Nav.screen === "bug-report" ? (Nav.prev || "profileHome") : Nav.screen
        if (targetScreen !== Nav.screen) {
            Nav.setScreen(targetScreen)
            return
        }
        Nav.setBubbleDisplay({ visible: true, component: "quick-settings" })
    }

    function failSubmission(failureType, error, note) {
        const view = ReportLib.failureView(failureType, note)
        failure = view
        reportStatus = "failed"
        isFinishing = false
        ReportApi.captureException(error, view.code)
    }

    function resetCancelledReport() {
        Nav.setBubblePinned(false)
        reportScreen = "message"
        reportStatus = "idle"
        activeIndex = 0
        failure = null
        selectedIssueTimestamp = undefined
        issueDateDraft = new Date()
        activeIssueDateField = "day"
        draftInfo = null
        ticket = null
        isFinishing = false
        contactEmail = null
    }

    function cancelCreateReport() {
        const run = activeCreateRun.current
        if (!run) return
        ReportFlow.cancelCollection(run)
        activeCreateRun.current = null
        resetCancelledReport()
    }

    // Shows a collection run and carries on with its outcome: a run started here or one picked back up
    // after the contact email screen.
    function attachCollection(run) {
        reportScreen = "reportingBug"
        reportStatus = run.slow ? "slowFetch" : "fetching"
        activeIndex = 0
        failure = null
        isFinishing = false
        draftInfo = null
        const hold = activeCreateRun
        run.onSlow = () => {
            if (report.alive && hold.current === run) report.reportStatus = "slowFetch"
        }
        // A bubble that closed for the contact email screen let go of the run; the one that picked it up
        // handles the outcome instead.
        ReportLib.holdRun(hold, run, outcome => {
            run.onSlow = null
            // Cancelled: the UI was already reset by cancelCreateReport.
            if (!outcome || !report.alive) return
            if (outcome.failure) {
                report.failSubmission(outcome.failure, outcome.error)
                return
            }
            report.draftInfo = outcome.draft
            report.reportStatus = "submitting"
            report.submitReport(outcome.draft)
        })
    }

    function submitReport(draft) {
        reportStatus = "submitting"
        failure = null
        ReportFlow.submit(owner, draft, contactEmail)
    }

    function beginReport() {
        const knownEmail = savedEmail
        contactEmail = knownEmail
        const run = ReportFlow.startCollection(selectedIssueTimestamp)
        attachCollection(run)
        if (knownEmail !== null) return
        // No address on file: ask for one on a full screen while the machine collects. The run outlives
        // this bubble and is picked up again when the contact email screen reopens it; this bubble lets go
        // of it now, as it still renders through its closing animation. Gestures stay blocked until the
        // bubble has closed, so the release of this press cannot type on the keyboard.
        ReportLib.reportHandoff.detach(activeCreateRun)
        Nav.setBubbleDisplay({ visible: false, component: "", interceptsGesture: true })
        Nav.setScreen("reportContactEmail")
    }

    // "Your contact info": change the saved address on the full screen route. The bubble comes back on
    // that screen once the edit is saved or dropped.
    function editContactEmail(email) {
        ReportLib.contactEmailEdit.open(email)
        Nav.setBubbleDisplay({ visible: false, component: "", interceptsGesture: true })
        Nav.setScreen("reportContactEmail")
    }

    // The hold on "Remove contact info" ran to the end: forget the address and go back to the main
    // screen, where its entry has gone.
    function handleHoldAnimationEnd() {
        holdAnimation = "finished"
        const activeOption = options[activeIndex]
        if (!activeOption || activeOption.key !== "removeContactEmail") return
        BackendSettings.update({ report_contact_mail: null }).then(() => {
            if (!report.alive) return
            report.reportScreen = "message"
            report.activeIndex = 0
        }).catch(() => {})
    }

    function openIssueDateSelector() {
        issueDateDraft = ReportLib.issueDateDraftFrom(selectedIssueTimestamp, Date.now())
        activeIssueDateField = "day"
        activeIndex = 0
        reportScreen = "selectIssueDate"
    }
    function changeIssueDate(direction) {
        issueDateDraft = ReportLib.changeIssueDate(issueDateDraft, activeIssueDateField, direction, Date.now())
    }
    function confirmIssueDate() {
        selectedIssueTimestamp = Math.floor(issueDateDraft.getTime() / 1000)
        reportScreen = "reportSetup"
        reportStatus = "idle"
        activeIndex = 0
    }
    function cancelIssueDateSelection() {
        reportScreen = "reportSetup"
        reportStatus = "idle"
        activeIndex = 0
    }

    // ---- the submission this bubble started
    Connections {
        target: ReportFlow
        function onSubmissionFailed(owner, view) {
            if (owner !== report.owner) return
            report.failure = view
            report.reportStatus = "failed"
            report.isFinishing = false
        }
        function onFinishRequested(owner) { if (owner === report.owner) report.isFinishing = true }
        function onTicketReserved(owner, ticket) { if (owner === report.owner) report.ticket = ticket }
        function onSubmissionSucceeded(owner, ticket) {
            if (owner !== report.owner) return
            report.ticket = ticket
            report.reportScreen = "submitted"
            report.reportStatus = "idle"
        }
    }

    // While busy: the bubble stays pinned and the dial awake.
    onBusyChanged: applyBusy()
    function applyBusy() {
        Nav.setBubblePinned(busy)
        if (busy) Idle.resetTimer()
    }
    Timer {
        interval: 30000
        repeat: true
        running: report.busy
        onTriggered: Idle.resetTimer()
    }

    Component.onCompleted: {
        // The headless upload of the mobile app's reports (see DispatchedReports.qml).
        DispatchedReports.start()
        applyBusy()
        // Back from changing the saved address: reopen where it was pressed.
        if (ReportLib.contactEmailEdit.takeReturn()) {
            reportScreen = "yourContactInfo"
            activeIndex = 0
        }
        // Back from the contact email screen: resume the run left behind with the address given, if any.
        const run = ReportLib.reportHandoff.takeRun()
        const decision = ReportLib.reportHandoff.takeContactDecision()
        if (run) {
            contactEmail = decision && decision.email !== undefined ? decision.email : null
            attachCollection(run)
        }
        // A submission still running from an earlier bubble: show its outcome.
        const pending = ReportFlow.inFlight
        if (pending) {
            reportScreen = "reportingBug"
            reportStatus = "submitting"
            pending.outcome.then(result => {
                if (!report.alive) return
                report.ticket = result.ticket
                if (result.failure) {
                    report.failure = result.failure
                    report.reportStatus = "failed"
                } else {
                    report.reportScreen = "submitted"
                    report.reportStatus = "idle"
                }
            })
        }
    }
    Component.onDestruction: {
        alive = false
        // A run handed over for the contact email screen is no longer held here; it keeps collecting for
        // the bubble that comes back.
        const run = activeCreateRun.current
        if (run) {
            ReportFlow.cancelCollection(run)
            run.onSlow = null
            activeCreateRun.current = null
        }
        Nav.setBubblePinned(false)
    }

    GestureHandler {
        enabled: report.inBubble || !Nav.bubbleInterceptsGesture
        onTurnLeft: {
            if (report.reportScreen === "selectIssueDate") {
                report.changeIssueDate(-1)
                return
            }
            if (report.options.length === 0) return
            report.activeIndex = Math.max(report.activeIndex - 1, 0)
        }
        onTurnRight: {
            if (report.reportScreen === "selectIssueDate") {
                report.changeIssueDate(1)
                return
            }
            if (report.options.length === 0) return
            report.activeIndex = Math.min(report.activeIndex + 1, report.options.length - 1)
        }
        onPressDown: {
            if (report.reportScreen === "selectIssueDate") {
                const i = ReportLib.ISSUE_DATE_FIELDS.indexOf(report.activeIssueDateField)
                report.activeIssueDateField = ReportLib.ISSUE_DATE_FIELDS[(i + 1) % ReportLib.ISSUE_DATE_FIELDS.length]
                return
            }
            const activeOption = report.options[report.activeIndex]
            if (!activeOption || report.reportStatus === "submitting") return
            if (activeOption.hold) {
                report.holdAnimation = "running"
                return
            }
            switch (activeOption.key) {
            case "yourContactInfo":
                report.reportScreen = "yourContactInfo"
                report.reportStatus = "idle"
                report.activeIndex = 0
                break
            case "editContactEmail":
                if (report.savedEmail) report.editContactEmail(report.savedEmail)
                break
            case "contactUs":
                report.reportScreen = "contactUs"
                report.reportStatus = "idle"
                report.activeIndex = 0
                break
            case "reportIssue":
                report.reportScreen = "reportSetup"
                report.reportStatus = "idle"
                report.activeIndex = 0
                break
            case "report":
                report.beginReport()
                break
            case "selectDate":
                report.openIssueDateSelector()
                break
            case "cancel":
                report.cancelCreateReport()
                break
            case "back":
                if (report.reportScreen === "message") report.exitToQuickSettings()
                report.reportScreen = "message"
                report.reportStatus = "idle"
                report.activeIndex = 0
                break
            case "exit":
                report.exitToQuickSettings()
                break
            }
        }
        // Released: a finished hold already acted, an unfinished one is off.
        onPressUp: report.holdAnimation = "stopped"
        onLongEncoder: if (report.reportScreen === "selectIssueDate") report.confirmIssueDate()
        onDoubleClick: if (report.reportScreen === "selectIssueDate") report.cancelIssueDateSelection()
    }

    // ---- layout

    readonly property string layoutKind: busy ? "loading"
        : reportStatus === "failed" && failure ? "failed"
        : (reportScreen === "reportSetup" || reportScreen === "selectIssueDate" || reportScreen === "yourContactInfo") ? "centered"
        : "explanation"
    // "Your contact info" sits higher, clear of the display's curve.
    readonly property real optionsMarginBottom: reportScreen === "yourContactInfo" ? 80 : 50
    readonly property bool optionsShown: options.length > 0 && !(layoutKind === "loading" && reportStatus === "submitting")
    // What the option list leaves above it.
    readonly property real bodyHeight: optionsShown ? 480 - optionsMarginBottom - options.length * 33 : 480

    // .bug-report-eyebrow
    component Eyebrow: CssText {
        color: "#808080"
        font.family: Theme.fontMono
        font.weight: Font.Light
        font.pixelSize: 14
        font.letterSpacing: 2.24
        font.capitalization: Font.AllUppercase
        horizontalAlignment: Text.AlignHCenter
    }
    component Separator: CssText {
        y: 12
        color: "#5e5e5e"
        font.family: Theme.fontMono
        font.weight: Font.Light
        font.pixelSize: 38
        font.letterSpacing: -0.76
        cssLineHeight: 38
    }

    // Loading: the animation and its caption centered above the option list.
    Item {
        visible: report.layoutKind === "loading"
        width: 420
        height: report.bodyHeight
        Column {
            anchors.centerIn: parent
            spacing: 18
            BugReportAnimation {
                anchors.horizontalCenter: parent.horizontalCenter
                size: 100
                phase: report.animationPhase
                onFinished: ReportFlow.finishedAnimationEnded(report.owner)
            }
            CssText {
                anchors.horizontalCenter: parent.horizontalCenter
                width: Math.min(300, implicitWidth)
                text: report.reportStatus === "fetching" ? "Please wait while we compile the necessary information"
                    : report.reportStatus === "slowFetch" ? "This is taking longer than expected, please wait"
                    : report.reportStatus === "submitting" ? "Sending Your report, this may take a moment" : ""
                color: "white"
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                font.pixelSize: 20
                cssLineHeight: 26
            }
        }
    }

    // Failure notice: centered on the panel, the code on its own line to quote back to support.
    Item {
        visible: report.layoutKind === "failed"
        width: 420
        height: report.bodyHeight
        Column {
            id: errorBlock
            anchors.centerIn: parent
            width: Math.min(340, Math.max(eyebrowError.implicitWidth, errorMessage.implicitWidth,
                                          errorNote.visible ? errorNote.implicitWidth : 0, supportNote.implicitWidth, errorCode.implicitWidth))
            spacing: 12
            Eyebrow { id: eyebrowError; width: parent.width; text: "Something went wrong" }
            Item {
                width: parent.width
                height: errorMessage.height + 6
                CssText {
                    id: errorMessage
                    y: 6
                    width: parent.width
                    text: report.failure ? report.failure.message : ""
                    color: "white"
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    font.pixelSize: 22
                    cssLineHeight: 28
                }
            }
            CssText {
                id: errorNote
                visible: !!(report.failure && report.failure.note)
                width: parent.width
                text: report.failure && report.failure.note ? report.failure.note : ""
                color: "#b3b3b3"
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                font.pixelSize: 18
                cssLineHeight: 23
            }
            CssText {
                id: supportNote
                width: parent.width
                text: report.contactSupportNote
                color: "#b3b3b3"
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                font.pixelSize: 18
                cssLineHeight: 23
            }
            Item {
                width: parent.width
                height: errorCode.height + 6
                CssText {
                    id: errorCode
                    y: 6
                    width: parent.width
                    text: "Error code " + (report.failure ? report.failure.code : "")
                    color: Theme.brandYellow
                    horizontalAlignment: Text.AlignHCenter
                    font.family: Theme.fontMono
                    font.weight: Font.Light
                    font.pixelSize: 16
                    font.letterSpacing: 1.92
                    font.capitalization: Font.AllUppercase
                }
            }
        }
    }

    // Centered screens: report setup, the date picker, your contact info.
    Item {
        visible: report.layoutKind === "centered"
        width: 420
        height: report.bodyHeight
        Column {
            anchors.centerIn: parent
            width: 420

            // ---- report setup
            Eyebrow {
                visible: report.reportScreen === "reportSetup"
                width: parent.width
                text: "Issue date & time"
            }
            Item {
                id: setupDate
                visible: report.reportScreen === "reportSetup"
                width: parent.width
                height: 18 + 126
                readonly property var reportDate: new Date(report.selectedIssueTimestamp === undefined ? Date.now() : report.selectedIssueTimestamp * 1000)
                Column {
                    y: 18
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: 6
                    Row {
                        anchors.horizontalCenter: parent.horizontalCenter
                        Repeater {
                            model: ReportLib.toLabelledParts(ReportLib.formatIssueDate(setupDate.reportDate), ".", ["Day", "Month", "Year"])
                            Row {
                                required property var modelData
                                required property int index
                                Separator { visible: index > 0; text: "." }
                                IssueDateCounter { readOnly: true; label: modelData.label; textValue: modelData.value }
                            }
                        }
                    }
                    Row {
                        anchors.horizontalCenter: parent.horizontalCenter
                        Repeater {
                            model: ReportLib.toLabelledParts(ReportLib.formatIssueTime(setupDate.reportDate), ":", ["Hour", "Min"])
                            Row {
                                required property var modelData
                                required property int index
                                Separator { visible: index > 0; text: ":" }
                                IssueDateCounter { readOnly: true; label: modelData.label; textValue: modelData.value }
                            }
                        }
                    }
                }
            }
            Item {
                visible: report.reportScreen === "reportSetup" && !!report.savedEmail
                width: parent.width
                height: legend.height + 22
                CssText {
                    id: legend
                    y: 22
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: Math.min(340, implicitWidth)
                    text: "We will reach you back at " + (report.savedEmail || "")
                    color: "#808080"
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WrapAtWordBoundaryOrAnywhere
                    font.pixelSize: 16
                    cssLineHeight: 20.8
                }
            }

            // ---- the picker
            Eyebrow {
                visible: report.reportScreen === "selectIssueDate"
                width: parent.width
                text: "Guide us to when the issue occurred"
            }
            Item {
                visible: report.reportScreen === "selectIssueDate"
                width: parent.width
                height: 20 + 126
                Column {
                    y: 20
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: 6
                    Row {
                        anchors.horizontalCenter: parent.horizontalCenter
                        IssueDateCounter { active: report.activeIssueDateField === "day"; label: "Day"; value: report.issueDateDraft.getDate(); pad: true }
                        Separator { text: "." }
                        IssueDateCounter { active: report.activeIssueDateField === "month"; label: "Month"; value: report.issueDateDraft.getMonth() + 1; pad: true }
                        Separator { text: "." }
                        IssueDateCounter { active: report.activeIssueDateField === "year"; label: "Year"; value: report.issueDateDraft.getFullYear(); maxDigits: 4 }
                    }
                    Row {
                        anchors.horizontalCenter: parent.horizontalCenter
                        IssueDateCounter { active: report.activeIssueDateField === "hours"; label: "Hour"; value: report.issueDateDraft.getHours(); pad: true }
                        Separator { text: ":" }
                        IssueDateCounter { active: report.activeIssueDateField === "minutes"; label: "Min"; value: report.issueDateDraft.getMinutes(); pad: true }
                    }
                }
            }
            Item {
                visible: report.reportScreen === "selectIssueDate"
                width: parent.width
                height: 30 + hints.height
                GestureHints {
                    id: hints
                    y: 30
                    anchors.horizontalCenter: parent.horizontalCenter
                    hints: [{ input: "Press", action: "Change field" }, { input: "Long press", action: "Confirm" },
                            { input: "Double press", action: "Back" }]
                }
            }

            // ---- your contact info
            Eyebrow {
                visible: report.reportScreen === "yourContactInfo"
                width: parent.width
                text: "Your contact info"
            }
            Item {
                visible: report.reportScreen === "yourContactInfo"
                width: parent.width
                height: copy.height + 12
                CssText {
                    id: copy
                    y: 12
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: 320
                    text: "We reach you back about your reports at the address below. Press it to change it, or hold the option under it to forget it."
                    color: "white"
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    font.pixelSize: 20
                    cssLineHeight: 26
                }
            }
        }
    }

    // The explanation screens: the message, the QR code, the ticket.
    Item {
        visible: report.layoutKind === "explanation"
        width: 420
        height: 480

        ExplanationText {
            visible: report.reportScreen !== "contactUs"
            x: 20
            y: 20
            paragraphs: report.reportScreen === "message" ? [
                { marginTop: 6, text: "This action will send debug data and provide You with a <b>bug report number</b>." },
                { marginTop: 6, text: "Click on <b>contact us</b> to display QR coded contact information or <b>report an issue</b> to continue." },
                { marginTop: 6, text: "We strongly recommend reporting from the mobile app" }
            ] : report.reportScreen === "submitted" ? [
                { marginTop: 10, text: "Thanks for Your feedback" },
                { marginTop: 10, text: "Your report has been generated with ticket number <b>" + (report.ticket === null || report.ticket === undefined ? "" : report.ticket) + "</b>. You can ask for information about it by contacting support." }
            ] : []
        }

        // QrGeneratedImage: react-qr-code (256 px, level L) on a white 16 px border, the caption under it.
        Item {
            visible: report.reportScreen === "contactUs"
            readonly property real boxWidth: Math.max(288, qrCaption.implicitWidth + 20)
            x: 20 + (400 - boxWidth) / 2
            y: 20
            width: boxWidth
            height: 288 + 31
            Rectangle {
                x: (parent.width - 288) / 2
                width: 288
                height: 288
                color: "white"
                QrCode {
                    x: 16
                    y: 16
                    width: 256
                    height: 256
                    value: report.supportWebsiteUrl
                    level: "L"
                }
            }
            CssText {
                id: qrCaption
                x: 20
                y: 293
                text: "Scan to open Meticulous contact information"
                color: "white"
                font.pixelSize: 16
                cssLineHeight: 26
            }
        }
    }

    BugReportOptions {
        visible: report.optionsShown
        options: report.optionsShown ? report.options : []
        activeIndex: report.activeIndex
        holdAnimation: report.holdAnimation
        marginBottom: report.optionsMarginBottom
        onHoldFinished: report.handleHoldAnimationEnd()
    }
}
