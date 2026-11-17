// The unlock screen of a machine in limited access (src/components/UnlockScreen/UnlockScreen.tsx,
// src/api/api.ts unlockMachine): the keyboard asks for the unlock code of this serial number. A code that
// looks complete ("met" or five digits) is tried as it is typed; "ok" tries whatever is there. 200 unlocks:
// the settings and profiles are fetched again and the dial goes home. 403 (wrong code) is not tried again
// as typed until it changes; 400, 429, 404 and transport errors leave the keyboard as it is. Cancel goes
// home.
import QtQuick
import Dial

Item {
    id: unlock
    anchors.fill: parent

    property string password: ""
    property bool inFlight: false
    property var lastRejected: null
    property bool alive: true
    Component.onDestruction: alive = false

    // For the end-to-end tests: the last answer ({ ok, status }).
    property var lastResult: null
    readonly property var dialProbe_unlockResult: lastResult

    function looksComplete(code) { return code === "met" || /^\d{5}$/.test(code) }

    // unlockMachine (api.ts): { ok: true, response } for a 200 without an error; { ok: false, status } for
    // 400 / 403 / 429 (the statuses espresso-api resolves) and 404; status 0 for anything else.
    function unlockMachine(code) {
        return Api.unlockMachine(code).then(r => {
            if (r.status === 200 && !(r.data && typeof r.data === "object" && "error" in r.data))
                return { ok: true, response: r.data }
            return { ok: false, status: r.status, error: r.data }
        }).catch(error => {
            const status = error ? error.status : 0
            if (status === 400 || status === 403 || status === 429) return { ok: false, status: status, error: error.data }
            if (status === 404) return { ok: false, status: 404 }
            console.error("unlockMachine error: ", error && error.message)
            return { ok: false, status: 0 }
        })
    }

    function tryUnlock(input, explicit) {
        const code = String(input).trim().toLowerCase()
        if (!code || inFlight) return
        if (!explicit && (!looksComplete(code) || lastRejected === code)) return
        inFlight = true
        unlockMachine(code).then(result => {
            if (!unlock.alive) return
            unlock.lastResult = { ok: result.ok, status: result.ok ? 200 : result.status }
            if (result.ok) {
                return Promise.all([BackendSettings.refetch(), Promise.resolve(Profiles.refetch())]).then(() => {
                    Nav.setScreen("profileHome")
                })
            }
            if (result.status === 403) unlock.lastRejected = code
        }).catch(error => console.error("unlock failed:", error && error.message)).then(() => {
            if (unlock.alive) unlock.inFlight = false
        })
    }

    CircleKeyboard {
        name: "Unlock Code for S/N: " + (Device.info && Device.info.serial !== undefined && Device.info.serial !== null ? Device.info.serial : "LOADING...")
        defaultValue: unlock.password
        onSubmitted: unlock.tryUnlock(unlock.password, true)
        onCancelled: Nav.setScreen("profileHome")
        onEdited: (text) => {
            unlock.password = text
            unlock.tryUnlock(text, false)
        }
    }
}
