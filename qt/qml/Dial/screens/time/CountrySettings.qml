// The countries starting with the chosen letter (src/components/Settings/Advanced/TimeDate/TimeZone/
// CountrySettings.tsx), a full-screen route: GET /timezones/countries?filter=<letter>, listed under "Back".
// Back returns to the letter; a country lists its time zones.
import QtQuick
import Dial
import "../settings"

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    property var countries: []
    readonly property var dialProbe_countries: countries
    readonly property string dialFocusedLabel: list.activeIndex === 0 ? "Back" : String(countries[list.activeIndex - 1] || "")

    DimScreen {}

    Component.onCompleted: {
        Api.getTimezoneRegion("countries", UiState.countryLetter.toLowerCase()).then(result => {
            if (result && result.error) throw new Error(result.error)
            screen.countries = result && result.countries ? result.countries : []
        }).catch(error => {
            screen.countries = []
            console.log("Error fetching countries: ", error && error.message ? error.message : error)
        })
    }

    GestureHandler {
        enabled: !Nav.bubbleInterceptsGesture
        onTurnLeft: list.activeIndex = Math.max(list.activeIndex - 1, 0)
        onTurnRight: list.activeIndex = Math.min(list.activeIndex + 1, screen.countries.length)
        onPressDown: {
            if (list.activeIndex === 0) {
                Nav.setScreen("selectLetterCountry")
            } else {
                UiState.country = screen.countries[list.activeIndex - 1]
                Nav.setScreen("timeZoneSettings")
            }
        }
    }

    RegionList {
        id: list
        title: "Country"
        items: screen.countries.map(c => ({ label: c, detail: "" }))
    }
}
