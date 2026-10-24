pragma Singleton
// src/features/freePour/storage.ts on the Dial's own storage (Native.storageGet / storageSet instead of
// IndexedDB): the local cache of finished Pour Over brews, newest first by completedAt, and the queue of
// those the backend has not stored yet. Every function answers a Promise, as the async React functions do.
//
//   saveFreePourSession(session)       cache it, queue it, POST it to /history/pour-over, unqueue it
//   getFreePourSessions(limit = 50)    the cached brews, newest first
//   getLatestFreePourSession()         the newest of the cached brew and the backend's last one
//   syncPendingFreePourSessions()      up to 10 queued brews to the backend -> { pending, synced }
//
// App.tsx runs syncPendingFreePourSessions() at start; main.qml does it through this singleton:
//   import "Dial/screens/freepour" as FreePour
//   FreePour.FreePourStorage.syncPendingFreePourSessions()
import QtQuick
import Dial
import Dial.Native
import "HistoryApi.js" as HistoryApi
import "Logging.js" as Log

QtObject {
    id: storage

    // The IndexedDB database and stores of the React Dial, as storage keys.
    readonly property string sessionsKey: "meticulous-brew-history/brew-sessions"
    readonly property string pendingKey: "meticulous-brew-history/pending-backend-sessions"
    // React keeps 128 brews. Native storage is one JSON file rewritten on every storageSet (by any feature),
    // and a brew carries up to 3000 samples: 16 keeps that file small. The backend holds the full history
    // and the Dial only ever shows the newest brew.
    readonly property int maxLocalSessions: 16
    readonly property int maxPendingSyncPerRun: 10

    property var latestSessionCache: null

    function _readSessions() {
        const value = Native.storageGet(sessionsKey, [])
        return Array.isArray(value) ? value : []
    }
    function _readPending() {
        const value = Native.storageGet(pendingKey, [])
        return Array.isArray(value) ? value.filter(p => p && p.id !== undefined) : []
    }
    // The 'completedAt' index walked backwards: newest first, ties by id (the primary key) descending.
    function _newestFirst(a, b) {
        const ca = String(a.completedAt), cb = String(b.completedAt)
        if (ca !== cb) return ca < cb ? 1 : -1
        const ia = String(a.id), ib = String(b.id)
        return ia === ib ? 0 : (ia < ib ? 1 : -1)
    }

    function cacheSession(session, queueForBackend) {
        latestSessionCache = session
        return new Promise(resolve => {
            let sessions = _readSessions().filter(item => item.id !== session.id)
            sessions.push(session)
            sessions.sort(_newestFirst)
            let pending = _readPending()
            let pendingChanged = false
            if (queueForBackend) {
                pending = pending.filter(item => item.id !== session.id)
                pending.push({ id: session.id, queuedAt: Date.now() })
                pendingChanged = true
            }
            if (sessions.length > maxLocalSessions) {
                const dropped = sessions.slice(maxLocalSessions).map(item => item.id)
                sessions = sessions.slice(0, maxLocalSessions)
                const kept = pending.filter(item => dropped.indexOf(item.id) < 0)
                if (kept.length !== pending.length) { pending = kept; pendingChanged = true }
            }
            Native.storageSet(sessionsKey, sessions)
            if (pendingChanged) Native.storageSet(pendingKey, pending)
            resolve()
        })
    }

    function markBackendPersisted(sessionId) {
        const pending = _readPending()
        const kept = pending.filter(item => String(item.id) !== String(sessionId))
        if (kept.length !== pending.length) Native.storageSet(pendingKey, kept)
        return Promise.resolve()
    }

    function saveFreePourSession(session) {
        return cacheSession(session, true)
            .then(() => HistoryApi.persistFreePourSession(Api, session))
            .then(() => markBackendPersisted(session.id))
    }

    function getFreePourSessions(limit) {
        if (limit === undefined) limit = 50
        return Promise.resolve(_readSessions().slice(0, limit))
    }

    function _getSessionById(sessionId) {
        return _readSessions().find(item => String(item.id) === String(sessionId)) || null
    }

    function getLatestFreePourSession() {
        const local = latestSessionCache !== null ? latestSessionCache : (_readSessions()[0] || null)
        return HistoryApi.getLatestBackendFreePourSession(Api).then(backend => {
            if (backend && (!local || new Date(backend.completedAt).getTime() > new Date(local.completedAt).getTime()))
                return cacheSession(backend, false).then(() => backend)
            return local
        }).catch(() => {
            // The local cache remains usable while the backend is starting or offline.
            return local
        })
    }

    function syncPendingFreePourSessions() {
        // getAllKeys(): the queued ids in key order.
        const pendingIds = _readPending().map(item => String(item.id)).sort()
        const attemptIds = pendingIds.slice(0, maxPendingSyncPerRun)
        let synced = 0
        let chain = Promise.resolve()
        for (const sessionId of attemptIds) {
            chain = chain.then(() => {
                const session = _getSessionById(sessionId)
                if (!session) return markBackendPersisted(sessionId)
                return HistoryApi.persistFreePourSession(Api, session).then(() => {
                    synced += 1
                    return markBackendPersisted(sessionId)
                }, () => {
                    // Keep this session pending for the next startup or completed brew.
                })
            })
        }
        return chain.then(() => ({ pending: pendingIds.length - synced, synced: synced }))
    }

    // App.tsx's start-up call, with its logging.
    function syncAtStartup() {
        return syncPendingFreePourSessions().then(result => {
            if (result.pending || result.synced)
                Log.logFreePour("backend_history_sync_completed", { pending: result.pending, synced: result.synced })
            return result
        }).catch(error => Log.logFreePourError("backend_history_sync_failed", error))
    }
}
