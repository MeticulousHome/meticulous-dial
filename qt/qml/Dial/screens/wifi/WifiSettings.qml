// The Wi-Fi menu (src/components/Wifi/WifiSettings.tsx), opened in the bubble by the quick settings' "wifi":
// "Status: <health>" ("Checking..." while the network config is missing or a refetch of data older than 2 s
// is in flight), "Show connection code" (only while connected), "See network details", "Wifi mode: ...",
// "Known Wifis", "Connect to a new network", "Repair WiFi" (unless CONNECTED / HOTSPOT ACTIVE) and "Back".
// Repair shows the loading screen with its three messages (7 s each); a failed repair or a network config
// that cannot be loaded shows the error with "OK", which returns to the quick settings.
import QtQuick
import Dial
import "WifiHealth.js" as WifiHealth

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false

    property int activeIndex: 0
    property int loadingMessageIndex: 0

    readonly property WifiQuery query: WifiStore.networkConfig
    readonly property var networkConfig: query.data
    // networkConfig?.status.connected: undefined without data (getWifiHealthStatusLabel then defaults it to true).
    readonly property var isWifiConnected: networkConfig ? networkConfig.status.connected : undefined
    readonly property var wifiHealth: networkConfig ? networkConfig.health : undefined
    readonly property bool isApMode: !!networkConfig && networkConfig.config.mode === WifiStore.modeAP
    // Evaluated when the query changes, as React renders: Date.now() is the render time.
    readonly property bool hasStaleNetworkConfig: !networkConfig || (query.isFetching && Date.now() - query.dataUpdatedAt > 2000)
    readonly property string wifiHealthStatusLabel: WifiHealth.getWifiHealthStatusLabel(wifiHealth, isWifiConnected)
    readonly property string healthLabel: hasStaleNetworkConfig ? "Checking..." : wifiHealthStatusLabel

    readonly property var loadingMessages: repairMutation.isPending ? ["Checking WiFi", "Trying recovery", "Verifying connection"] : []

    readonly property var wifiSettingItems: [
        { key: "status", label: "Status: " + healthLabel, visible: true },
        { key: "qr_code", label: "Show connection code", visible: !!isWifiConnected },
        { key: "details", label: "See network details", visible: true },
        { key: "network_mode", label: "Wifi mode: " + (isApMode ? "Create standalone wifi" : "Machine joins existing wifi"), visible: true },
        { key: "known_wifis", label: "Known Wifis", visible: true },
        { key: "connect_new_network", label: "Connect to a new network", visible: true },
        { key: "repair", label: "Repair WiFi", visible: ["CONNECTED", "HOTSPOT ACTIVE"].indexOf(wifiHealthStatusLabel) < 0 },
        { key: "back", label: "Back", visible: true }
    ]
    readonly property var visibleItems: wifiSettingItems.filter(item => item.visible)

    readonly property bool showError: repairMutation.isError || query.error !== null
    readonly property string errorTitle: repairMutation.isError ? "Network issue" : "Could not load WiFi"
    readonly property string errorMessage: repairMutation.isError
        ? ((repairMutation.error && repairMutation.error.message) || "WiFi repair could not complete. Please check the network.")
        : "Connection could not be verified. Please check the connection details."

    WifiMutation {
        id: repairMutation
        Component.onCompleted: fn = () => WifiStore.repair()
    }

    property int observer: 0
    Component.onCompleted: observer = query.observe(false)
    Component.onDestruction: query.unobserve(observer)

    // The loading messages change every 7 s while there are more than one.
    onLoadingMessagesChanged: {
        loadingMessageIndex = 0
        if (loadingMessages.length > 1) messageTimer.restart()
        else messageTimer.stop()
    }
    Timer {
        id: messageTimer
        interval: 7000
        repeat: true
        onTriggered: screen.loadingMessageIndex = (screen.loadingMessageIndex + 1) % Math.max(screen.loadingMessages.length, 1)
    }

    function openBubble(component) { Nav.setBubbleDisplay({ visible: true, component: component }) }

    GestureHandler {
        enabled: (screen.inBubble ? Nav.bubbleInterceptsGesture : !Nav.bubbleInterceptsGesture) && !repairMutation.isPending
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.visibleItems.length - 1)
        onPressDown: {
            // In case of error we go back
            if (screen.showError) {
                screen.openBubble("quick-settings")
                return
            }
            const item = screen.visibleItems[screen.activeIndex]
            if (!item) return
            switch (item.key) {
            case "network_mode": screen.openBubble("wifiModeSettings"); break
            case "qr_code": screen.openBubble("wifiQrMenu"); break
            case "details": screen.openBubble("wifiDetails"); break
            case "known_wifis": screen.openBubble("KnownWifi"); break
            case "back": screen.openBubble("quick-settings"); break
            case "connect_new_network": screen.openBubble("selectWifi"); break
            case "repair":
                repairMutation.mutate(undefined, () => screen.query.refetch())
                screen.activeIndex = 0
                break
            }
        }
    }

    OptionsMenu {
        visible: !repairMutation.isPending && !screen.showError
        options: screen.visibleItems
        activeIndex: screen.activeIndex
    }

    WifiResponse {
        visible: !repairMutation.isPending && screen.showError
        title: screen.errorTitle
        message: screen.errorMessage
    }

    // .loading-center is position: fixed: in the bubble it covers the whole display (the 480 px layout the
    // 420 px panel sits in), not the panel.
    LoadingScreen {
        visible: repairMutation.isPending
        anchors.fill: undefined
        x: screen.inBubble ? screen.width - 480 : 0
        width: screen.inBubble ? 480 : screen.width
        height: screen.height
        message: screen.loadingMessages[screen.loadingMessageIndex] || ""
    }
}
