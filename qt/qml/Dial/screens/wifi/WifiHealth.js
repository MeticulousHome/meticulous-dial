// The Wi-Fi health texts (src/components/Wifi/wifiHealthMessages.ts) and the error mapping of the Wi-Fi
// calls (src/api/wifi.ts getApiErrorMessage / getApiErrorCode), as pure functions.
.pragma library

function getWifiHealthMessage(health) {
    if (!health) return ""

    if (health.mode === "AP" && health.ap_active)
        return health.message || "Hotspot active. Connect your phone or computer to the machine's Wi-Fi network."

    if (!health.degraded) return "HEALTHY"

    if (health.message) return health.message

    switch (health.last_error) {
    case "internet_unreachable":
        return "Connected to Wi-Fi, but this network does not appear to have internet access. Check the router or phone hotspot data connection."
    case "dns_unreachable":
        return "Connected to Wi-Fi, but DNS is not working. Check the router internet or DNS settings."
    case "gateway_unreachable":
        return "Connected to Wi-Fi, but the router is not responding. Move closer or restart the router."
    case "missing_ipv4":
        return "Connected to Wi-Fi, but the router did not assign an IP address. Check DHCP settings on the router."
    case "wifi_device_unavailable":
        return "Wi-Fi is still starting. Wait a moment and try again."
    case "wifi_not_connected":
        return "The machine is not connected to Wi-Fi."
    case "hotspot_not_active":
        return "The machine could not start its Wi-Fi hotspot. Please try again."
    default:
        return "Wi-Fi could not be verified. Please check the network and try again."
    }
}

// connected defaults to true, as the TypeScript default parameter (undefined → true).
function getWifiHealthStatusLabel(health, connected) {
    if (connected === undefined) connected = true
    if (!connected) return "NOT CONNECTED"

    if (!health) return "UNKNOWN"

    if (health.mode === "AP" && health.ap_active) return "HOTSPOT ACTIVE"

    if (!health.degraded) return "CONNECTED"

    switch (health.last_error) {
    case "internet_unreachable": return "NO INTERNET"
    case "dns_unreachable": return "DNS ISSUE"
    case "gateway_unreachable": return "ROUTER ISSUE"
    case "missing_ipv4": return "NO IP ADDRESS"
    case "wifi_device_unavailable": return "WIFI STARTING"
    case "wifi_not_connected": return "NOT CONNECTED"
    case "hotspot_not_active": return "HOTSPOT ISSUE"
    default: return "CHECK NETWORK"
    }
}

function getWifiRecoveryMessage(health) {
    if (!health || !health.last_recovery_result) return ""

    switch (health.last_recovery_result) {
    case "not_needed": return "No repair needed"
    case "not_recoverable": return "Network/router issue"
    case "recovered": return "Repaired"
    case "failed": return "Repair failed"
    case "in_progress": return "Repairing"
    default: return health.last_recovery_result
    }
}

// ---- src/api/wifi.ts. Api rejects with { status, data, message }: status 0 means no answer (axios'
// error without `response`), anything else an answer (`error.response`, its body in data).

function hasResponse(error) { return !!error && typeof error === "object" && typeof error.status === "number" && error.status > 0 }

// getApiErrorMessage: the answer's `error` or `message`; without an answer, the error's own message.
function getApiErrorMessage(error, fallback) {
    if (hasResponse(error)) {
        const data = error.data
        if (data && typeof data === "object") return data.error || data.message || fallback
        return fallback
    }
    if (error && error.message) return error.message
    return fallback
}

function getApiErrorCode(error) {
    if (hasResponse(error) && error.data && typeof error.data === "object") return error.data.code
    return undefined
}

// The `error.response.data?.message || fallback` of the other wrappers.
function responseMessage(error, fallback) {
    const data = error.data
    return (data && typeof data === "object" && data.message) || fallback
}

// A 2xx body that carries `error` is thrown inside the wrappers' try and lands in their catch without a
// `response`: it surfaces as the wrapper's network error (getWifiStatus, updateNetworkConfig,
// listAvailableWiFi, deleteKnownWifi) or with its own text (connectToWiFi).
function bodyHasError(data) { return !!data && typeof data === "object" && !Array.isArray(data) && ("error" in data) }

// What axios calls an error without an answer (the connect wrapper shows it).
function networkErrorMessage(error) {
    if (error && typeof error.message === "string" && error.message.indexOf("timeout of") === 0) return error.message
    return "Network Error"
}
