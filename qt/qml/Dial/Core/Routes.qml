pragma Singleton
// The route table of the React Dial (src/navigation/routes.ts), in the same order: the order decides the
// direction of a transition (a later route enters "in", an earlier one "out") unless
// animationDirectionFrom says otherwise.
//
// title / parentTitle: a string, a function of the stores returning a string, or one of the title pills:
//   profilesTitle (getProfilesTitle) and activeProfilesTitle (getActiveProfilesTitle), which the React
//   Router compares by identity (Router.tsx hides the latter while a profile is being created).
import QtQuick

QtObject {
    id: routes

    readonly property var profilesTitle: ({ pill: "profiles", name: "getProfilesTitle" })
    readonly property var activeProfilesTitle: ({ pill: "profiles", name: "getActiveProfilesTitle" })

    // selectStatProfileName: the profile of the "start" event may not exist on the Dial.
    function selectStatProfileName() { return Stats.profile === undefined || Stats.profile === null ? "" : String(Stats.profile) }
    function selectPurgeTitle() {
        if (Stats.name === "brewing" && Stats.profile !== "Init Profile") return Stats.profile
        if (Profiles.mergedProfiles && Profiles.profileStarting && Profiles.mergedProfiles[Profiles.localProfileIndex])
            return Profiles.mergedProfiles[Profiles.localProfileIndex].name
        if (Stats.name === "home") return "Raising"
        return "Purging"
    }

    function s(path) { return Qt.resolvedUrl("../screens/" + path) }

    readonly property var order: [
        "deviceInfoQR", "masterCalibrationLock", "timeZoneConfig", "timeDate", "timeConfig", "dateConfig",
        "OSStatus", "ready", "settings", "community", "profileHome", "barometer", "pressetSettings", "pressure",
        "piston_position", "retraction_volume", "power_save", "tare_behavior", "motor_power", "time", "weight", "flow",
        "temperature", "output", "manual-purge", "heating", "calibrateScale", "dose", "name",
        "selectLetterCountry", "countrySettings", "timeZoneSettings", "notifications", "wifiSettings",
        "wifiModeSettings", "wifiQrMenu", "wifiDetails", "KnownWifi", "deleteKnowWifiMenu", "connectWifiMenu",
        "selectWifi", "connectWifiViaApp", "bug-report", "enterWifiPassword", "quick-settings",
        "heat_timeout_after_shot", "snake", "advancedSettings", "manufacturingSettings", "pressetProfileImage",
        "deviceInfo", "updateChannel", "idleScreenSettings", "manualSetup", "shot_history", "freePour",
        "guidedPourOver", "freePourHistory", "idle", "brewSettings", "experimentalSettings", "scrollDirections",
        "brewComplete", "factoryReset", "helpUsImprove", "reportContactEmail", "shotDataSharingPrompt",
        "displayAlignment", "unlock"
    ]

    readonly property var table: ({
        deviceInfoQR: { url: s("settings/InfoQRCode.qml"), title: "show device info code", bottomStatusHidden: true },
        masterCalibrationLock: { url: s("misc/UnlockMasterCalibration.qml"), title: "", bottomStatusHidden: true },
        timeZoneConfig: { url: s("time/TimeZoneConfig.qml"), title: "timeZoneConfig", bottomStatusHidden: true },
        timeDate: { url: s("time/TimeDate.qml"), title: "TimeDate", bottomStatusHidden: true },
        timeConfig: { url: s("time/TimeConfig.qml"), title: "Time", bottomStatusHidden: true },
        dateConfig: { url: s("time/DateConfig.qml"), title: "Time", bottomStatusHidden: true },
        OSStatus: { url: s("settings/OSStatus.qml"), title: "OSStatus", bottomStatusHidden: true },
        ready: { url: s("brew/ReadyAnimation.qml"), bottomStatusHidden: true, ignoreAsPrevious: true },
        settings: { url: s("settings/Settings.qml"), title: "settings", bottomStatusHidden: true },
        community: { url: s("settings/Community.qml"), title: "Community", bottomStatusHidden: true },
        profileHome: { url: s("home/ProfileHome.qml"), parentTitle: profilesTitle },
        barometer: { url: s("brew/Barometer.qml"), title: selectStatProfileName, bottomStatusHidden: true,
                     animationDirectionFrom: { "manual-purge": "in", heating: "in" } },
        pressetSettings: { url: s("profile/PressetSettings.qml"), title: activeProfilesTitle, bottomStatusHidden: true, parent: "profileHome" },
        pressure: { url: s("profile/SettingNumerical.qml"), title: activeProfilesTitle, bottomTitle: "pressure", props: { type: "pressure" }, bottomStatusHidden: true, parent: "pressetSettings" },
        piston_position: { url: s("profile/SettingNumerical.qml"), title: activeProfilesTitle, bottomTitle: "piston position", props: { type: "piston_position" }, bottomStatusHidden: true, parent: "pressetSettings" },
        retraction_volume: { url: s("settings/RetractionVolume.qml"), title: "retraction", bottomTitle: "distance", props: { type: "retraction_volume" }, bottomStatusHidden: true, parent: "brewSettings" },
        power_save: { url: s("settings/PowerSave.qml"), title: "power save", props: { type: "power_save" }, bottomStatusHidden: true, parent: "settings" },
        tare_behavior: { url: s("settings/TareBehavior.qml"), title: "auto tare", bottomStatusHidden: true, parent: "brewSettings" },
        motor_power: { url: s("profile/SettingNumerical.qml"), title: activeProfilesTitle, bottomTitle: "motor power", props: { type: "motor_power" }, bottomStatusHidden: true, parent: "pressetSettings" },
        time: { url: s("profile/SettingNumerical.qml"), title: activeProfilesTitle, bottomTitle: "time", props: { type: "time" }, bottomStatusHidden: true, parent: "pressetSettings" },
        weight: { url: s("profile/SettingNumerical.qml"), title: activeProfilesTitle, bottomTitle: "weight", props: { type: "weight" }, bottomStatusHidden: true, parent: "pressetSettings" },
        flow: { url: s("profile/SettingNumerical.qml"), title: activeProfilesTitle, bottomTitle: "flow", props: { type: "flow" }, bottomStatusHidden: true, parent: "pressetSettings" },
        temperature: { url: s("profile/SettingNumerical.qml"), title: activeProfilesTitle, bottomTitle: "temperature", props: { type: "temperature" }, bottomStatusHidden: true, parent: "pressetSettings" },
        output: { url: s("profile/SettingNumerical.qml"), title: activeProfilesTitle, bottomTitle: "output", props: { type: "output" }, bottomStatusHidden: true, parent: "pressetSettings" },
        "manual-purge": { url: s("brew/PurgeScreen.qml"), bottomStatusHidden: true, title: selectPurgeTitle,
                          animationDirectionFrom: { barometer: "in", heating: "in" } },
        heating: { url: s("brew/HeatingScreen.qml"), title: activeProfilesTitle, bottomStatusHidden: true,
                   animationDirectionFrom: { barometer: "in", "manual-purge": "in" } },
        calibrateScale: { url: s("scale/CalibrateScale.qml"), bottomStatusHidden: true },
        dose: { url: "", title: "dose", parentTitle: activeProfilesTitle, parent: "pressetSettings" },
        name: { url: s("profile/EditNameScreen.qml"), bottomStatusHidden: true, parent: "pressetSettings" },
        selectLetterCountry: { url: s("time/SelectLetterCountry.qml"), bottomStatusHidden: true },
        countrySettings: { url: s("time/CountrySettings.qml"), bottomStatusHidden: true },
        timeZoneSettings: { url: s("time/TimeZoneSettings.qml"), bottomStatusHidden: true },
        notifications: { url: s("notifications/Notification.qml"), bottomStatusHidden: true, ignoreAsPrevious: true },
        wifiSettings: { url: s("wifi/WifiSettings.qml"), title: "wifi settings", bottomStatusHidden: true },
        wifiModeSettings: { url: s("wifi/WifiModeSettings.qml"), title: "wifi mode", bottomStatusHidden: true },
        wifiQrMenu: { url: s("wifi/WifiQrMenu.qml"), title: "show connection code", bottomStatusHidden: true },
        wifiDetails: { url: s("wifi/WifiDetails.qml"), title: "wifi details", bottomStatusHidden: true },
        KnownWifi: { url: s("wifi/KnownWifi.qml"), bottomStatusHidden: true },
        deleteKnowWifiMenu: { url: s("wifi/DeleteWifiMenu.qml"), bottomStatusHidden: true },
        connectWifiMenu: { url: s("wifi/ConnectWifiMenu.qml"), title: "connect to a new network", bottomStatusHidden: true },
        selectWifi: { url: s("wifi/SelectWifi.qml"), title: "select wifi", bottomStatusHidden: true },
        connectWifiViaApp: { url: s("wifi/ConnectWifiViaApp.qml"), title: "connect to wifi via app", bottomStatusHidden: true },
        "bug-report": { url: s("support/BugReport.qml"), title: "report an issue", bottomStatusHidden: true },
        enterWifiPassword: { url: s("wifi/EnterWifiPassword.qml"), bottomStatusHidden: true, parent: "profileHome" },
        "quick-settings": { url: s("home/QuickSettings.qml") },
        heat_timeout_after_shot: { url: s("brew/HeatTimeoutAfterShot.qml"), bottomStatusHidden: true },
        snake: { url: s("misc/Snake.qml"), parent: "profileHome" },
        advancedSettings: { url: s("settings/AdvancedSettings.qml") },
        manufacturingSettings: { url: s("settings/Manufacturing.qml") },
        pressetProfileImage: { url: s("profile/PressetProfileImage.qml"), title: activeProfilesTitle, bottomStatusHidden: true, parent: "pressetSettings" },
        deviceInfo: { url: s("settings/DeviceInfoScreen.qml") },
        updateChannel: { url: s("settings/UpdateChannel.qml") },
        idleScreenSettings: { url: s("settings/IdleScreenSetting.qml") },
        manualSetup: { url: s("manual/ManualModeSetup.qml"), title: "Manual mode", bottomStatusHidden: true },
        shot_history: { url: s("brew/ShotGraphScreen.qml"), title: activeProfilesTitle, parent: "profileHome", bottomStatusHidden: true },
        freePour: { url: s("freepour/FreePourScreen.qml"), bottomStatusHidden: true, parent: "profileHome" },
        guidedPourOver: { url: s("freepour/GuidedPourOverScreen.qml"), bottomStatusHidden: true, parent: "profileHome" },
        freePourHistory: { url: s("freepour/FreePourHistoryScreen.qml"), bottomStatusHidden: true, parent: "profileHome" },
        idle: { url: s("idle/IdleScreen.qml"), bottomStatusHidden: true, ignoreAsPrevious: true },
        brewSettings: { url: s("settings/BrewSettings.qml"), bottomStatusHidden: true },
        experimentalSettings: { url: s("settings/ExperimentalSettings.qml"), bottomStatusHidden: true },
        scrollDirections: { url: s("settings/ScrollDirectionSettings.qml"), bottomStatusHidden: true },
        brewComplete: { url: s("brew/BrewCompleteScreen.qml"), title: "Brew complete", bottomStatusHidden: true },
        factoryReset: { url: s("settings/FactoryReset.qml"), bottomStatusHidden: true },
        helpUsImprove: { url: s("support/HelpUsImprove.qml"), bottomStatusHidden: true },
        // Only ever reached from the bug report bubble, which it reopens itself.
        reportContactEmail: { url: s("support/ReportContactEmail.qml"), bottomStatusHidden: true, ignoreAsPrevious: true },
        // Deliberately a valid "previous" screen: after a notification or the idle screen the dial returns
        // here while the prompt is unanswered.
        shotDataSharingPrompt: { url: s("support/ShotDataSharingPrompt.qml"), bottomStatusHidden: true },
        displayAlignment: { url: s("settings/DisplayAlignment.qml"), bottomStatusHidden: true },
        unlock: { url: s("misc/UnlockScreen.qml"), bottomStatusHidden: true, ignoreAsPrevious: true }
    })

    function route(name) { return table[name] || null }
    function index(name) { return order.indexOf(name) }

    // A title spec evaluated: a string, a pill object, or undefined (null for an absent parentTitle, as the
    // React Router passes it).
    function evaluate(spec) {
        if (spec === undefined) return undefined
        if (typeof spec === "function") return spec()
        return spec
    }

    // Router.tsx compares the evaluated titles with ===: a pill is a new React element on every render, so
    // two pills are never equal; strings are; undefined and null are not equal to each other.
    function sameTitle(a, b) {
        if (a !== null && typeof a === "object") return false
        if (b !== null && typeof b === "object") return false
        return a === b
    }
}
