.pragma library
// Which response of the shown notification is selected, and what a press acknowledges (Notification.qml),
// kept out of the QML so it can be tested (qt/tests/js/notificationSelection.test.mts).
//
// The notification screen stays up while notifications are stacked and always shows the newest one, so the
// notification under the knob can change between two inputs: a new one arrives on top, or the shown one is
// answered and an older one comes back. Input meant for the previous notification must not answer the new
// one. An access request (device authorization) sends its responses as ["Deny", "Allow"] so that a stray
// press denies; that only holds when a newly shown notification starts on its first response.

// How long presses are ignored once a different notification takes the screen: long enough for a press
// already on its way to the previous notification (a push lasts ~300 ms from pressDown to click), short
// enough not to be noticed by someone who reads the new one before answering.
const PRESS_GUARD_MS = 600

// Whether the screen now shows a different notification than `previousId` (ids as strings, "" for none).
// An update of the shown notification keeps its id (Notifications.addOne merges it in place).
function takesScreen(previousId, id) {
    return String(id) !== String(previousId)
}

// The selected response once notification `id` is shown: its first response when it just took the screen,
// otherwise the selection, kept within its responses (an update can drop some).
function selectionAfter(previousId, id, selected, responseCount) {
    if (takesScreen(previousId, id)) return 0
    const last = Math.max(0, (Number(responseCount) || 0) - 1)
    const s = Math.floor(Number(selected) || 0)
    return Math.min(Math.max(0, s), last)
}

// What a press acknowledges: { id, response } for the shown notification and its selected response, or
// null while there is none or while presses are ignored (`armed` false, PRESS_GUARD_MS after it took the
// screen). A notification without responses is acknowledged with `response` undefined, as before.
function pressAcknowledgement(notification, selected, armed) {
    if (!notification || !armed) return null
    const responses = notification.responses
    return { id: notification.id, response: responses ? responses[selected] : undefined }
}
