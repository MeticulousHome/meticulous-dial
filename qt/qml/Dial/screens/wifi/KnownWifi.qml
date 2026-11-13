// The saved networks (src/components/Wifi/KnownWifi.tsx), in the bubble: one row per known_wifis entry
// of the network config, with the WifiIcon (its level is the row's distance from the end of the list, at
// most 4, as the React Dial draws it), then "Back" to the Wi-Fi menu. Pushing a network keeps it as
// UiState.selectedWifiToDelete and opens its menu (connect / delete / back).
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false

    property int activeIndex: 0

    readonly property WifiQuery query: WifiStore.networkConfig
    readonly property var wifiData: query.data

    readonly property var knownWifis: {
        if (!wifiData || !wifiData.known_wifis) return []
        const wifiSettings = Object.keys(wifiData.known_wifis).map(ssid => ({ key: ssid, label: ssid }))
        return wifiSettings.concat([{ key: "back", label: "Back" }])
    }
    readonly property var menuOptions: knownWifis.map((option, index) => option.key === "back"
        ? option
        : { key: option.key, label: option.label, caseSensitive: false, wifiLevel: Math.min(knownWifis.length - index, 4) })

    property int observer: 0
    Component.onCompleted: observer = query.observe(false)
    Component.onDestruction: query.unobserve(observer)

    GestureHandler {
        enabled: screen.inBubble ? Nav.bubbleInterceptsGesture : !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.knownWifis.length - 1)
        onPressDown: {
            const item = screen.knownWifis[screen.activeIndex]
            if (!item) return
            if (item.key === "back") {
                Nav.setBubbleDisplay({ visible: true, component: "wifiSettings" })
            } else {
                UiState.selectWifiToDelete(item.key)
                Nav.setBubbleDisplay({ visible: true, component: "deleteKnowWifiMenu" })
            }
        }
    }

    WifiMenu {
        visible: !screen.query.isLoading
        options: screen.menuOptions
        activeIndex: screen.activeIndex
    }

    // .loading-center is position: fixed: in the bubble it covers the whole display.
    LoadingScreen {
        visible: screen.query.isLoading
        anchors.fill: undefined
        x: screen.inBubble ? screen.width - 480 : 0
        width: screen.inBubble ? 480 : screen.width
        height: screen.height
    }
}
