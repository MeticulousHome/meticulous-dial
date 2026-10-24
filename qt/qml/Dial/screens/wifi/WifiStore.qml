pragma Singleton
// The Wi-Fi data of the React Dial: the calls of src/api/wifi.ts (their error texts included) and the
// queries / mutation effects of src/hooks/useWifi.tsx. The selected network (the wifi slice) lives in
// UiState (selectedWifi, selectedWifiUseKnownCredentials, selectedWifiToDelete).
//
//   networkConfig  useNetworkConfig: GET /wifi/config, stale after 2 s, polled every 5 s (60 s for an idle
//                  observer); its data is { config: { mode, apName, apPassword }, status: { connected,
//                  connection_name, hostname, ips, mac, ... }, health, known_wifis }
//   wifiList       useAvailableWiFiList: GET /wifi/list, refetched on every mount and every 5 s
//   connect / deleteKnown / repair / updateConfig: the calls behind the mutations, with the hooks'
//                  invalidations on success
import QtQuick
import Dial
import "WifiHealth.js" as WifiHealth

QtObject {
    id: store

    readonly property string modeAP: "AP"          // APMode.AP
    readonly property string modeClient: "CLIENT"  // APMode.CLIENT

    property WifiQuery networkConfig: WifiQuery {
        staleTime: 2000
        refetchInterval: 5000
        idleInterval: 60000
    }

    property WifiQuery wifiList: WifiQuery {
        staleTime: 5000
        refetchInterval: 5000
        refetchOnMountAlways: true
    }

    Component.onCompleted: {
        networkConfig.fetchFn = () => store.getWifiStatus()
        wifiList.fetchFn = () => store.listAvailableWiFi()
    }

    function _fail(message, code) {
        const e = { message: message }
        if (code !== undefined) e.code = code
        return e
    }
    function _dump(data) {
        try { return typeof data === "string" ? data : JSON.stringify(data) } catch (e) { return String(data) }
    }
    // `'error' in data` throws on anything that is not an object; both land in the wrappers' catch.
    function _bodyFails(data) { return data === null || data === undefined || typeof data !== "object" || ("error" in data) }

    // ---- src/api/wifi.ts

    // getWifiStatus (getWiFiConfig)
    function getWifiStatus() {
        return Api.getWiFiStatus().then(data => {
            if (_bodyFails(data)) {
                console.error("Network error while fetching Network Config: ", data && data.error)
                throw _fail("Network error while fetching Network Config.")
            }
            return data
        }, error => {
            if (error && error.status > 0) {
                console.error("Error fetching Network Config: ", _dump(error.data))
                throw _fail(WifiHealth.responseMessage(error, "Error fetching Network Config."))
            }
            console.error("Network error while fetching Network Config: ", error && error.message)
            throw _fail("Network error while fetching Network Config.")
        })
    }

    // repairWifi: a fetch() POST; resolves with the answer's health.
    function repairWifi() {
        return Api.post(Api.v + "/wifi/repair", null).then(data => {
            if (data === null || typeof data !== "object") {
                // response.json() of a body that is not an object: 'error' in data throws.
                console.error("Network error while repairing Wi-Fi: ", _dump(data))
                throw _fail("Error repairing Wi-Fi.")
            }
            if ("error" in data) {
                console.error("Network error while repairing Wi-Fi: ", data.error)
                throw _fail(data.error || "Error repairing Wi-Fi.")
            }
            return data.health
        }, error => {
            if (error && error.status > 0) {
                const data = error.data
                const message = data && typeof data === "object" ? (data.error || "Error repairing Wi-Fi.") : "Error repairing Wi-Fi."
                console.error("Network error while repairing Wi-Fi: ", message)
                throw _fail(message)
            }
            // fetch() rejects with WebKit's TypeError.
            console.error("Network error while repairing Wi-Fi: ", "Load failed")
            throw _fail("Load failed")
        })
    }

    // updateNetworkConfig (setWiFiConfig): resolves with the answer, which is the whole wifi status.
    function updateNetworkConfig(config) {
        return Api.setWiFiConfig(config).then(data => {
            if (_bodyFails(data)) {
                console.error("Network error while updating Network Config: ", data && data.error)
                throw _fail("Network error while updating Network Config.")
            }
            return data
        }, error => {
            if (error && error.status > 0) {
                console.error("Error updating Network Config: ", _dump(error.data))
                throw _fail(WifiHealth.getApiErrorMessage(error, "Error updating Network Config."))
            }
            console.error("Network error while updating Network Config: ", error && error.message)
            throw _fail("Network error while updating Network Config.")
        })
    }

    // listAvailableWiFi
    function listAvailableWiFi() {
        return Api.listAvailableWiFi().then(data => {
            if (_bodyFails(data)) {
                console.error("Network error while listing available Wi-Fi: ", data && data.error)
                throw _fail("Network error while listing available Wi-Fi.")
            }
            return data
        }, error => {
            if (error && error.status > 0) {
                console.error("Error listing available Wi-Fi: ", _dump(error.data))
                throw _fail(WifiHealth.responseMessage(error, "Error listing available Wi-Fi."))
            }
            console.error("Network error while listing available Wi-Fi: ", error && error.message)
            throw _fail("Network error while listing available Wi-Fi.")
        })
    }

    // connectToWiFi: rejects with a WiFiConnectionError ({ message, code }).
    function connectToWiFi(credentials) {
        return Api.connectToWiFi(credentials).then(data => {
            if (data && typeof data === "object" && "error" in data) {
                console.error("Network error while connecting to Wi-Fi: ", data.error)
                throw _fail(data.error || "Network error while connecting to Wi-Fi.")
            }
            if (data && typeof data !== "object") {
                console.error("Network error while connecting to Wi-Fi: ", _dump(data))
                throw _fail("Network error while connecting to Wi-Fi.")
            }
            return data
        }, error => {
            if (error && error.status > 0) {
                console.error("Error connecting to Wi-Fi: ", _dump(error.data))
                throw _fail(WifiHealth.getApiErrorMessage(error, "Error connecting to Wi-Fi."), WifiHealth.getApiErrorCode(error))
            }
            console.error("Network error while connecting to Wi-Fi: ", error && error.message)
            throw _fail(WifiHealth.networkErrorMessage(error))
        })
    }

    // deleteKnownWifi (deleteWifi)
    function deleteKnownWifi(ssid) {
        return Api.deleteWifi(ssid).then(data => {
            if (data && (typeof data !== "object" || "error" in data)) {
                console.error("Network error while deleting known Wi-Fi: ", typeof data === "object" ? data.error : _dump(data))
                throw _fail("Network error while deleting known Wi-Fi.")
            }
        }, error => {
            if (error && error.status > 0) {
                console.error("Error deleting known Wi-Fi: ", _dump(error.data))
                throw _fail(WifiHealth.responseMessage(error, "Error deleting known Wi-Fi."))
            }
            console.error("Network error while deleting known Wi-Fi: ", error && error.message)
            throw _fail("Network error while deleting known Wi-Fi.")
        })
    }

    // ---- src/hooks/useWifi.tsx: the mutations' functions with their hook-level effects

    // useUpdateNetworkConfig
    function updateConfig(config) {
        return updateNetworkConfig(config).then(result => {
            console.log("Network Config updated successfully.")
            return result
        }, error => {
            console.error("Error updating Network Config:", error.message)
            throw error
        })
    }

    // useRepairWiFi
    function repair() {
        return repairWifi().then(result => {
            console.log("Wi-Fi repair completed successfully.")
            networkConfig.invalidate()
            return result
        }, error => {
            console.error("Error repairing Wi-Fi:", error.message)
            throw error
        })
    }

    // useConnectToWiFi
    function connect(credentials) {
        return connectToWiFi(credentials).then(result => {
            console.log("Connected to Wi-Fi successfully.")
            networkConfig.invalidate()
            wifiList.invalidate()
            return result
        }, error => {
            console.error("Error connecting to Wi-Fi:", error.message)
            throw error
        })
    }

    // useDeleteKnownWiFi
    function deleteKnown(ssid) {
        return deleteKnownWifi(ssid).then(result => {
            console.log("Known Wi-Fi deleted successfully.")
            networkConfig.invalidate()
            return result
        }, error => {
            console.error("Error deleting known Wi-Fi:", error.message)
            throw error
        })
    }
}
