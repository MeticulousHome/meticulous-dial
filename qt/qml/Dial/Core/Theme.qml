pragma Singleton
// Fonts, colors and shared sizes of the Dial (src/globals.css, src/constants/colors.ts, mixins.ts).
import QtQuick
import Dial.Native
import "LightAssets.js" as LightAssets
import "ThemeRule.js" as ThemeRule

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

    // ---- light / dark: the theme setting, or the machine's color while it is unset (ThemeRule.js, followed
    // from main.qml). What was shown last is kept in the Native storage, so that a start does not change
    // theme when the settings arrive.
    readonly property string storageKey: "theme"
    property string mode: Native.storageGet(storageKey, "dark") === "light" ? "light" : "dark"
    readonly property bool light: mode === "light"

    function setMode(value) {
        if (value === mode) return
        mode = value
        Native.storageSet(storageKey, mode)
    }
    function follow(settings, info) { setMode(ThemeRule.resolve(settings, info, mode)) }

    // The boot splash (psplash, which runs before the Dial and before /meticulous-user is mounted) reads the
    // theme from this file on the root file system: kept equal to the one shown. The launcher names it
    // (DIAL_BOOT_THEME_FILE); off the machine there is none.
    readonly property string bootThemeFile: Native.env("DIAL_BOOT_THEME_FILE", "")
    function _keepBootTheme() {
        if (bootThemeFile && Native.readTextFile(bootThemeFile).trim() !== mode)
            Native.writeTextFile(bootThemeFile, mode + "\n")
    }
    onModeChanged: _keepBootTheme()
    Component.onCompleted: _keepBootTheme()

    // A color with another alpha, and the mix of two (k = 0: a, k = 1: b).
    function alpha(c, a) { return Qt.rgba(c.r, c.g, c.b, a) }
    function mix(a, b, k) { return Qt.rgba(a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k, 1) }

    // The colors are named for what they are used for, and every dark value is the one of the React Dial
    // (src/constants/colors.ts and the components' CSS). The light ones keep text at 4.5:1 or more on the
    // background, large text and dimmed entries at about 3:1, as their dark counterparts do.
    //
    // Yellow is the brand's accent and reads on black, not on paper (1.4:1). As a fill under dark text
    // (the menu bar, buttons) it is the same in both themes: `brandYellow`. As text or as a line it is
    // `accent`, darker on paper.

    // The brand's palette (src/constants/colors.ts), the same in both themes.
    readonly property color brandRed: "#FC1D22"
    readonly property color brandBrown: "#A56751"
    readonly property color brandYellow: "#F5C444"
    readonly property color black: "#000000"
    readonly property color white: "#ffffff"
    readonly property color gray1: "#202020"
    readonly property color gray2: "#272727"
    readonly property color gray4: "#585856"
    readonly property color gray5: "#70706E"
    readonly property color gray6: "#898886"
    readonly property color gray7: "#A1A09E"
    readonly property color gray8: "#B9B9B5"
    readonly property color gray9: "#D2D1CD"
    readonly property color gray10: "#EAE9E5"
    readonly property color dataRed: "#FF5844"
    readonly property color dataWhite: "#FFFFFF"
    readonly property color dataYellowBright: "#F0F000"

    // Surfaces
    readonly property color background: light ? "#F3F0E9" : "#000000"
    readonly property color bubble: light ? "#FBFAF6" : "#0f0f0f"           // the context menu panel
    readonly property color scaleCard: light ? "#FFFFFF" : "#1b1b1b"        // the small scale
    readonly property color frame: light ? "#DDD7C9" : "#e0dcd0"            // around a picture in the image picker
    readonly property color gameBoard: light ? "#FBFAF6" : "#0A0A0A"        // Snake

    // Text
    readonly property color text: light ? "#1C1A17" : "#ffffff"
    readonly property color textHigh: light ? "#24221E" : "#f3f4f6"         // the region lists' titles
    readonly property color textSoft: light ? "#2B2925" : "#e7e7e7"         // values (weight, temperatures)
    readonly property color textField: light ? "#2B2925" : "#E6E6E6"        // time and date fields
    readonly property color textBody: light ? "#34312C" : "#dddddd"         // messages
    readonly property color cream: light ? "#3B362D" : "#e0dcd0"            // titles, bottom status
    readonly property color textMid: light ? "#57534B" : "#b3b3b3"          // hints
    readonly property color label: light ? "#6E695F" : "#808080"            // labels over a value
    readonly property color textGray: light ? "#8E897E" : "#5e5e5e"
    readonly property color unit: light ? "#8E897E" : "#4d4d4d"             // the barometer's units
    readonly property color menuGray: light ? "#8A8579" : "#565656"         // unfocused menu options
    readonly property color textDim: alpha(textSoft, light ? 0.74 : 0.6)    // #e7e7e799: units, small labels
    readonly property color textIdle: alpha(textSoft, light ? 0.66 : 0x90 / 255)   // #e7e7e790: unfocused list entries
    readonly property real faint: light ? 0.55 : 0.4                        // the keyboard's ring and caption
    readonly property string padding: light ? "#331c1a17" : "#33ffffff"     // a number's zero padding, as rich text
    readonly property string affix: light ? "rgba(28,26,23,0.55)" : "rgba(255,255,255,0.4)"   // the keyboard's "@...", as rich text
    readonly property color onInk: light ? "#FBFAF6" : "#171717"            // text on a textSoft fill

    // Lines
    readonly property color pillBorder: light ? "#B9B4A6" : "#5d5d5d"       // the navigation title pill
    readonly property color track: light ? "#CFCABE" : "#676767"            // a gauge's empty ring
    readonly property color spinner: light ? "#DAD5C9" : "#f3f3f3"          // the loading ring
    readonly property color gray3: light ? "#D2CDC1" : "#403F3F"            // the shot graph's dividers
    readonly property color axis: light ? "#8FB6C3" : "#00475B"             // the shot graph's axis

    // "Hold to start": the ring lies against the panel's black edge, so it reads on that as well as on the
    // background (4:1 on both).
    readonly property color holdRing: light ? "#0F8459" : "#ffffff"

    // Accents
    readonly property color accent: light ? "#8F6000" : "#F5C444"           // yellow text
    readonly property color accentLarge: light ? "#B57600" : "#F5C444"      // the same, 24 px and up (3:1 is enough)
    readonly property color accentLine: light ? "#D08F00" : "#F5C444"       // yellow lines: needles, rings
    readonly property color accentSoft: light ? "#8F6000" : "#f7df39"       // a Wi-Fi answer's status
    readonly property color error: light ? "#C62F26" : "#f44336"
    readonly property color errorSoft: light ? "#C4352B" : "#ff7b70"
    readonly property color warning: light ? "#8F6200" : "#ffc107"
    readonly property color increase: light ? "#1E8A2E" : "#32cd32"         // a counter that goes up / down
    readonly property color decrease: light ? "#C4352B" : "#fe6862"
    readonly property color funnel: light ? "#3B362D" : "#feffed"           // the preheat funnel, blinking
    readonly property color snakeHead: light ? "#E0A800" : "#ffff00"

    // Data
    readonly property color dataBlueLight: light ? "#0B7CAB" : "#78D6FF"    // flow
    readonly property color dataGreenLight: light ? "#0F8459" : "#7BEEBF"   // pressure
    readonly property color dataYellow: light ? "#B57600" : "#FDC352"       // weight
    // The manual brew's target, in its control's color (src/constants/manualMode.ts).
    function manualTarget(control) {
        return control === "pressure" ? accentLine : control === "flow" ? dataBlueLight : text
    }

    // Free Pour (free-pour.css)
    readonly property color pourText: light ? "#2B2925" : "#e7e3da"
    readonly property color pourMuted: light ? "#5F6A67" : "#8d9694"
    readonly property color pourRail: light ? "#C3CBC7" : "#34403e"
    readonly property color pourTrack: light ? "#D6DCD8" : "#25312f"
    readonly property color pourGrid: light ? "#D6DCD8" : "#26312f"
    readonly property color pourGridLine: light ? "#A8B2AE" : "#596460"
    readonly property color pourRing: light ? "#87928F" : "#687370"
    readonly property color pourHollow: light ? "#F3F0E9" : "#050908"
    readonly property color pourAmber: light ? "#8A6200" : "#f5dc91"

    // The menus (src/styles/utils/mixins.ts).
    readonly property int viewport: 480
    readonly property int itemHeight: 45
    readonly property int itemMargin: 16
    readonly property int extraMarginAfterBorder: 10
    readonly property int marqueeMinTextLength: 22

    // The pictures drawn for a black background have a light twin under assets/light, made by
    // qt/tools/theme/bake_light_assets.py (which also writes LightAssets.js, the list of them).
    function asset(path) { return Qt.resolvedUrl((light && LightAssets.has(path) ? "../assets/light/" : "../assets/") + path) }
    function publicImage(path) { return Qt.resolvedUrl("../assets/public/" + path) }
}
