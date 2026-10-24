// The country's first letter (src/components/Settings/Advanced/TimeDate/TimeZone/SelectLetterCountry.tsx), a
// full-screen route: the circle keyboard, letters only, titled "Your country". Picking a letter lists the
// countries that start with it; cancelling returns home with the time zone menu open.
import QtQuick
import Dial
import "../settings"

Item {
    id: screen
    anchors.fill: parent
    property bool transitioning: false

    DimScreen {}

    CircleKeyboard {
        name: "Your country"
        defaultValue: ""
        onlyLetters: true
        onCancelled: {
            Nav.setScreen("profileHome")
            Nav.setBubbleDisplay({ visible: true, component: "timeZoneConfig" })
        }
        onEdited: (letter) => {
            UiState.countryLetter = letter
            Nav.setScreen("countrySettings")
        }
    }
}
