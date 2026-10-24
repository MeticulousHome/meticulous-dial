// One react-query mutation (useMutation, retry off) owned by a screen: mutate(variables, onSuccess)
// runs fn(variables) and tracks isPending / isError / isSuccess / error / data; reset() clears it. Only the
// latest mutate() reports to the screen, and nothing reports after the screen is gone (an unmounted
// observer); the call's own effects (WifiStore invalidating the queries) still happen.
import QtQuick

QtObject {
    id: mutation

    // (variables) => Promise; rejects with { message, code }.
    property var fn: null

    property bool isPending: false
    property bool isError: false
    property bool isSuccess: false
    property var error: null
    property var data: null
    readonly property bool isIdle: !isPending && !isError && !isSuccess

    property int _generation: 0

    function mutate(variables, onSuccess) {
        const generation = ++_generation
        isPending = true
        isError = false
        isSuccess = false
        error = null
        data = null
        fn(variables).then(result => {
            if (!mutation || mutation._generation !== generation) return
            mutation.data = result === undefined ? null : result
            mutation.isPending = false
            mutation.isSuccess = true
            if (onSuccess) onSuccess(result, variables)
        }, failure => {
            if (!mutation || mutation._generation !== generation) return
            mutation.error = failure || { message: "" }
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
    }

    Component.onDestruction: _generation++
}
