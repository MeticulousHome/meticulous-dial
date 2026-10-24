// One react-query mutation (useMutation) owned by a screen: mutate(variables, onSuccess) runs
// fn(variables) and tracks isPending / isError / isSuccess / error / data; reset() clears it. The app's
// QueryClient (App.tsx) retries a failed mutation 3 times (1 s, 2 s, 4 s) unless the hook sets
// retry: false (retries: 0 here); failureReason is the last failure, set while the retries run.
// Only the latest mutate() reports to the screen, and nothing reports after the screen is gone (an
// unmounted observer); the call's own effects (WifiStore invalidating the queries) still happen.
import QtQuick

QtObject {
    id: mutation

    // (variables) => Promise; rejects with { message, code }.
    property var fn: null
    property int retries: 0

    property bool isPending: false
    property bool isError: false
    property bool isSuccess: false
    property var error: null
    property var data: null
    property var failureReason: null
    readonly property bool isIdle: !isPending && !isError && !isSuccess

    property int _generation: 0

    function mutate(variables, onSuccess) {
        const generation = ++_generation
        isPending = true
        isError = false
        isSuccess = false
        error = null
        data = null
        failureReason = null
        _attempt(generation, variables, onSuccess, 0)
    }

    function _attempt(generation, variables, onSuccess, failureCount) {
        fn(variables).then(result => {
            if (!mutation || mutation._generation !== generation) return
            mutation.data = result === undefined ? null : result
            mutation.failureReason = null
            mutation.isPending = false
            mutation.isSuccess = true
            if (onSuccess) onSuccess(result, variables)
        }, failure => {
            if (!mutation || mutation._generation !== generation) return
            mutation.failureReason = failure || { message: "" }
            if (failureCount < mutation.retries) {
                const t = mutation._timerComponent.createObject(mutation, { interval: Math.min(1000 * Math.pow(2, failureCount), 30000) })
                t.triggered.connect(() => {
                    t.destroy()
                    if (mutation && mutation._generation === generation)
                        mutation._attempt(generation, variables, onSuccess, failureCount + 1)
                })
                t.start()
                return
            }
            mutation.error = mutation.failureReason
            mutation.isPending = false
            mutation.isError = true
        })
    }

    function reset() {
        _generation++
        isPending = false
        isError = false
        isSuccess = false
        error = null
        data = null
        failureReason = null
    }

    property Component _timerComponent: Component { Timer { repeat: false } }

    Component.onDestruction: _generation++
}
