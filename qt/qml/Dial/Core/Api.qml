pragma Singleton
// The machine's REST API: what @meticulous-home/espresso-api 0.15 (src/api/*.ts) calls, over XMLHttpRequest.
// Every call returns a Promise that resolves with the parsed body of a 2xx answer and rejects otherwise
// with { status, data, message } (status 0: no answer), as axios does.
import QtQuick
import Dial.Native

QtObject {
    id: api

    readonly property string base: String(Native.apiUrl).replace(/\/$/, "")
    readonly property string v: "/api/v1"

    function url(path) { return base + path }

    // A request; options: { timeout (ms), raw (resolve with the response text), headers }.
    function request(method, path, body, options) {
        options = options || {}
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            let done = false
            let timer = null
            if (options.timeout) {
                timer = Qt.createQmlObject("import QtQml; Timer { repeat: false }", api)
                timer.interval = options.timeout
                timer.triggered.connect(() => {
                    if (done) return
                    done = true
                    xhr.abort()
                    timer.destroy()
                    reject({ status: 0, data: null, message: "timeout of " + options.timeout + "ms exceeded" })
                })
                timer.start()
            }
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== XMLHttpRequest.DONE || done) return
                done = true
                if (timer) { timer.stop(); timer.destroy() }
                let data = xhr.responseText
                if (!options.raw && data && data.length) {
                    try { data = JSON.parse(data) } catch (e) { /* not JSON: keep the text */ }
                }
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(options.withStatus ? { status: xhr.status, data: data } : data)
                } else {
                    reject({ status: xhr.status, data: data,
                             message: (data && data.error) || (data && data.message) || ("HTTP " + xhr.status + " " + method + " " + path) })
                }
            }
            xhr.open(method, path.startsWith("http") ? path : url(path))
            const headers = options.headers || {}
            for (const k in headers) xhr.setRequestHeader(k, headers[k])
            if (body !== undefined && body !== null && typeof body !== "string") {
                xhr.setRequestHeader("Content-Type", "application/json")
                xhr.send(JSON.stringify(body))
            } else if (typeof body === "string") {
                xhr.send(body)
            } else {
                xhr.send()
            }
        })
    }
    function get(path, options) { return request("GET", path, null, options) }
    function post(path, body, options) { return request("POST", path, body === undefined ? null : body, options) }
    function put(path, body, options) { return request("PUT", path, body, options) }
    function del(path, options) { return request("DELETE", path, null, options) }

    function query(params) {
        const parts = []
        for (const k in params) {
            if (params[k] === undefined || params[k] === null) continue
            parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
        }
        return parts.length ? "?" + parts.join("&") : ""
    }

    // ---- actions and profiles
    function executeAction(action) { return get(v + "/action/" + action) }
    function listProfiles() { return get(v + "/profile/list") }
    function fetchAllProfiles() { return get(v + "/profile/list?full=true") }
    function saveProfile(profile) { return post(v + "/profile/save", profile) }
    function loadProfileFromJSON(profile) { return post(v + "/profile/load", profile) }
    function loadProfileByID(id) { return get(v + "/profile/load/" + id) }
    function getProfile(id) { return get(v + "/profile/get/" + id) }
    function deleteProfile(id) { return del(v + "/profile/delete/" + id) }
    function getLastProfile() { return get(v + "/profile/last") }
    function getProfileDefaultImages() { return get(v + "/profile/image") }
    function getDefaultProfiles() { return get(v + "/profile/defaults") }
    // A profile's image: the backend's own path ("/api/v1/profile/image/x.png") or a bare image name.
    function profileImageUrl(image) {
        if (!image) return ""
        if (image.startsWith("http") || image.startsWith("file:") || image.startsWith("qrc:") || image.startsWith("data:")) return image
        if (image.startsWith("/")) return base + image
        return base + v + "/profile/image/" + image
    }

    // ---- notifications
    function getNotifications(acknowledged) { return get(v + "/notifications?acknowledged=" + (acknowledged ? "true" : "false")) }
    function acknowledgeNotification(data) { return post(v + "/notifications/acknowledge", data) }

    // ---- settings and machine
    function getSettings(name) { return get(v + "/settings/" + (name || "")) }
    function updateSetting(setting) { return post(v + "/settings/", setting) }
    function getManufacturingMenuItems() { return request("GET", v + "/manufacturing", null, { withStatus: true }) }
    function updateManufacturingSettings(setting) { return post(v + "/manufacturing", setting) }
    function getDeviceInfo() { return get(v + "/machine") }
    function unlockMachine(code) { return request("POST", v + "/machine/unlock", { code: code }, { withStatus: true }) }
    function setBrightness(brightness) { return post(v + "/machine/backlight", brightness) }
    function getOSStatus() { return get(v + "/machine/OS_update_status") }
    function getRootPassword() { return get(v + "/machine/root-password") }
    // setTime(Date): the backend takes the date as an ISO string.
    function setTime(date) { return post(v + "/machine/time", { date: date.toISOString() }) }
    function factoryReset() { return get(v + "/machine/factory_reset?confirm=true") }
    function getTimezoneRegion(regionType, filter) { return get(v + "/timezones/" + regionType + query({ filter: filter })) }

    // ---- wifi
    function getWiFiStatus() { return get(v + "/wifi/config") }
    function setWiFiConfig(config) { return post(v + "/wifi/config", config) }
    function wifiQrUrl() { return base + v + "/wifi/config/qr.png" }
    function listAvailableWiFi() { return get(v + "/wifi/list") }
    function connectToWiFi(credentials) { return post(v + "/wifi/connect", credentials) }
    function deleteWifi(ssid) { return post(v + "/wifi/delete", { ssid: ssid }) }

    // ---- sounds and tests
    function playSound(sound) { return get(v + "/sounds/play/" + sound) }
    function listSounds() { return get(v + "/sounds/list") }
    function listSoundThemes() { return get(v + "/sounds/theme/list") }
    function getSoundTheme() { return get(v + "/sounds/theme/get") }
    function setSoundTheme(theme) { return post(v + "/sounds/theme/set/" + theme) }
    function requestTest(test) { return get(v + "/test/" + test) }

    // ---- history
    function getHistoryShortListing() { return get(v + "/history") }
    function searchHistory(q) { return post(v + "/history", q) }
    function searchHistoricalProfiles(q) { return get(v + "/history/search?query=" + encodeURIComponent(q)) }
    function getCurrentShot() { return get(v + "/history/current") }
    function getLastShot() { return get(v + "/history/last") }
    function getHistoryStatistics() { return get(v + "/history/stats") }
    function rateShot(shotId, rating) { return post(v + "/history/rating/" + shotId, { rating: rating }) }
    function getShotRating(shotId) { return get(v + "/history/rating/" + shotId) }

    // ---- reports (bug report flow); 15 s timeouts like espresso-api's reportRequestConfig defaults
    function createReport(req, options) { return post(v + "/reports/create", req || {}, options) }
    function requestReport(options) { return post(v + "/reports/request", null, options || { timeout: 15000 }) }
    function dispatchReport(dispatch, options) { return post(v + "/reports/dispatch", dispatch, options || { timeout: 15000 }) }
    function getPendingReportDispatches(options) { return get(v + "/reports/dispatch", options || { timeout: 15000 }) }
    function getReportPreflight(probes, options) {
        const q = (probes || []).map(p => "probe=" + encodeURIComponent(p)).join("&")
        return get(v + "/reports/preflight" + (q ? "?" + q : ""), options || { timeout: 15000 })
    }
    function getReports(pageParams, options) { return get(v + "/reports/list" + query(pageParams || {}), options) }
    function getDraftReport(localID, options) { return get(v + "/reports/draft/" + encodeURIComponent(localID), options) }
    function deleteDraftReport(localID, options) { return del(v + "/reports/draft/" + encodeURIComponent(localID), options) }
    function updateReport(id, patch, options) { return put(v + "/reports/draft/" + encodeURIComponent(id), patch, options) }
    function markSubmittedReport(info, options) { return post(v + "/reports/submit", info, options) }

    // ---- pour over (Free Pour) and manual mode: see the features that use them
}
