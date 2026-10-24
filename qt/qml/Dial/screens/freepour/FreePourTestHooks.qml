// What qt/tests/e2e/test_freepour.py needs of FreePourStorage (a singleton of this directory, which the test
// port's eval cannot name): created through the test port under the window's canvas, found by objectName.
// The asynchronous answers land in `lastSave` / `lastSync` / `lastLatest` as JSON.
import QtQuick
import Dial
import Dial.Native
import "ProfileContract.js" as Contract

Item {
    visible: false
    property string lastSave: ""
    property string lastSync: ""
    property string lastLatest: ""
    property int failedRequests: 0

    // Whether anything of the old local cache is in the Dial's storage.
    function legacyKeys() {
        return JSON.stringify([FreePourStorage.legacySessionsKey, FreePourStorage.legacyPendingKey]
                              .filter(k => Native.storageGet(k, null) !== null))
    }
    // The old cache as an older build left it: the brew cached and queued (its POST had failed).
    function plantLegacy(sessionJson) {
        const session = JSON.parse(sessionJson)
        Native.storageSet(FreePourStorage.legacySessionsKey, JSON.stringify([session]))
        Native.storageSet(FreePourStorage.legacyPendingKey, JSON.stringify([{ id: session.id, queuedAt: Date.now() }]))
        return "planted"
    }
    function startupSync() {
        lastSync = ""
        FreePourStorage.syncAtStartup().then(result => { lastSync = JSON.stringify(result) },
                                             error => { lastSync = "error " + error })
        return "started"
    }
    // Saves a brew through a client whose first `failures` requests get no answer (the backend restarting).
    function saveThroughRestart(sessionJson, failures) {
        lastSave = ""
        failedRequests = 0
        let left = failures
        const hooks = this
        FreePourStorage.api = {
            request: function (method, path, body, options) {
                if (left > 0) {
                    left -= 1
                    hooks.failedRequests += 1
                    return Promise.reject({ status: 0, data: null, message: "no answer" })
                }
                return Api.request(method, path, body, options)
            }
        }
        FreePourStorage.saveFreePourSession(JSON.parse(sessionJson)).then(answer => {
            FreePourStorage.api = Api
            lastSave = JSON.stringify({ ok: true, status: answer ? answer.status : null })
        }, error => {
            FreePourStorage.api = Api
            lastSave = JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) })
        })
        return "started"
    }
    function latest() {
        lastLatest = ""
        FreePourStorage.getLatestFreePourSession().then(session => {
            lastLatest = JSON.stringify(session ? { id: session.id, completedAt: session.completedAt } : null)
        }, error => { lastLatest = "error " + error })
        return "started"
    }
    // What main.qml does at start (docs/qt-migration/parity/freepour.md): the contract parser as Profiles'
    // hook, then a refetch of the installed profiles through it.
    function installContract() {
        Profiles.parsePourOverProfile = Contract.parsePourOverProfile
        Profiles.refetchPourOver()
        return "installed"
    }
    function storage() { return FreePourStorage }
}
