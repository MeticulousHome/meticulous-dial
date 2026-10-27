// The contact email, full screen (src/components/BugReport/ReportContactEmail.tsx, reportContactEmail.css),
// reached two ways:
//  - from the bug report bubble when a report is filed without a saved `report_contact_mail`: the machine
//    collects meanwhile and the answer goes back through ReportLib.reportHandoff. A long press backs out to
//    a screen that says we cannot reach back, with "Ok" or "Enter email" to return;
//  - from the bubble's "Your contact info", to change the saved address (ReportLib.contactEmailEdit):
//    starts on the confirm step with the address split up, and a long press drops the edit.
// Steps: a keyboard for the part before the "@" (typing "@" or pressing ok moves on), the common domains
// with "Custom" (keyboard with the "@" prefix) and a backspace to the first keyboard, then a confirm step
// that shows the whole address and lets the knob pick a part to edit again.
import QtQuick
import Dial
import "ReportLib.js" as ReportLib

Item {
    id: screen
    anchors.fill: parent

    // The screen under the bubble when this was opened.
    property string returnScreen: "profileHome"
    // Set when opened from "Your contact info" to change the saved address.
    property var edit: null
    property string step: "local"     // local | domain | custom | confirm | declined
    property string localPart: ""
    property string domain: ""
    property int activeIndex: 0
    // What the keyboard on screen started with (CircleKeyboard's defaultValue).
    property string keyboardSeed: ""
    // Where "Enter email" on the declined screen returns to.
    property string declinedFrom: "local"
    property bool saving: false
    property bool alive: true

    readonly property int listLength: step === "domain" ? ReportLib.DOMAIN_OPTIONS.length
                                    : step === "confirm" ? ReportLib.CONFIRM_FOCUS.length
                                    : step === "declined" ? ReportLib.DECLINED_ACTIONS.length : 0
    readonly property string confirmFocus: ReportLib.CONFIRM_FOCUS[activeIndex] || "ok"
    readonly property var longPressHint: ({ input: "Long press", action: edit ? "Cancel" : "Skip" })

    // For the end-to-end tests.
    readonly property string dialProbe_contactStep: step
    readonly property string dialProbe_contactDraft: localPart + "@" + domain
    readonly property string dialFocusedLabel: step === "domain" ? ReportLib.DOMAIN_OPTIONS[activeIndex]
                                             : step === "confirm" ? confirmFocus
                                             : step === "declined" ? ReportLib.DECLINED_ACTIONS[activeIndex].label : ""

    Component.onCompleted: {
        returnScreen = Nav.prev || "profileHome"
        edit = ReportLib.contactEmailEdit.take()
        if (edit) {
            const parts = ReportLib.splitEmail(edit.email)
            localPart = parts.localPart
            domain = parts.domain
            step = "confirm"
        } else {
            Idle.resetTimer()
        }
    }
    Component.onDestruction: alive = false

    // The machine is collecting underneath; the dial must not go idle on it.
    Timer {
        interval: 30000
        repeat: true
        running: !screen.edit
        onTriggered: Idle.resetTimer()
    }

    function returnToBubble() {
        Nav.setScreen(returnScreen)
        Nav.setBubbleDisplay({ visible: true, component: "bug-report" })
    }

    function finish(email) {
        if (edit) {
            if (saving) return
            saving = true
            // Waited on so the bubble shows the new address when it comes back.
            BackendSettings.update({ report_contact_mail: email }).catch(() => {
                // Logged by the store; the previous address stays on file.
            }).then(() => {
                ReportLib.contactEmailEdit.markReturn()
                if (screen.alive) screen.returnToBubble()
            })
            return
        }
        // Saved for next time regardless of how this report ends. A failed save only costs asking again on
        // the next report.
        if (email) BackendSettings.update({ report_contact_mail: email }).catch(() => {})
        ReportLib.reportHandoff.setContactDecision(email)
        returnToBubble()
    }

    // Long press, or the keyboard's cancel key. Reporting: offer to go on without an address. Editing:
    // drop the change.
    function bail() {
        if (edit) {
            ReportLib.contactEmailEdit.markReturn()
            returnToBubble()
            return
        }
        if (step !== "declined") declinedFrom = step
        activeIndex = 0
        step = "declined"
    }

    function openLocalPart() {
        keyboardSeed = localPart
        step = "local"
    }
    function openDomainList() {
        activeIndex = ReportLib.domainIndexFor(domain)
        step = "domain"
    }
    // The custom keyboard starts from `seed`: a custom domain already on the draft, or what was typed
    // before a long press. Never a listed domain.
    function openCustomDomain(seed) {
        domain = seed
        keyboardSeed = seed
        step = "custom"
    }
    function openConfirm() {
        activeIndex = 0
        step = "confirm"
    }

    function localPartTyped(text) {
        if (text.indexOf("@") < 0) {
            localPart = text
            return
        }
        // "@" ends this part and moves on to the domain. On an empty address it is dropped and the keyboard
        // cleared instead.
        const local = ReportLib.stripSpaces(text.replace(/@/g, ""))
        localPart = local
        if (!local) {
            resetKeyboard("")
            return
        }
        openDomainList()
    }
    function submitLocalPart(text) {
        const local = ReportLib.stripSpaces(text).replace(/@/g, "")
        if (!local) return
        localPart = local
        openDomainList()
    }
    function chooseDomainOption(index) {
        const choice = ReportLib.DOMAIN_OPTIONS[index]
        if (choice === ReportLib.BACKSPACE_LABEL) {
            openLocalPart()
            return
        }
        if (choice === ReportLib.CUSTOM_DOMAIN_LABEL) {
            openCustomDomain(ReportLib.isListedDomain(domain) ? "" : domain)
            return
        }
        domain = choice
        openConfirm()
    }
    function submitCustomDomain(text) {
        const d = ReportLib.stripSpaces(text).replace(/@/g, "")
        if (!d) return
        domain = d
        openConfirm()
    }
    function confirmPressed() {
        if (confirmFocus === "local") openLocalPart()
        else if (confirmFocus === "domain") openDomainList()
        else finish(localPart + "@" + domain)
    }
    // "Enter email" on the declined screen: back to where the long press happened, with whatever was
    // typed so far.
    function returnFromDeclined() {
        if (declinedFrom === "local") openLocalPart()
        else if (declinedFrom === "custom") openCustomDomain(domain)
        else if (declinedFrom === "domain") openDomainList()
        else openConfirm()
    }

    // CircleKeyboard resets its caption whenever its defaultValue is replaced (a new array in React, even an
    // equal one); a string equal to the current seed changes nothing, so the keyboard is reset explicitly.
    function resetKeyboard(seed) {
        const kb = keyboardLoader.item
        const same = keyboardSeed === seed
        keyboardSeed = seed
        if (kb && same) kb.reset(seed)
    }

    // The keyboard steps own the encoder; this drives the lists and the confirm step, where the focus
    // wraps around.
    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onTurnLeft: {
            if (screen.listLength === 0) return
            screen.activeIndex = screen.step === "confirm" ? (screen.activeIndex + screen.listLength - 1) % screen.listLength
                                                           : Math.max(screen.activeIndex - 1, 0)
        }
        onTurnRight: {
            if (screen.listLength === 0) return
            screen.activeIndex = screen.step === "confirm" ? (screen.activeIndex + 1) % screen.listLength
                                                           : Math.min(screen.activeIndex + 1, screen.listLength - 1)
        }
        onPressDown: {
            if (screen.step === "domain") screen.chooseDomainOption(screen.activeIndex)
            else if (screen.step === "confirm") screen.confirmPressed()
            else if (screen.step === "declined") {
                if (ReportLib.DECLINED_ACTIONS[screen.activeIndex].key === "ok") screen.finish(null)
                else screen.returnFromDeclined()
            }
        }
        onLongEncoder: if (screen.step === "domain" || screen.step === "confirm") screen.bail()
    }

    // ---- the keyboard steps
    Loader {
        id: keyboardLoader
        anchors.fill: parent
        active: screen.step === "local" || screen.step === "custom"
        sourceComponent: screen.step === "local" ? localKeyboard : screen.step === "custom" ? customKeyboard : null
    }
    Component {
        id: localKeyboard
        CircleKeyboard {
            name: "email to reach you back"
            defaultValue: screen.keyboardSeed
            suffix: "@"
            capitalizeFirstLetter: false
            longPressEnabled: true
            onEdited: (text) => screen.localPartTyped(text)
            onSubmitted: (text) => screen.submitLocalPart(text)
            onCancelled: screen.bail()
            onLongPressed: screen.bail()
        }
    }
    Component {
        id: customKeyboard
        CircleKeyboard {
            name: "domain for " + screen.localPart
            defaultValue: screen.keyboardSeed
            prefix: "@"
            capitalizeFirstLetter: false
            longPressEnabled: true
            onEdited: (text) => { screen.domain = text }
            onSubmitted: (text) => screen.submitCustomDomain(text)
            onCancelled: screen.bail()
            onLongPressed: screen.bail()
        }
    }

    // ---- the list steps (.report-contact-screen: padding 48 56 52, a centered column 14 px apart)
    component Eyebrow: CssText {
        width: 368
        horizontalAlignment: Text.AlignHCenter
        color: "#808080"
        font.family: Theme.fontMono
        font.weight: Font.Light
        font.pixelSize: 14
        font.letterSpacing: 2.24
        font.capitalization: Font.AllUppercase
    }
    component Option: Pill {
        fontSize: 20
        padV: 8
        padH: 16
        // min-width 140 px with border-box sizing
        minContentWidth: 140 - 32 - 4
    }

    Column {
        visible: !keyboardLoader.active
        x: 56
        width: 368
        y: 48 + (380 - height) / 2
        spacing: 14

        Eyebrow {
            text: screen.step === "domain" ? "Your email domain"
                : screen.step === "confirm" ? (screen.edit ? "Your contact email" : "Confirm your email")
                : "No contact email"
        }

        // ---- domain
        CssText {
            visible: screen.step === "domain"
            width: 368
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WrapAnywhere
            text: screen.localPart + "@"
            font.family: Theme.fontMono
            font.bold: true
            font.pixelSize: 28
        }
        Item {
            visible: screen.step === "domain"
            width: 368
            height: domainGrid.height + 4
            Grid {
                id: domainGrid
                y: 4
                columns: 2
                columnSpacing: 10
                rowSpacing: 8
                Repeater {
                    model: ReportLib.BACKSPACE_INDEX
                    Option {
                        required property int index
                        width: (368 - 10) / 2
                        active: index === screen.activeIndex
                        text: ReportLib.DOMAIN_OPTIONS[index] === ReportLib.CUSTOM_DOMAIN_LABEL
                              ? ReportLib.DOMAIN_OPTIONS[index] : "@" + ReportLib.DOMAIN_OPTIONS[index]
                    }
                }
            }
        }
        // Below the domain grid: back to the email keyboard.
        Option {
            visible: screen.step === "domain"
            anchors.horizontalCenter: parent.horizontalCenter
            minContentWidth: 0
            padV: 6
            padH: 24
            fontSize: 24
            lineHeightFactor: 1.1
            active: screen.activeIndex === ReportLib.BACKSPACE_INDEX
            text: ReportLib.BACKSPACE_LABEL
        }

        // ---- confirm: the address with the part the knob is on lit
        Item {
            id: address
            visible: screen.step === "confirm"
            width: 368
            height: addressLines.height
            readonly property real localWidth: Math.min(368, localMeasure.implicitWidth)
            readonly property real domainWidth: Math.min(368, domainMeasure.implicitWidth)
            readonly property real atWidth: atText.implicitWidth
            // Greedy lines of [local][@][domain], each centered (the parts are inline blocks).
            readonly property var lines: {
                const items = [["local", localWidth], ["at", atWidth], ["domain", domainWidth]]
                const out = [[]]
                let used = 0
                items.forEach(it => {
                    if (used > 0 && used + it[1] > 368) {
                        out.push([])
                        used = 0
                    }
                    out[out.length - 1].push(it[0])
                    used += it[1]
                })
                return out
            }
            CssText { id: localMeasure; visible: false; text: screen.localPart; font.family: Theme.fontMono; font.bold: true; font.pixelSize: 24 }
            CssText { id: domainMeasure; visible: false; text: screen.domain; font.family: Theme.fontMono; font.bold: true; font.pixelSize: 24 }
            Column {
                id: addressLines
                width: 368
                Repeater {
                    model: address.lines.length
                    Row {
                        required property int index
                        anchors.horizontalCenter: parent.horizontalCenter
                        Repeater {
                            model: address.lines[parent.index]
                            Item {
                                required property string modelData
                                readonly property bool isAt: modelData === "at"
                                readonly property bool lit: !isAt && screen.confirmFocus === modelData
                                width: isAt ? address.atWidth : (modelData === "local" ? address.localWidth : address.domainWidth)
                                height: partText.height + (isAt ? 0 : 4)
                                CssText {
                                    id: partText
                                    width: parent.width
                                    horizontalAlignment: Text.AlignHCenter
                                    wrapMode: Text.WrapAnywhere
                                    text: parent.isAt ? "@" : (parent.modelData === "local" ? screen.localPart : screen.domain)
                                    color: parent.isAt ? "#808080" : parent.lit ? Theme.brandYellow : "#e7e7e7"
                                    font.family: Theme.fontMono
                                    font.bold: true
                                    font.pixelSize: 24
                                }
                                Rectangle {
                                    visible: !parent.isAt
                                    y: partText.height + 2
                                    width: parent.width
                                    height: 2
                                    color: parent.lit ? Theme.brandYellow : "transparent"
                                }
                            }
                        }
                    }
                }
            }
            CssText {
                id: atText
                visible: false
                text: "@"
                font.family: Theme.fontMono
                font.bold: true
                font.pixelSize: 24
            }
        }
        CssText {
            visible: screen.step === "confirm"
            anchors.horizontalCenter: parent.horizontalCenter
            width: Math.min(330, implicitWidth)
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: "Rotate the knob to select which part to edit, your email or its domain."
            color: "#b3b3b3"
            font.pixelSize: 17
            cssLineHeight: 17 * 1.3
        }

        // ---- declined
        CssText {
            visible: screen.step === "declined"
            anchors.horizontalCenter: parent.horizontalCenter
            width: Math.min(340, implicitWidth)
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: "Without an email address we will not be able to reach back to you about this report."
            font.pixelSize: 21
            cssLineHeight: 21 * 1.3
        }

        // ---- the actions (confirm: Ok; declined: Ok / Enter email)
        Item {
            visible: screen.step === "confirm" || screen.step === "declined"
            width: 368
            height: actionsRow.height + 4
            Row {
                id: actionsRow
                y: 4
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: 10
                Option {
                    visible: screen.step === "confirm"
                    active: screen.confirmFocus === "ok"
                    text: "Ok"
                }
                Repeater {
                    model: screen.step === "declined" ? ReportLib.DECLINED_ACTIONS.length : 0
                    Option {
                        required property int index
                        active: index === screen.activeIndex
                        text: ReportLib.DECLINED_ACTIONS[index].label
                    }
                }
            }
        }

        Item {
            visible: screen.step === "domain" || screen.step === "confirm"
            width: 368
            height: contactHints.height + 6
            GestureHints {
                id: contactHints
                y: 6
                anchors.horizontalCenter: parent.horizontalCenter
                inputColor: "#e7e7e7"
                dotColor: "#808080"
                dotSize: 4
                rowGap: 6
                hints: screen.step === "domain"
                       ? [{ input: "Press", action: "Select" }, screen.longPressHint]
                       : [{ input: "Press", action: screen.confirmFocus === "ok" ? "Confirm" : "Edit" }, screen.longPressHint]
            }
        }
    }
}
