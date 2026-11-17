// The guided pour-over (src/features/freePour/GuidedPourOverScreen.tsx): reads the selected installed
// profile from the machine (GET /api/v1/pour-over/profile/get/<id>, checked by the profile contract) and
// runs the Free Pour flow with it. Without a selection, or when the machine cannot give a valid profile,
// back to the home. The loading ring shows meanwhile.
import QtQuick
import Dial
import "ProfileApi.js" as ProfileApi
import "Logging.js" as Log

Item {
    id: guided
    anchors.fill: parent
    property bool transitioning: false
    // Tests: the scale reading for the Free Pour flow ({ w, g }).
    property var testScale: null

    property var loadedProfile: null            // { id, profile } | null
    property int _request: 0
    property bool _alive: true

    readonly property var selectedPourOverProfileId: Profiles.selectedPourOverProfileId
    readonly property bool ready: !!loadedProfile && loadedProfile.id === selectedPourOverProfileId
    readonly property string dialProbe_guidedProfileId: ready ? loadedProfile.id : ""

    function load() {
        const request = ++_request
        const profileId = selectedPourOverProfileId
        if (!profileId) {
            loadedProfile = null
            Nav.setScreen("profileHome")
            return
        }
        loadedProfile = null
        ProfileApi.getInstalledPourOverProfile(Api, profileId).then(installedProfile => {
            if (!guided._alive || request !== guided._request) return
            guided.loadedProfile = { id: profileId, profile: installedProfile }
        }).catch(error => {
            if (!guided._alive || request !== guided._request) return
            Log.logFreePourError("guided_profile_load_failed", error, { profile_id: profileId })
            Nav.setScreen("profileHome")
        })
    }
    Component.onCompleted: load()
    Component.onDestruction: _alive = false
    onSelectedPourOverProfileIdChanged: load()

    LoadingScreen {
        visible: !guided.ready
    }
    Loader {
        anchors.fill: parent
        active: guided.ready
        sourceComponent: FreePourScreen {
            profile: guided.loadedProfile.profile
            testScale: guided.testScale
            transitioning: guided.transitioning
        }
    }
}
