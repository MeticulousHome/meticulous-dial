.pragma library
// Which theme the Dial shows: the `theme` setting ("dark" or "light"), and while it is unset (null) the
// machine's color: light on a white machine, dark on any other.
// Tested by qt/tests/js/themeRule.test.mts.

// settings and info are the backend's answers, null before the first one; shown is the theme on screen,
// which stays until they tell. A backend that does not have the setting yet (the previous version) sends no
// `theme`: the choice is then this Dial's alone.
function resolve(settings, info, shown) {
    if (!settings || settings.theme === undefined) return shown
    if (settings.theme === "dark" || settings.theme === "light") return settings.theme
    if (!info) return shown
    return String(info.color).trim().toLowerCase() === "white" ? "light" : "dark"
}
