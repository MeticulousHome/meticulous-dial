pragma Singleton
// The Pour Over history, kept by the backend only (Alu's decision, docs/qt-migration/DECISIONS.md): the
// backend is the source of truth, as it is for espresso profiles and shots. The React Dial
// (src/features/freePour/storage.ts) also kept the last 128 brews in IndexedDB and a queue of those the
// backend had not taken; the Qt Dial keeps nothing on its own disk. Every function answers a Promise.
//
//   saveFreePourSession(session)   POST it to /history/pour-over, retried briefly while the backend restarts
//   getLatestFreePourSession()     the backend's newest brew (GET /history/pour-over/last, then its file), or null
//   syncAtStartup()                one-off clean-up of the local cache older builds kept (see below)
//
// The retry: only for a backend that does not answer (network error) or answers 5xx, as when it restarts
// (about 8-15 s on the machine; the nightly restart restarts it). Saving tries 4 times over ~14 s, reading
// 3 times over ~3 s; a 4xx is never retried. A brew the backend still does not take is logged
// (session_save_failed) and lost: there is no disk queue.
import QtQuick
import Dial
import Dial.Native
import "HistoryApi.js" as HistoryApi
import "Logging.js" as Log

QtObject {
    id: storage

    readonly property var saveRetryDelaysMs: [2000, 4000, 8000]
    readonly property var readRetryDelaysMs: [1000, 2000]
    // The REST client (the Api singleton); the end-to-end tests swap in one that fails first.
    property var api: Api

    // Retries `attempt` (a function answering a Promise) after each delay while the failure is the backend
    // not answering or answering 5xx.
    function _withRestartRetry(attempt, delays, what) {
        const run = (index) => attempt().catch(error => {
            const status = error && error.status !== undefined ? error.status : 0
            const backendDown = status === 0 || status >= 500
            if (!backendDown || index >= delays.length) throw error
            Log.logFreePour("backend_retry", { what: what, attempt: index + 1, status: status })
            return new Promise(resolve => {
                const timer = Qt.createQmlObject("import QtQml; Timer { repeat: false }", storage)
                timer.interval = delays[index]
                timer.triggered.connect(() => { timer.destroy(); resolve() })
                timer.start()
            }).then(() => run(index + 1))
        })
        return run(0)
    }

    function saveFreePourSession(session) {
        return _withRestartRetry(() => HistoryApi.persistFreePourSession(storage.api, session), saveRetryDelaysMs, "save")
    }

    function getLatestFreePourSession() {
        return _withRestartRetry(() => HistoryApi.getLatestBackendFreePourSession(storage.api), readRetryDelaysMs, "read")
    }

    // Builds before this change kept a local cache and a queue in the Dial's storage (keys of the React
    // IndexedDB names). Once: send what was queued (the backend answers "existing" for a brew it has), then
    // drop both keys. Kept while the backend cannot be reached, so the next start tries again.
    readonly property string legacySessionsKey: "meticulous-brew-history/brew-sessions"
    readonly property string legacyPendingKey: "meticulous-brew-history/pending-backend-sessions"

    function _legacyList(key) {
        const value = Native.storageGet(key, "")
        if (Array.isArray(value)) return value
        if (typeof value !== "string" || !value.length) return []
        try {
            const parsed = JSON.parse(value)
            return Array.isArray(parsed) ? parsed : []
        } catch (error) {
            return []
        }
    }

    function syncAtStartup() {
        const hasLegacy = Native.storageGet(legacySessionsKey, null) !== null || Native.storageGet(legacyPendingKey, null) !== null
        if (!hasLegacy) return Promise.resolve({ sent: 0 })
        const sessions = _legacyList(legacySessionsKey)
        const pendingIds = _legacyList(legacyPendingKey).filter(p => p && p.id !== undefined).map(p => String(p.id))
        const queued = sessions.filter(s => s && pendingIds.indexOf(String(s.id)) >= 0)
        let chain = Promise.resolve()
        for (const session of queued)
            chain = chain.then(() => saveFreePourSession(session))
        return chain.then(() => {
            Native.storageRemove(legacySessionsKey)
            Native.storageRemove(legacyPendingKey)
            Log.logFreePour("legacy_local_history_removed", { cached: sessions.length, sent: queued.length })
            return { sent: queued.length }
        }).catch(error => {
            Log.logFreePourError("legacy_local_history_send_failed", error, { queued: queued.length })
            return { sent: 0, error: String(error && error.message ? error.message : error) }
        })
    }
}
