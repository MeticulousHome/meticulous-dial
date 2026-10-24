// The context menu (src/components/QuickSettings/QuickSettings.tsx) in the bubble: what fits the screen
// under it (profile, Free Pour, pour-over, brewing, Free Pour in progress), Back when the route has a
// parent, then sleep / raise / purge / Brew Settings / wifi / config / Report an issue / Experimental /
// Help us improve / exit. The OS update status shows on top, the image version at the end. Long-press
// options (delete, abort) fill while held. Twenty turns past "exit" open Snake.
import QtQuick
import Dial
import Dial.Native

Item {
    id: quick
    anchors.fill: parent
    property bool inBubble: true

    // The menu is unmounted with the bubble: which manual brew was saved is kept by its brew time.
    property var settings: defaultSettings
    property int counterESGG: 0
    readonly property bool manualBrewSaved: ManualMode.savedManualBrewTime === Stats.profileTime

    readonly property string currentScreen: Nav.screen
    readonly property string statsName: Stats.name
    readonly property bool isManualProfile: ManualMode.isManualProfile

    readonly property var profileContextSettings: [
        { key: "edit", label: "Edit profile" },
        { key: "last_shot", label: "Last shot" },
        { key: "delete", label: "Delete profile", longpress: true, hasSeparator: true }
    ]
    readonly property var freePourContextSettings: [{ key: "last_free_pour", label: "Last pour-over" }]
    readonly property var pourOverProfileContextSettings: freePourContextSettings.concat([
        { key: "delete_pour_over_profile", label: "Delete profile", longpress: true, hasSeparator: true }
    ])
    readonly property var freePourInProgressSettings: [
        { key: "resume_free_pour", label: "Resume Free Pour" },
        { key: "abort_free_pour", label: "Abort Free Pour", longpress: true, hasSeparator: true },
        { key: "exit", label: "Exit menu" }
    ]
    readonly property var prevScreenSetting: ({ key: "prevScreen", label: "Back", hasSeparator: true })
    readonly property var defaultSettings: [
        { key: "sleep", label: "sleep" },
        { key: "raise", label: "raise" },
        { key: "purge", label: "purge" },
        { key: "brew_config", label: "Brew Settings", hasSeparator: true },
        { key: "wifi", label: "wifi" },
        { key: "config", label: "config" },
        { key: "bug_report", label: "Report an issue" },
        { key: "experimental", label: "Experimental" },
        { key: "help_us_improve", label: "Help us improve" },
        { key: "exit", label: "exit" }
    ]
    readonly property var saveManualBrewSetting: ({ key: "save_manual_brew", label: "Save as profile", hasSeparator: true })
    readonly property var manualBrewSavedSetting: ({ key: "manual_brew_saved", label: "Profile saved", hasSeparator: true })
    readonly property var inBrewSettings: [
        { key: "skip_step", label: "Skip this step" },
        { key: "abort_brew", label: "Abort Brew", longpress: true, hasSeparator: true },
        { key: "config", label: "config" },
        { key: "bug_report", label: "Report an issue" },
        { key: "exit", label: "exit" }
    ]

    readonly property var hiddenOsStatusScreens: ["heating", "brewComplete", "barometer"]
    readonly property bool osStatusVisible: Device.osStatus.status !== "IDLE" && hiddenOsStatusScreens.indexOf(currentScreen) < 0
    readonly property string osStatusInfo: {
        if (Device.osStatusError) return ""
        switch (Device.osStatus.status) {
        case "COMPLETE": return "Update Complete"
        case "DOWNLOADING": return "Downloading Update: " + Math.round(Device.osStatus.progress) + "%"
        case "INSTALLING": return "Installing Update: " + Math.round(Device.osStatus.progress) + "%"
        case "FAILED": return "Update Failed: " + Device.osStatus.info + "%"
        }
        return ""
    }
    readonly property color osStatusColor: {
        const s = (Device.osStatus.status || "").toLowerCase()
        return s === "failed" ? Theme.error : Theme.warning
    }

    readonly property string dialFocusedLabel: menu.activeOption ? menu.activeOption.label : ""

    function rebuild() {
        const backAvailable = !!(Routes.route(currentScreen) && Routes.route(currentScreen).parent)
        switch (currentScreen) {
        case "heating":
        case "brewComplete": {
            const base = statsName === "idle" ? defaultSettings : inBrewSettings
            const graphShowing = currentScreen === "brewComplete" && (statsName === "purge" || statsName === "idle" || statsName === "END_STAGE")
            if (isManualProfile && graphShowing)
                settings = [manualBrewSaved ? manualBrewSavedSetting : saveManualBrewSetting].concat(base)
            else
                settings = base
            break
        }
        case "barometer":
            settings = inBrewSettings
            break
        case "freePour":
        case "guidedPourOver":
            settings = freePourInProgressSettings
            break
        default: {
            const requiresProfileContext = Profiles.profiles.length > 0 && currentScreen === "profileHome" && Profiles.homeMode === "espresso"
            const requiresFreePourContext = currentScreen === "profileHome" && Profiles.homeMode === "free_pour"
            const requiresPourOverProfileContext = currentScreen === "profileHome" && Profiles.homeMode === "pour_over_profile"
            const context = Profiles.localProfile && Profiles.localProfile.temporary
                            ? profileContextSettings.filter(c => c.key !== "delete") : profileContextSettings
            settings = [].concat(requiresProfileContext ? context : [],
                                 requiresFreePourContext ? freePourContextSettings : [],
                                 requiresPourOverProfileContext ? pourOverProfileContextSettings : [],
                                 backAvailable ? [prevScreenSetting] : [],
                                 defaultSettings)
        }
        }
    }
    Component.onCompleted: rebuild()
    onCurrentScreenChanged: rebuild()
    onStatsNameChanged: rebuild()
    onIsManualProfileChanged: rebuild()
    onManualBrewSavedChanged: rebuild()
    onOsStatusVisibleChanged: rebuild()
    Connections {
        target: Profiles
        function onHomeModeChanged() { quick.rebuild() }
    }

    onCounterESGGChanged: {
        if (counterESGG >= 20) {
            Nav.closeBubble()
            Nav.setScreen("snake")
        }
    }

    function close(intercepts) { Nav.setBubbleDisplay({ visible: false, component: "", interceptsGesture: !!intercepts }) }

    function handleAnimationEnd() {
        menu.holdAnimation = "finished"
        const option = settings[menu.activeIndex]
        if (!option) return
        switch (option.key) {
        case "delete":
            // Never delete an existing profile from a temporary one that has modifications.
            if (Profiles.localProfile && Profiles.localProfile.temporary) return
            if (Profiles.localProfile) Profiles.deleteProfile(Profiles.localProfile.id)
            Nav.setScreen("profileHome")
            close()
            break
        case "delete_pour_over_profile": {
            if (!Profiles.selectedPourOverProfileId) return
            const deletedProfileId = Profiles.selectedPourOverProfileId
            Profiles.selectedPourOverProfileId = null
            Profiles.homeMode = "free_pour"
            Profiles.deletePourOverProfile(deletedProfileId).catch(() => {
                Profiles.selectedPourOverProfileId = deletedProfileId
                Profiles.homeMode = "pour_over_profile"
            })
            Nav.setScreen("profileHome")
            close()
            break
        }
        case "abort_brew":
            Backend.action("abort")
            close()
            break
        case "abort_free_pour":
            console.log("[free-pour] aborted", JSON.stringify({ source: "context_menu" }))
            Nav.setScreen("profileHome")
            close()
            break
        }
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture
        onDoubleClick: {
            if (Nav.screen !== "freePour" && Nav.screen !== "guidedPourOver") return
            console.log("[free-pour] aborted", JSON.stringify({ source: "double_press_context_menu" }))
            Nav.setScreen("profileHome")
            quick.close()
        }
        onTurnLeft: {
            menu.previous()
            quick.counterESGG = 0
        }
        onTurnRight: {
            const previousOption = menu.activeIndex
            menu.next()
            if (quick.settings[previousOption] && quick.settings[previousOption].key === "exit") quick.counterESGG++
        }
        onPressUp: {
            if (menu.holdAnimation === "finished") {
                Nav.setScreen("profileHome")
                quick.close()
            }
            menu.holdAnimation = "stopped"
        }
        onPressDown: {
            const option = quick.settings[menu.activeIndex]
            if (!option) return
            if (option.longpress) {
                menu.holdAnimation = "running"
                return
            }
            switch (option.key) {
            case "prevScreen": {
                const route = Routes.route(Nav.screen)
                if (!route || !route.parent) {
                    console.error("return to previous screen doesn't exist")
                    break
                }
                Nav.setScreen(route.parent)
                quick.close()
                break
            }
            case "sleep":
                quick.close()
                Idle.forceIdle()
                break
            case "raise":
                Backend.action("home")
                console.log("raise/home")
                quick.close()
                break
            case "disable_ui_features":
                BackendSettings.update({ disable_ui_features: true })
                quick.close()
                break
            case "edit":
                if (!Profiles.localProfile) {
                    console.error("No profile selected")
                    break
                }
                Profiles.settingsIndex = 0
                Profiles.isCreatingProfile = false
                Profiles.settingsProfile = Profiles.addSettingsToProfile(Profiles.localProfile)
                Nav.setScreen("pressetSettings")
                quick.close()
                break
            case "save_manual_brew":
                ManualMode.savedManualBrewTime = Stats.profileTime
                ManualMode.createProfileFromManualBrew().catch(error => {
                    console.error("Could not save the manual brew as a profile:", error && error.message ? error.message : error)
                    ManualMode.savedManualBrewTime = -1
                })
                quick.close()
                break
            case "last_shot":
                Nav.setScreen("shot_history")
                quick.close()
                break
            case "last_free_pour":
                Nav.setScreen("freePourHistory")
                // Keep the chart blocked until the bubble has closed so this press cannot click through.
                quick.close(true)
                break
            case "resume_free_pour":
                console.log("[free-pour] context_closed", JSON.stringify({ action: "resume" }))
                quick.close(true)
                break
            case "purge":
                Backend.action("purge")
                quick.close()
                break
            case "calibrate":
                quick.close()
                Nav.setScreen("calibrateScale")
                break
            case "wifi":
                Nav.openBubble("wifiSettings")
                break
            case "config":
                Nav.openBubble("settings")
                break
            case "experimental":
                Nav.openBubble("experimentalSettings")
                break
            case "bug_report":
                Nav.openBubble("bug-report")
                break
            case "brew_config":
                Nav.openBubble("brewSettings")
                break
            case "help_us_improve":
                quick.close(true)
                Nav.setScreen("helpUsImprove")
                break
            case "exit":
                quick.close(true)
                break
            case "skip_step":
                Backend.continueBrew()
                quick.close()
                break
            }
        }
    }

    OptionsMenu {
        id: menu
        options: quick.settings
        headerText: quick.osStatusVisible ? quick.osStatusInfo : ""
        headerColor: quick.osStatusColor
        footerText: Device.infoPending ? "loading ..." : String(Device.info.image_version)
        onHoldFinished: quick.handleAnimationEnd()
    }
}
