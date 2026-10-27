// A saved network's menu (src/components/Wifi/DeleteWifiMenu.tsx), in the bubble: "connect" closes the
// bubble and connects with the saved credentials (EnterWifiPassword with useKnownCredentials), "delete"
// forgets it (POST /wifi/delete; the loading screen meanwhile, then back to the known networks) and "back"
// returns to them. A delete is retried 3 times (1, 2, 4 s); then "An error occured. Please try again" with
// the reason and "OK" (back to the known networks).
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false
    property bool transitioning: false

    property int activeIndex: 0

    readonly property var items: [
        { key: "connect", label: "connect" },
        { key: "delete", label: "delete" },
        { key: "back", label: "back" }
    ]

    // useDeleteKnownWiFi sets no retry: the QueryClient's 3 retries apply (the others set retry: false).
    WifiMutation {
        id: deleteMutation
        retries: 3
        fn: ssid => WifiStore.deleteKnown(ssid)
        // The React component dispatches this while rendering the success.
        onIsSuccessChanged: if (isSuccess) Nav.setBubbleDisplay({ visible: true, component: "KnownWifi" })
    }

    GestureHandler {
        enabled: screen.inBubble ? Nav.bubbleInterceptsGesture : !Nav.bubbleInterceptsGesture
        onTurnLeft: screen.activeIndex = Math.max(screen.activeIndex - 1, 0)
        onTurnRight: screen.activeIndex = Math.min(screen.activeIndex + 1, screen.items.length - 1)
        onPressDown: {
            if (deleteMutation.isError) {
                Nav.setBubbleDisplay({ visible: true, component: "KnownWifi" })
                return
            }
            switch (screen.items[screen.activeIndex].key) {
            case "connect":
                Nav.setBubbleDisplay({ visible: false, component: "" })
                UiState.selectWifi({ ssid: UiState.selectedWifiToDelete, useKnownCredentials: true })
                Nav.setScreen("enterWifiPassword")
                break
            case "delete":
                deleteMutation.mutate(UiState.selectedWifiToDelete)
                break
            case "back":
                Nav.setBubbleDisplay({ visible: true, component: "KnownWifi" })
                break
            }
        }
    }

    OptionsMenu {
        visible: !deleteMutation.isPending && !deleteMutation.isError
        options: screen.items
        activeIndex: screen.activeIndex
    }

    WifiResponse {
        visible: !deleteMutation.isPending && deleteMutation.isError
        title: "An error occured. Please try again"
        message: (deleteMutation.failureReason && deleteMutation.failureReason.message) || ""
    }

    // .loading-center is position: fixed: in the bubble it covers the whole display.
    LoadingScreen {
        visible: deleteMutation.isPending
        anchors.fill: undefined
        x: screen.inBubble ? screen.width - 480 : 0
        width: screen.inBubble ? 480 : screen.width
        height: screen.height
    }
}
