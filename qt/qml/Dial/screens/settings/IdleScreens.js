.pragma library
// IdleScreens of src/components/Settings/Advanced/IdleScreenSetting.tsx: the idle_screen setting's values,
// their menu labels and the short label Advanced Settings shows.

const IDLE_SCREENS = [
    { key: "default", label: "Analog Clock", shortLabel: "Analog" },
    { key: "digital", label: "Digital Clock", shortLabel: "Digital" },
    { key: "metCat", label: "Digital Cat Clock", shortLabel: "Cat" },
    { key: "dvd", label: "DVD Style", shortLabel: "DVD" }
]

// IdleScreens.find(...)?.shortLabel: undefined when the setting holds something else.
function shortLabel(key) {
    const item = IDLE_SCREENS.find(i => i.key === key)
    return item ? item.shortLabel : undefined
}
