// What qt/tests/e2e/test_freepour.py needs of FreePourStorage (a singleton of this directory, which the test
// port's eval cannot name): created through the test port under the window's canvas, found by objectName.
// The asynchronous answers land in `lastSync` / `lastLatest` as JSON.
import QtQuick
import Dial
import Dial.Native
import "ProfileContract.js" as Contract

Item {
    visible: false
    property string lastSync: ""
    property string lastLatest: ""

    function pendingIds() { return JSON.stringify(FreePourStorage._readPending().map(p => p.id)) }
    function cachedIds() { return JSON.stringify(FreePourStorage._readSessions().map(s => s.id)) }
    // A finished brew the backend never got: cached and queued, as when the POST failed.
    function queueWithoutSaving(sessionJson) {
        FreePourStorage.cacheSession(JSON.parse(sessionJson), true)
        return "queued"
    }
    function syncPending() {
        lastSync = ""
        FreePourStorage.syncPendingFreePourSessions().then(result => { lastSync = JSON.stringify(result) },
                                                          error => { lastSync = "error " + error })
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
    function clearLocal() {
        Native.storageRemove(FreePourStorage.sessionsKey)
        Native.storageRemove(FreePourStorage.pendingKey)
        FreePourStorage.latestSessionCache = null
        return "cleared"
    }
}
