// useNetworkConfig({ idle: true }) as the sleep clocks use it: the Wi-Fi status, fetched on mount and every
// 60 s (IDLE_NETWORK_REFETCH_INTERVAL). connected is networkConfig?.status.connected.
import QtQuick
import Dial

QtObject {
    id: network

    property var data: null
    readonly property bool connected: !!(data && data.status && data.status.connected)

    function refetch() {
        Api.getWiFiStatus().then(value => {
            if (value && !value.error) network.data = value
        }).catch(error => console.error("Error fetching Network Config:", error && error.message ? error.message : error))
    }

    property Timer _poll: Timer {
        interval: 60000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: network.refetch()
    }
}
