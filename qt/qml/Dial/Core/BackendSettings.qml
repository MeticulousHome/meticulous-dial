pragma Singleton
// The machine's settings (useSettings / useUpdateSettings): fetched every 2 s like the React query, and
// written with update(partial), which takes the backend's answer as the new value.
import QtQuick

QtObject {
    id: settings

    // The Settings object of the backend (enable_sounds, reverse_scrolling: { home, keyboard, menus },
    // idle_screen, heating_timeout, auto_preheat, time_zone, ... ) or null before the first answer.
    property var data: null
    readonly property bool isSuccess: data !== null
    property bool fetching: false
    property int interval: 2000

    signal updated(var data)

    property Timer _poll: Timer {
        interval: settings.interval
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: settings.refetch()
    }

    function refetch() {
        if (fetching) return Promise.resolve(data)
        fetching = true
        return Api.getSettings().then(value => {
            fetching = false
            if (value && value.error) throw new Error(value.error)
            if (JSON.stringify(value) !== JSON.stringify(data)) data = value
            return value
        }).catch(error => {
            fetching = false
            return data
        })
    }

    function update(partial) {
        return Api.updateSetting(partial).then(value => {
            if (value && value.error) throw new Error(value.error)
            console.log("User Settings updated successfully.")
            data = value
            updated(value)
            return value
        }).catch(error => {
            console.error("Error updating User Settings:", error && error.message ? error.message : error)
            throw error
        })
    }

    // The value of a setting, or the fallback while unknown.
    function value(key, fallback) {
        return data && data[key] !== undefined ? data[key] : fallback
    }

    // isLimitedAccess (espresso-api): the "factory" update channel puts the machine in limited access.
    readonly property string limitedAccessChannel: "factory"
    readonly property bool limitedAccess: !!(data && data.update_channel === limitedAccessChannel)
}
