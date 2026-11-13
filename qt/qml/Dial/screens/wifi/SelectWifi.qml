// The scan (src/components/Wifi/SelectWifi.tsx), in the bubble: the networks of GET /wifi/list (refetched
// on mount and every 5 s) with the WifiIcon (level = distance from the end of the list, at most 4),
// "Scanning..." (not selectable) while a scan is in flight, and "Back" to the Wi-Fi menu. Pushing a network
// closes the bubble, selects it (with its saved credentials when known_wifis has it) and opens
// EnterWifiPassword.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false

    property int activeIndex: 0

    readonly property WifiQuery listQuery: WifiStore.wifiList
    readonly property WifiQuery configQuery: WifiStore.networkConfig

    readonly property var wifiList: {
        const networks = listQuery.data || []
        const list = networks.map(wifi => ({ key: wifi.ssid, label: wifi.ssid }))
        return list.concat(listQuery.isFetching ? [{ key: "scanning", label: "Scanning...", disabled: true }] : [],
                           [{ key: "back", label: "Back" }])
    }
    readonly property var menuOptions: wifiList.map((option, index) => option.key === "back" || option.disabled
        ? option
        : { key: option.key, label: option.label, wifiLevel: Math.min(wifiList.length - index, 4) })

    // "Scanning..." comes and goes with every scan: keep the focus on the list (the React Dial leaves it
    // past the end, with an empty bar and a dead push, until the next scan).
    onWifiListChanged: if (activeIndex > wifiList.length - 1) activeIndex = wifiList.length - 1

    property int listObserver: 0
    property int configObserver: 0
    Component.onCompleted: {
        listObserver = listQuery.observe(false)
        configObserver = configQuery.observe(true)
    }
    Component.onDestruction: {
        listQuery.unobserve(listObserver)
        configQuery.unobserve(configObserver)
    }

    GestureHandler {
        enabled: screen.inBubble ? Nav.bubbleInterceptsGesture : !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.wifiList.length - 1)
        onPressDown: {
            const selectedItem = screen.wifiList[screen.activeIndex]
            if (!selectedItem || selectedItem.disabled) return
            if (selectedItem.key === "back") {
                Nav.setBubbleDisplay({ visible: true, component: "wifiSettings" })
                return
            }
            const ssid = selectedItem.key
            const networkConfig = screen.configQuery.data
            const useKnownCredentials = !!(networkConfig && networkConfig.known_wifis && (ssid in networkConfig.known_wifis))
            Nav.setBubbleDisplay({ visible: false, component: "" })
            UiState.selectWifi({ ssid: ssid, useKnownCredentials: useKnownCredentials })
            Nav.setScreen("enterWifiPassword")
        }
    }

    WifiMenu {
        options: screen.menuOptions
        activeIndex: screen.activeIndex
    }
}
