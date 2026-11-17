pragma Singleton
// The backend's notifications (notification-slice.ts): an id-keyed list, and whether the motor is hot
// (notifications whose message carries "motor_hot" / "motor_cold").
import QtQuick

QtObject {
    id: store

    // NotificationItem: { id, message, image, responses: [string], timestamp }
    property var items: []
    readonly property int count: items.length
    readonly property bool hasNotifications: items.length > 0
    property bool motorHot: false

    readonly property string motorHotKey: "motor_hot"
    readonly property string motorColdKey: "motor_cold"

    function load() {
        return Api.getNotifications(false).then(list => {
            if (list && list.error) throw new Error(list.error)
            if (list === undefined || list === null) throw new Error("No notifications found")
            items = list
        }).catch(error => console.error("loadNotifications failed:", error && error.message ? error.message : error))
    }

    function cleanMessage(message, key) { return key ? message.replace(key, "").trim() : message }

    // processNotification: strips the motor key from the message and says whether the motor is hot.
    function process(notification) {
        const map = {}
        map[motorHotKey] = true
        map[motorColdKey] = false
        const message = notification.message || ""
        const detectedKey = Object.keys(map).find(k => message.includes(k)) || null
        return {
            updatedNotification: Object.assign({}, notification, { message: cleanMessage(message, detectedKey) }),
            isMotorHot: detectedKey ? map[detectedKey] : null,
            detectedKey: detectedKey
        }
    }

    function addOne(notification) {
        const next = items.slice()
        const i = next.findIndex(n => n.id === notification.id)
        if (i >= 0) next[i] = Object.assign({}, next[i], notification)
        else next.push(notification)
        items = next
    }
    function removeOne(id) { items = items.filter(n => n.id !== id) }
    function removeAll() { items = [] }
    function setMotorHot(value) { motorHot = !!value }
}
