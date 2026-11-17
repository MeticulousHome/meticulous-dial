// One react-query query (useQuery) as the Wi-Fi hooks use it (src/hooks/useWifi.tsx): shared data that
// the screens observe while mounted. A new observer refetches stale data (staleTime; refetchOnMount
// "always" refetches anyway); the query polls every refetchInterval while observed (idleInterval when
// every observer is idle); a failed fetch is retried 3 times (1 s, 2 s, 4 s) before `error` is set; the data
// is dropped 5 minutes after the last observer left (gcTime).
import QtQuick

QtObject {
    id: query

    // (none) => Promise of the data; rejects with { message }.
    property var fetchFn: null
    property int staleTime: 0
    property int refetchInterval: 5000
    property int idleInterval: refetchInterval
    property bool refetchOnMountAlways: false
    property int retries: 3
    property int gcTime: 5 * 60 * 1000

    property var data: null
    property double dataUpdatedAt: 0
    property bool isFetching: false
    property var error: null
    readonly property bool hasData: data !== null && data !== undefined
    // isLoading: no data yet and the first fetch in flight; isSuccess: data and no error.
    readonly property bool isLoading: !hasData && error === null && isFetching
    readonly property bool isSuccess: hasData && error === null

    property var _observers: ({})
    property int _observerCount: 0
    property int _nextToken: 1
    property int _generation: 0
    property bool _invalidated: false

    // An observer (a mounted screen): returns the token for unobserve().
    function observe(idle) {
        const token = _nextToken++
        const next = Object.assign({}, _observers)
        next[token] = !!idle
        _observers = next
        _observerCount++
        _gc.stop()
        _updatePolling()
        if (refetchOnMountAlways || isStale()) fetch()
        return token
    }
    function unobserve(token) {
        if (!(token in _observers)) return
        const next = Object.assign({}, _observers)
        delete next[token]
        _observers = next
        _observerCount--
        _updatePolling()
        if (_observerCount === 0) _gc.restart()
    }

    function isStale() { return !hasData || _invalidated || Date.now() - dataUpdatedAt >= staleTime }

    // refetch(): a fetch unless one is in flight.
    function fetch() {
        if (isFetching || !fetchFn) return
        isFetching = true
        _attempt(++_generation, 0)
    }
    function refetch() { fetch() }

    // invalidateQueries: stale now, and refetched (cancelling a fetch in flight) while observed.
    function invalidate() {
        _invalidated = true
        if (_observerCount === 0) return
        cancel()
        fetch()
    }

    // cancelQueries: the fetch in flight is dropped; the data stays as it was.
    function cancel() {
        _generation++
        isFetching = false
    }

    // setQueryData(updater)
    function setData(updater) {
        data = typeof updater === "function" ? updater(data) : updater
        dataUpdatedAt = Date.now()
        _invalidated = false
    }

    function _attempt(generation, failureCount) {
        fetchFn().then(result => {
            if (generation !== _generation) return
            data = result
            dataUpdatedAt = Date.now()
            error = null
            _invalidated = false
            isFetching = false
        }, failure => {
            if (generation !== _generation) return
            if (failureCount < retries) {
                _later(Math.min(1000 * Math.pow(2, failureCount), 30000), () => {
                    if (generation === _generation) _attempt(generation, failureCount + 1)
                })
                return
            }
            error = failure || { message: "" }
            isFetching = false
        })
    }

    function _updatePolling() {
        let anyActive = false
        for (const k in _observers) if (!_observers[k]) anyActive = true
        _poll.interval = anyActive ? refetchInterval : idleInterval
        if (_observerCount > 0) _poll.restart()
        else _poll.stop()
    }

    property Component _timerComponent: Component { Timer { repeat: false } }
    function _later(ms, fn) {
        const t = _timerComponent.createObject(query, { interval: ms })
        t.triggered.connect(() => { t.destroy(); fn() })
        t.start()
    }

    property Timer _poll: Timer {
        repeat: true
        onTriggered: query.fetch()
    }
    property Timer _gc: Timer {
        interval: query.gcTime
        onTriggered: {
            query._generation++
            query.data = null
            query.dataUpdatedAt = 0
            query.error = null
            query.isFetching = false
        }
    }
}
