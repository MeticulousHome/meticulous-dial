// The time zones of the chosen country (src/components/Settings/Advanced/TimeDate/TimeZone/
// TimeZoneSettings.tsx), a full-screen route: GET /timezones/cities?filter=<country>, each city with its zone
// name next to it while focused, under "Back". Back returns to the countries; a city stores its zone
// (time_zone) and goes to the barometer (which returns home while the machine is idle) with the time zone
// menu open, as the React Dial does.
import QtQuick
import Dial
import "../settings"

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    property var cities: []      // [{ city: zone }]
    readonly property var dialProbe_cities: cities
    readonly property string dialFocusedLabel: list.activeIndex === 0 ? "Back"
                                              : cities[list.activeIndex - 1] ? Object.keys(cities[list.activeIndex - 1])[0] : ""

    DimScreen {}

    Component.onCompleted: {
        Api.getTimezoneRegion("cities", UiState.country).then(result => {
            if (result && result.error) throw new Error(result.error)
            screen.cities = result && result.cities ? result.cities : []
        }).catch(error => {
            console.log("Error fetching cities: ", error && error.message ? error.message : error)
            screen.cities = []
        })
    }

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onTurnLeft: {
            list.activeIndex = Math.max(list.activeIndex - 1, 0)
            console.log("left, nextActiveIndex", list.activeIndex)
        }
        onTurnRight: {
            list.activeIndex = Math.min(list.activeIndex + 1, screen.cities.length)
            console.log("rigth, nextActiveIndex", list.activeIndex)
        }
        onPressDown: {
            if (list.activeIndex === 0) {
                Nav.setScreen("countrySettings")
                return
            }
            const entry = screen.cities[list.activeIndex - 1]
            const zone = entry[Object.keys(entry)[0]]
            // setTimezone: the answer is not awaited (the settings poll picks it up).
            Api.updateSetting({ time_zone: zone }).then(data => {
                if (data && data.error) throw new Error(data.error)
            }).catch(error => console.error("Error setting timezone", error && error.message ? error.message : error))
            console.log("Seleccionar Ciudad/TimeZone:", zone)
            Nav.setBubbleDisplay({ visible: true, component: "timeZoneConfig" })
            Nav.setScreen("barometer")
        }
    }

    RegionList {
        id: list
        title: "Timezones"
        items: screen.cities.map(c => {
            const city = Object.keys(c)[0]
            return { label: city, detail: c[city] }
        })
    }
}
