pragma Singleton
// What the settings screens keep between mounts, as their React queries do: the root password
// (useRootPassword, stale after 60 s) and the manufacturing menu (useManufacturingSchema: null when the
// backend answers 204, refetched on every mount, no retry).
import QtQuick
import Dial
import Dial.Native as DialNative

QtObject {
    id: store

    // ---- the Community uploader (Dial.Native's Community; qualified, because inside this directory
    // "Community" is the Community screen). The end-to-end tests put a stand-in with the same API in
    // communityOverride before opening the screens, so that they never ask the real service for a code.
    property var communityOverride: null
    readonly property var community: communityOverride ? communityOverride
                                     : typeof DialNative.Community !== "undefined" ? DialNative.Community : null

    // ---- useRootPassword
    property string rootPassword: ""
    property double rootPasswordAt: 0
    property bool rootPasswordFetching: false

    function fetchRootPassword() {
        if (rootPasswordFetching || (rootPassword && Date.now() - rootPasswordAt < 60000)) return
        rootPasswordFetching = true
        Api.getRootPassword().then(data => {
            rootPasswordFetching = false
            if (data && data.error) throw new Error(data.error)
            if (data && data.status === "success" && data.root_password) {
                rootPassword = data.root_password
                rootPasswordAt = Date.now()
                return
            }
            throw new Error("Invalid response format")
        }).catch(error => {
            rootPasswordFetching = false
            console.error("Error getting root password:", error && error.message ? error.message : error)
        })
    }

    // ---- useManufacturingSchema: { Elements: [{ key, label, options }] } | null
    property var manufacturingSchema: null
    property bool manufacturingSchemaSuccess: false
    property bool manufacturingSchemaLoading: false
    property bool manufacturingSchemaPending: true   // no answer yet (React isLoading on the first fetch)

    function fetchManufacturingSchema() {
        if (manufacturingSchemaLoading) return
        manufacturingSchemaLoading = true
        Api.getManufacturingMenuItems().then(response => {
            manufacturingSchemaLoading = false
            manufacturingSchemaPending = false
            if (response.status === 204) {
                manufacturingSchema = null
                manufacturingSchemaSuccess = true
                return
            }
            if (response.status === 200) {
                manufacturingSchema = response.data
                manufacturingSchemaSuccess = true
                return
            }
            throw new Error("Unexpected response status: " + response.status)
        }).catch(error => {
            manufacturingSchemaLoading = false
            manufacturingSchemaPending = false
            manufacturingSchemaSuccess = false
            console.error("Failed to fetch manufacturing schema:", error && error.message ? error.message : error)
        })
    }
}
