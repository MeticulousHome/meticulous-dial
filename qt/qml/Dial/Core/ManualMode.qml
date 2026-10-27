pragma Singleton
// Manual mode as the rest of the Dial sees it: useManualBrew (src/hooks/useManualBrew.ts) and
// createProfileFromManualBrew (src/api/manualMode.ts).
//
// A brew is manual when the loaded profile carries `manual: true`, the machine reports it is extracting
// and the active setpoint names one of the two manual controls (pressure or flow).
import QtQuick

QtObject {
    readonly property var activeProfile: (Profiles.lastProfile && Profiles.lastProfile.profile) || Profiles.localProfile || null
    readonly property bool isManualProfile: !!(activeProfile && activeProfile.manual === true)
    readonly property string activeControl: {
        const a = Stats.setpoints ? Stats.setpoints.active : undefined
        return a === "pressure" || a === "flow" ? a : ""
    }
    readonly property bool isManualBrew: isManualProfile && Stats.extracting === true && activeControl !== ""
    readonly property var streamedTarget: {
        if (!activeControl) return undefined
        const v = Stats.setpoints[activeControl]
        return typeof v === "number" ? v : undefined
    }

    // The quick settings remember which manual brew was saved, by its brew time.
    property real savedManualBrewTime: -1

    // POST /api/v1/profile/from_manual: the brew the machine just finished becomes a stored profile.
    function createProfileFromManualBrew(name) {
        return Api.post("/api/v1/profile/from_manual", name ? { name: name } : {})
    }
}
