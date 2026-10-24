// Manufacturing Options (src/components/Settings/Advanced/Manufacturing.tsx, hooks/useManufacturing.ts), in
// the bubble: one ENABLED / DISABLED toggle per element of GET /manufacturing (Enable Manufacturing, Skip
// Stage), "ACAIA master calibration" and Back. The current values come from POST /manufacturing {} (the
// GET does not reflect changes); each toggle posts the change and shows what the backend answers. Master
// calibration closes the bubble, opens the calibration lock and raises a warning notification over it.
// The loading ring until both answers are in.
import QtQuick
import Dial

Item {
    id: screen
    anchors.fill: parent
    property bool inBubble: false

    property var manufacturing: ({ enabled: true, last_boot_mode: "manufacturing", skip_stage: false })
    property bool configLoading: true

    readonly property var schema: SettingsStore.manufacturingSchema
    readonly property bool schemaSuccess: SettingsStore.manufacturingSchemaSuccess
    readonly property bool loading: configLoading || SettingsStore.manufacturingSchemaPending

    readonly property var options: {
        if (!schema && !schemaSuccess) return []
        const elements = schemaSuccess && schema && schema.Elements ? schema.Elements : []
        return elements.map(e => ({ key: e.key, label: e.label + ": " + (manufacturing[e.key] ? "ENABLED" : "DISABLED") }))
            .concat([{ key: "master_calibration", label: "ACAIA master calibration" }, { key: "back", label: "Back" }])
    }

    Component.onCompleted: {
        SettingsStore.fetchManufacturingSchema()
        Api.updateManufacturingSettings({}).then(data => {
            if (data && data.enabled !== undefined) manufacturing = data
            else console.error("Failed to fetch manufacturing settings:", JSON.stringify(data))
            configLoading = false
        }).catch(error => {
            console.error("Failed to fetch manufacturing settings:", error && error.message ? error.message : error)
            configLoading = false
        })
    }

    function mutate(change) {
        Api.updateManufacturingSettings(change).then(data => { manufacturing = data })
            .catch(error => console.error("Failed to update manufacturing settings", error && error.message ? error.message : error))
    }

    // uuid v4 for the notification id.
    function uuid() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0
            return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16)
        })
    }

    GestureHandler {
        enabled: Nav.bubbleInterceptsGesture && !screen.loading
        onTurnLeft: menu.previous()
        onTurnRight: menu.next()
        onPressDown: {
            const item = screen.options[menu.activeIndex]
            if (!item) return
            console.log("activeItem", item.key)
            switch (item.key) {
            case "enabled":
                screen.mutate({ enabled: !screen.manufacturing.enabled })
                break
            case "skip_stage":
                screen.mutate({ skip_stage: !screen.manufacturing.skip_stage })
                break
            case "back":
                Nav.openBubble("advancedSettings")
                break
            case "master_calibration": {
                const alert = Notifications.process({
                    id: screen.uuid(),
                    message: "WARNING: Proceeding incorrectly can permanently damage your scale and may make it unusable. Only continue if you fully understand this procedure and accept the risk.",
                    responses: ["OK"],
                    timestamp: new Date().toISOString()
                }).updatedNotification
                Nav.closeBubble()
                Nav.setScreen("masterCalibrationLock")
                Notifications.addOne(alert)
                break
            }
            }
        }
    }

    LoadingScreen { visible: screen.loading }

    OptionsMenu {
        id: menu
        visible: !screen.loading
        options: screen.options
    }
}
