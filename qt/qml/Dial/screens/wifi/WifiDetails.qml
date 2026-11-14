// The network details (src/components/Wifi/WifiDetails.tsx), in the bubble: a menu of read-only rows
// "NETWORK: ...", "HOSTNAME", "AP NAME", "AP PASSWORD", "IP" (the first), "MAC", "HEALTH" (the status label),
// "GATEWAY" / "DNS" / "INTERNET" (OK / FAILED from the last verified health, N/A while the hotspot is up),
// "LAST ERROR" (the health message), "RECOVERY" (the last repair) and "Back" to the Wi-Fi menu. Until the
// network config arrives the rows have no values (and the loading screen shows while it loads).
import QtQuick
import Dial
import "WifiHealth.js" as WifiHealth

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false

    property int activeIndex: 0

    readonly property var initialWifiItems: [
        { key: "network", label: "NETWORK" },
        { key: "hostname", label: "HOSTNAME" },
        { key: "ap_name", label: "AP NAME" },
        { key: "ap_password", label: "AP PASSWORD" },
        { key: "ips", label: "IP" },
        { key: "mac", label: "MAC" },
        { key: "health", label: "HEALTH" },
        { key: "gateway", label: "GATEWAY" },
        { key: "dns", label: "DNS" },
        { key: "internet", label: "INTERNET" },
        { key: "last_error", label: "LAST ERROR" },
        { key: "recovery", label: "RECOVERY" },
        { key: "back", label: "Back" }
    ]

    readonly property WifiQuery query: WifiStore.networkConfig
    readonly property var wifiData: query.data
    readonly property var wifiStatus: wifiData ? wifiData.status : undefined
    readonly property var networkConfig: wifiData ? wifiData.config : undefined
    readonly property var wifiHealth: wifiData ? wifiData.health : undefined
    readonly property bool isHotspotActive: !!wifiHealth && wifiHealth.mode === "AP" && !!wifiHealth.ap_active

    // The deep checks keep their last verified values while the health is unverified.
    property var deepCheckState: ({ gateway: false, dns: false, internet: false })
    onWifiHealthChanged: syncDeepCheck()
    function syncDeepCheck() {
        if (wifiHealth && !wifiHealth.verified) return
        deepCheckState = {
            gateway: wifiHealth && wifiHealth.gateway_reachable !== undefined && wifiHealth.gateway_reachable !== null ? !!wifiHealth.gateway_reachable : false,
            dns: wifiHealth && wifiHealth.dns_resolves !== undefined && wifiHealth.dns_resolves !== null ? !!wifiHealth.dns_resolves : false,
            internet: wifiHealth && wifiHealth.internet_reachable !== undefined && wifiHealth.internet_reachable !== null ? !!wifiHealth.internet_reachable : false
        }
    }

    function check(ok) {
        if (isHotspotActive) return "N/A"
        if (!wifiHealth) return ""
        return ok ? "OK" : "FAILED"
    }

    readonly property var wifiItems: {
        if (!query.isSuccess || !wifiData) return initialWifiItems
        const valuesMap = {
            network: (wifiStatus && wifiStatus.connection_name) || "",
            hostname: (wifiStatus && wifiStatus.hostname) || "",
            ap_name: (networkConfig && networkConfig.apName) || "",
            ap_password: (networkConfig && networkConfig.apPassword) || "",
            ips: (wifiStatus && wifiStatus.ips && wifiStatus.ips[0]) || "",
            mac: (wifiStatus && wifiStatus.mac) || "",
            health: WifiHealth.getWifiHealthStatusLabel(wifiHealth, wifiStatus ? wifiStatus.connected : undefined),
            gateway: check(deepCheckState.gateway),
            dns: check(deepCheckState.dns),
            internet: check(deepCheckState.internet),
            last_error: WifiHealth.getWifiHealthMessage(wifiHealth),
            recovery: WifiHealth.getWifiRecoveryMessage(wifiHealth)
        }
        return initialWifiItems.map(item => item.key === "back"
            ? item
            : { key: item.key, label: item.label + ": " + (valuesMap[item.key] || "") })
    }

    property int observer: 0
    Component.onCompleted: {
        syncDeepCheck()
        observer = query.observe(false)
    }
    Component.onDestruction: query.unobserve(observer)

    GestureHandler {
        enabled: screen.inBubble ? Nav.bubbleInterceptsGesture : !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.wifiItems.length - 1)
        onPressDown: {
            if (screen.wifiItems[screen.activeIndex].key === "back")
                Nav.setBubbleDisplay({ visible: true, component: "wifiSettings" })
        }
    }

    OptionsMenu {
        visible: !screen.query.isLoading
        options: screen.wifiItems
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
