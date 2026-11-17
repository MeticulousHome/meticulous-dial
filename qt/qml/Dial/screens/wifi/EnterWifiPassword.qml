// The password of the selected network (src/components/Wifi/EnterWifiPassword.tsx), a route: the
// CircleKeyboard "password for <ssid>"; its submit connects (POST /wifi/connect, PSK). With the saved
// credentials (UiState.selectedWifiUseKnownCredentials) it connects at once, without the keyboard. The
// loading screen shows while connecting, then the result with "OK": "Connected" (with the health label and
// message when the link is degraded) or the error ("Check password" for invalid credentials, "Check WiFi"
// when joining failed, else "Could not connect to WiFi") with the reason. "OK" after an error goes back to
// the keyboard (keeping what was typed) unless the security is unsupported; otherwise it goes home.
// Cancelling the keyboard returns to the previous screen and reopens the scan (or the saved network's menu
// when it came from there and the bubble had not finished closing). The screen dims with the idle timer.
import QtQuick
import Dial
import "WifiHealth.js" as WifiHealth

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false

    property var knownPassword: undefined
    property bool knownConnectionSubmitted: false

    readonly property string selectedWifi: UiState.selectedWifi
    readonly property bool useKnownCredentials: UiState.selectedWifiUseKnownCredentials

    WifiMutation {
        id: connectMutation
        fn: credentials => WifiStore.connect(credentials)
    }

    readonly property var connectionError: connectMutation.error
    readonly property bool isInvalidCredentials: connectMutation.isError && !!connectionError && connectionError.code === "invalid_credentials"
    readonly property bool shouldReturnToPassword: connectMutation.isError && !!selectedWifi
                                                   && !(connectionError && connectionError.code === "unsupported_security")

    readonly property bool showLoading: connectMutation.isPending
                                        || (useKnownCredentials && !connectMutation.isError && !connectMutation.isSuccess)
    readonly property bool showResult: !showLoading && (connectMutation.isError || connectMutation.isSuccess)
    readonly property bool showKeyboard: !showLoading && !showResult

    // useDimScreen: the backlight follows the idle timer while this screen is up.
    Connections {
        target: Idle
        function onIsIdleChanged() {
            Api.setBrightness({ brightness: Idle.isIdle ? 0 : 1 }).catch(e => console.error("Error setting brightness", e && e.message))
        }
    }

    // A known network connects at once, once per selection (effects: they run after the bindings settle).
    function submitKnownConnection() {
        if (!useKnownCredentials || !selectedWifi || knownConnectionSubmitted) return
        knownConnectionSubmitted = true
        connectMutation.mutate({ type: "PSK", ssid: selectedWifi })
    }
    function selectionChanged() {
        knownConnectionSubmitted = false
        submitKnownConnection()
    }
    onSelectedWifiChanged: Qt.callLater(selectionChanged)
    onUseKnownCredentialsChanged: Qt.callLater(selectionChanged)
    Component.onCompleted: Qt.callLater(submitKnownConnection)

    function updateSetting(password) {
        knownPassword = password
        connectMutation.mutate({ type: "PSK", ssid: selectedWifi, password: password })
    }

    function onCancel() {
        // Read before setScreen: the bubble has not changed yet.
        const previous = Nav.bubblePreviousComponent
        Nav.setScreen(Nav.prev || "profileHome")
        Nav.setBubbleDisplay({ visible: true, component: previous === "deleteKnowWifiMenu" ? "deleteKnowWifiMenu" : "selectWifi" })
    }

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture && screen.showResult
        onPressDown: {
            if (screen.shouldReturnToPassword) {
                connectMutation.reset()
                if (screen.selectedWifi) UiState.selectWifi({ ssid: screen.selectedWifi, useKnownCredentials: false })
                return
            }
            Nav.setScreen("profileHome")
        }
    }

    LoadingScreen {
        visible: screen.showLoading
    }

    WifiResponse {
        id: result
        visible: screen.showResult
        readonly property var connectHealth: connectMutation.data ? connectMutation.data.health : undefined
        readonly property bool hasConnectionWarning: !!(connectHealth && connectHealth.degraded)
        title: connectMutation.isError
            ? (screen.isInvalidCredentials ? "Check password"
               : (screen.connectionError && screen.connectionError.code === "wifi_join_failed" ? "Check WiFi" : "Could not connect to WiFi"))
            : "Connected"
        status: connectMutation.isSuccess && hasConnectionWarning ? WifiHealth.getWifiHealthStatusLabel(connectHealth, true) : ""
        message: connectMutation.isError
            ? ((screen.connectionError && screen.connectionError.message) || "")
            : (hasConnectionWarning ? WifiHealth.getWifiHealthMessage(connectHealth) : "")
        hasMessage: connectMutation.isError || hasConnectionWarning
    }

    // Mounted only while it shows, as in React (it starts again from knownPassword).
    Loader {
        anchors.fill: parent
        active: screen.showKeyboard
        sourceComponent: CircleKeyboard {
            name: "password for " + screen.selectedWifi
            defaultValue: screen.knownPassword === undefined ? "" : screen.knownPassword
            capitalizeFirstLetter: false
            onSubmitted: text => screen.updateSetting(text)
            onCancelled: screen.onCancel()
            onEdited: text => screen.knownPassword = text
        }
    }
}
