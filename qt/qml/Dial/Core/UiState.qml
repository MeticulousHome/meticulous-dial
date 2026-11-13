pragma Singleton
// The small UI-only slices of the React store: settings (country letter / country of the time zone
// picker), wifi (the network being connected or forgotten) and images (profile images picked but not saved).
import QtQuick

QtObject {
    // settings-slice.ts
    property string countryLetter: ""
    property string country: ""

    // wifi-slice.ts
    property string selectedWifi: ""
    property bool selectedWifiUseKnownCredentials: false
    property string selectedWifiToDelete: ""

    // selectWifi(ssid | { ssid, useKnownCredentials })
    function selectWifi(payload) {
        if (typeof payload === "string") {
            selectedWifi = payload
            selectedWifiUseKnownCredentials = false
            return
        }
        selectedWifi = payload.ssid
        selectedWifiUseKnownCredentials = !!payload.useKnownCredentials
    }
    function selectWifiToDelete(ssid) { selectedWifiToDelete = ssid }

    // images-slice.ts: presetId -> { presetId, image, borderColor }
    property var profileImages: ({})
    function addNewImageProfile(item) {
        const next = Object.assign({}, profileImages)
        next[item.presetId] = item
        profileImages = next
    }
    function removeImageProfile(presetId) {
        const next = Object.assign({}, profileImages)
        delete next[presetId]
        profileImages = next
    }
    function clearAllImageProfiles() { profileImages = ({}) }
    function imageProfile(presetId) { return profileImages[presetId] || null }
}
