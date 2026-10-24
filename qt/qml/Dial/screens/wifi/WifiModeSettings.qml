// The Wi-Fi mode picker (src/components/Wifi/WifiModeSettings.tsx), in the bubble: "Join existing WiFi",
// "Create standalone WiFi" (dashed separator), "Save", "Cancel". The focus starts on the current mode;
// pushing a mode makes it the draft ("selected", the current one keeps "current"); Save sends the draft
// (POST /wifi/config with the config and the new mode) and returns to the Wi-Fi menu, as do Cancel and a
// Save of the current mode. Loading the mode and saving show the loading screen (saving cycles through its
// messages every 7 s); a failure shows the error with "OK", back to the Wi-Fi menu. Gestures are ignored
// unless the bubble intercepts them and while loading or saving.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false

    property int activeIndex: 0
    property string draftMode: ""          // null until the current mode is known
    property int loadingMessageIndex: 0

    readonly property WifiQuery query: WifiStore.networkConfig
    readonly property var networkConfig: query.data
    readonly property string currentMode: networkConfig && networkConfig.config && networkConfig.config.mode ? networkConfig.config.mode : ""

    readonly property var wifiModeItems: [
        { key: "client", label: "Join existing WiFi", mode: WifiStore.modeClient },
        { key: "standalone", label: "Create standalone WiFi", mode: WifiStore.modeAP, hasSeparator: true },
        { key: "save", label: "Save" },
        { key: "cancel", label: "Cancel" }
    ]

    function getLoadingMessages(mode) {
        if (mode === WifiStore.modeAP)
            return ["Starting hotspot", "Trying WiFi channels", "Checking hotspot", "Keeping current WiFi safe"]
        if (mode === WifiStore.modeClient)
            return ["Joining WiFi mode", "Checking connection", "Updating WiFi"]
        return ["Updating WiFi"]
    }
    readonly property var loadingMessages: getLoadingMessages(draftMode)

    // 'current' | 'selected' | null
    function getAnnotation(item) {
        if (!item.mode) return ""
        if (draftMode !== currentMode && item.mode === draftMode) return "selected"
        return item.mode === currentMode ? "current" : ""
    }
    readonly property var menuOptions: wifiModeItems.map(item => ({
        key: item.key, label: item.label, hasSeparator: !!item.hasSeparator, annotation: getAnnotation(item)
    }))

    WifiMutation {
        id: updateMutation
        Component.onCompleted: fn = config => WifiStore.updateConfig(config)
    }

    // The draft starts at the current mode, once it is known (an effect: after the binding settles).
    function syncDraft() {
        if (draftMode !== "" || !currentMode) return
        draftMode = currentMode
        activeIndex = currentMode === WifiStore.modeAP ? 1 : 0
    }
    onCurrentModeChanged: Qt.callLater(syncDraft)

    property int observer: 0
    Component.onCompleted: {
        observer = query.observe(false)
        syncDraft()
    }
    Component.onDestruction: query.unobserve(observer)

    // The saving messages change every 7 s.
    function restartMessages() {
        loadingMessageIndex = 0
        if (updateMutation.isPending && loadingMessages.length > 1) messageTimer.restart()
        else messageTimer.stop()
    }
    onLoadingMessagesChanged: restartMessages()
    Connections {
        target: updateMutation
        function onIsPendingChanged() { screen.restartMessages() }
    }
    Timer {
        id: messageTimer
        interval: 7000
        repeat: true
        onTriggered: screen.loadingMessageIndex = (screen.loadingMessageIndex + 1) % screen.loadingMessages.length
    }

    function returnToWifiSettings() { Nav.setBubbleDisplay({ visible: true, component: "wifiSettings" }) }

    readonly property bool showError: updateMutation.isError || query.error !== null

    GestureHandler {
        enabled: !(!Nav.bubbleInterceptsGesture || screen.query.isLoading || updateMutation.isPending)
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.wifiModeItems.length - 1)
        onPressDown: {
            if (screen.showError) {
                updateMutation.reset()
                screen.returnToWifiSettings()
                return
            }
            const activeItem = screen.wifiModeItems[screen.activeIndex]
            if (activeItem.mode) {
                screen.draftMode = activeItem.mode
                return
            }
            if (activeItem.key === "cancel") {
                screen.returnToWifiSettings()
                return
            }
            if (activeItem.key !== "save" || !screen.draftMode) return
            if (screen.draftMode === screen.currentMode) {
                screen.returnToWifiSettings()
                return
            }
            screen.query.cancel()
            const config = Object.assign({}, screen.networkConfig ? screen.networkConfig.config : {}, { mode: screen.draftMode })
            updateMutation.mutate(config, updatedConfig => {
                // setQueryData: the answer merged into `config` (it is the whole wifi status, so the mode
                // shown stays the old one until the next refetch, as in the React Dial).
                screen.query.setData(current => current
                    ? Object.assign({}, current, { config: Object.assign({}, current.config, updatedConfig) })
                    : current)
                screen.returnToWifiSettings()
            })
        }
    }

    WifiMenu {
        visible: !screen.query.isLoading && !updateMutation.isPending && !screen.showError
        options: screen.menuOptions
        activeIndex: screen.activeIndex
        annotationOuterMargin: 19.2
    }

    WifiResponse {
        visible: !screen.query.isLoading && !updateMutation.isPending && screen.showError
        title: updateMutation.isError ? "Could not update WiFi" : "Could not load WiFi mode"
        message: updateMutation.isError
            ? ((updateMutation.error && updateMutation.error.message) || "Could not update WiFi. Please try again.")
            : "Could not load the current WiFi mode. Please try again."
    }

    // .loading-center is position: fixed: in the bubble it covers the whole display.
    LoadingScreen {
        visible: screen.query.isLoading || updateMutation.isPending
        anchors.fill: undefined
        x: screen.inBubble ? screen.width - 480 : 0
        width: screen.inBubble ? 480 : screen.width
        height: screen.height
        message: screen.query.isLoading ? "Loading WiFi mode" : (screen.loadingMessages[screen.loadingMessageIndex] || "")
    }
}
