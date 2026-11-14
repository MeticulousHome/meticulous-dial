pragma Singleton
// Fonts, colors and shared sizes of the Dial (src/globals.css, src/constants/colors.ts, mixins.ts).
import QtQuick

QtObject {
    id: theme

    // ABC Diatype: regular and light (300) share the family; thin (200) and the mono cuts are the trial
    // files, with their own family names.
    readonly property FontLoader _regular: FontLoader { source: "../assets/fonts/abc-diatype-regular.otf" }
    readonly property FontLoader _light: FontLoader { source: "../assets/fonts/abc-diatype-light.otf" }
    readonly property FontLoader _thin: FontLoader { source: "../assets/fonts/abc-diatype-thin.otf" }
    readonly property FontLoader _mono: FontLoader { source: "../assets/fonts/abc-diatype-mono-regular-trial.otf" }
    readonly property FontLoader _monoLight: FontLoader { source: "../assets/fonts/abc-diatype-mono-light-trial.otf" }
    readonly property FontLoader _monoThin: FontLoader { source: "../assets/fonts/abc-diatype-mono-thin-trial.otf" }
    readonly property FontLoader _icons: FontLoader { source: "../assets/fonts/custom/font/fontello.ttf" }
    readonly property FontLoader _lato: FontLoader { source: "../assets/fonts/Lato-Regular.ttf" }

    // 'ABC Diatype' (font-weight normal / 300 → Font.Light)
    readonly property string fontRegular: "ABC Diatype"
    // 'ABC Diatype' at font-weight 200
    readonly property string fontThin: "ABC Diatype Unlicensed Trial"
    // 'ABC Diatype Mono' (normal / 300 → Font.Light / 200 → Font.Thin)
    readonly property string fontMono: "ABC Diatype Mono Unlicensed Trial"
    readonly property string fontIcons: "fontello"
    readonly property string fontLato: "Lato"

    // src/constants/colors.ts
    readonly property color brandRed: "#FC1D22"
    readonly property color brandBrown: "#A56751"
    readonly property color brandYellow: "#F5C444"
    readonly property color black: "#000000"
    readonly property color white: "#ffffff"
    readonly property color gray1: "#202020"
    readonly property color gray2: "#272727"
    readonly property color gray3: "#403F3F"
    readonly property color gray4: "#585856"
    readonly property color gray5: "#70706E"
    readonly property color gray6: "#898886"
    readonly property color gray7: "#A1A09E"
    readonly property color gray8: "#B9B9B5"
    readonly property color gray9: "#D2D1CD"
    readonly property color gray10: "#EAE9E5"
    readonly property color dataBlueLight: "#78D6FF"
    readonly property color dataRed: "#FF5844"
    readonly property color dataGreenLight: "#7BEEBF"
    readonly property color dataYellow: "#FDC352"
    readonly property color dataWhite: "#FFFFFF"
    readonly property color dataYellowBright: "#F0F000"

    // Colors the components use over and over.
    readonly property color cream: "#e0dcd0"          // titles, bottom status
    readonly property color menuGray: "#565656"       // unfocused menu options
    readonly property color bubble: "#0f0f0f"         // the context menu panel
    readonly property color pillBorder: "#5d5d5d"     // the navigation title pill
    readonly property color error: "#f44336"
    readonly property color warning: "#ffc107"
    readonly property color textGray: "#5e5e5e"

    // The menus (src/styles/utils/mixins.ts).
    readonly property int viewport: 480
    readonly property int itemHeight: 45
    readonly property int itemMargin: 16
    readonly property int extraMarginAfterBorder: 10
    readonly property int marqueeMinTextLength: 22

    function asset(path) { return Qt.resolvedUrl("../assets/" + path) }
    function publicImage(path) { return Qt.resolvedUrl("../assets/public/" + path) }
}
