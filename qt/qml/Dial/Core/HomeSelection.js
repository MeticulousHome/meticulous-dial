.pragma library
// The home carousel's order and selection: src/components/ProfileHomeScreen/homeSelection.ts, function for
// function (same names, same arguments), so the React unit test runs against it (qt/tests/js).
// Order: espresso profiles, installed pour-over profiles, Free Pour, new.
//   mode: espresso | pour_over_profile | free_pour | new
//   layout: { profileCount, pourOverProfileCount }

function removePourOverProfileFromCatalog(profiles, deletedProfileId) {
    return profiles.filter(profile => profile.id !== deletedProfileId)
}

function reconcilePourOverCatalogSelection(o) {
    const mode = o.mode, selectedProfileId = o.selectedProfileId
    if (mode !== "pour_over_profile" || !o.catalogResolved) return { mode: mode, selectedProfileId: selectedProfileId }
    if (selectedProfileId && o.installedProfileIds.indexOf(selectedProfileId) >= 0)
        return { mode: mode, selectedProfileId: selectedProfileId }
    if (o.installedProfileIds.length > 0)
        return { mode: "pour_over_profile", selectedProfileId: o.installedProfileIds[0] }
    return { mode: "free_pour", selectedProfileId: null }
}

function getPourOverProfileOptionIndex(pourOverProfileIndex, layout) {
    if (layout.pourOverProfileCount <= 0) return layout.profileCount
    return layout.profileCount + Math.min(Math.max(pourOverProfileIndex, 0), layout.pourOverProfileCount - 1)
}

function getFreePourOptionIndex(layout) {
    return layout.profileCount + layout.pourOverProfileCount
}

function getNewOptionIndex(layout) {
    return getFreePourOptionIndex(layout) + 1
}

// { mode, profileIndex, pourOverProfileIndex, profileCount, pourOverProfileCount }
function getActiveHomeOption(o) {
    const layout = { profileCount: o.profileCount, pourOverProfileCount: o.pourOverProfileCount }
    if (o.mode === "pour_over_profile" && o.pourOverProfileCount > 0)
        return getPourOverProfileOptionIndex(o.pourOverProfileIndex === null || o.pourOverProfileIndex === undefined ? 0 : o.pourOverProfileIndex, layout)
    if (o.mode === "free_pour") return getFreePourOptionIndex(layout)
    if (o.mode === "new") return getNewOptionIndex(layout)
    if (o.profileCount === 0) {
        if (o.pourOverProfileCount > 0) return getPourOverProfileOptionIndex(0, layout)
        return getFreePourOptionIndex(layout)
    }
    const index = o.profileIndex === null || o.profileIndex === undefined ? 0 : o.profileIndex
    return Math.min(Math.max(index, 0), o.profileCount - 1)
}

function getHomeSelection(option, layout) {
    const newOptionIndex = getNewOptionIndex(layout)
    const freePourOptionIndex = getFreePourOptionIndex(layout)
    const bounded = Math.min(Math.max(option, 0), newOptionIndex)
    if (bounded < layout.profileCount) return { mode: "espresso", profileIndex: bounded, pourOverProfileIndex: null }
    const pourOverProfileIndex = bounded - layout.profileCount
    if (pourOverProfileIndex >= 0 && pourOverProfileIndex < layout.pourOverProfileCount)
        return { mode: "pour_over_profile", profileIndex: null, pourOverProfileIndex: pourOverProfileIndex }
    if (bounded === freePourOptionIndex) return { mode: "free_pour", profileIndex: null, pourOverProfileIndex: null }
    if (bounded === newOptionIndex) return { mode: "new", profileIndex: null, pourOverProfileIndex: null }
    return { mode: "free_pour", profileIndex: null, pourOverProfileIndex: null }
}

function createDialProfileHover(option, profiles, pourOverProfileCount, type) {
    const selection = getHomeSelection(option, { profileCount: profiles.length, pourOverProfileCount: pourOverProfileCount })
    if (selection.mode !== "espresso" || selection.profileIndex === null) return null
    const profile = profiles[selection.profileIndex]
    const id = profile ? profile.id : undefined
    return id ? { id: id, from: "dial", type: type } : null
}
