pragma Singleton
// The profiles and the home's selection: the React ProfileContext (src/context/ProfileContext.tsx) with the
// queries it uses (useProfiles, useLastProfile, useDefaultProfiles, useProfileDefaultImages,
// usePourOverProfiles). The effects of the React provider are the _on* functions below, run in the same
// order on the same changes.
import QtQuick
import Dial.Native

QtObject {
    id: ctx

    // ---- queries
    property var profiles: []                 // useProfiles().data: Profile[] (full)
    property bool profilesLoaded: false       // !isPending
    property var lastProfile: null            // LastProfileIdent: { profile, load_time } | null
    property var defaultProfiles: null        // DefaultProfiles: { default: [Profile], community: [...] }
    property var defaultImages: []            // string[]
    property var pourOverProfiles: []         // PourOverProfile[] (installed)
    property bool pourOverLoaded: false       // usePourOverProfiles().isSuccess / !isPending

    // ---- local state (ProfileContextType)
    property var mergedProfiles: []           // ExtendedProfile[] (isLast, temporary)
    property int localProfileIndex: 0
    property var localProfile: null
    property bool localHoverState: false
    property bool homeCardSelected: false
    property var detailProfileSelected: null
    property bool isCreatingProfile: false
    property int settingsIndex: 0
    property var settingsProfile: null        // ExtendedProfile & { settings: IPresetSetting[] }
    property bool profileStarting: false
    property string homeMode: "espresso"      // espresso | pour_over_profile | free_pour | new
    property var selectedPourOverProfileId: null
    readonly property bool limitedAccess: BackendSettings.limitedAccess

    property var _profileIdToFind: null
    property bool _hasJustHandledProfileEvent: false
    property string _mergedJson: "[]"

    // The template of a new profile (useSimpleProfile): the backend-owned "simple" default.
    readonly property var simpleProfile: defaultProfiles && defaultProfiles["default"] && defaultProfiles["default"].length
                                         ? defaultProfiles["default"][0] : null

    Component.onCompleted: {
        refetch()
        refetchLast()
        refetchDefaults()
        refetchDefaultImages()
        refetchPourOver()
    }

    // ---- fetching (react-query: retry 3 with backoff, keep the previous data on errors)
    function _retry(fn, attempt) {
        attempt = attempt || 0
        return fn().catch(error => {
            if (attempt >= 3) throw error
            return new Promise(resolve => {
                const t = Qt.createQmlObject("import QtQml; Timer { repeat: false }", ctx)
                t.interval = Math.min(1000 * Math.pow(2, attempt), 30000)
                t.triggered.connect(() => { t.destroy(); resolve() })
                t.start()
            }).then(() => _retry(fn, attempt + 1))
        })
    }

    property bool _fetchingProfiles: false
    property bool _refetchQueued: false
    function refetch() {
        if (_fetchingProfiles) { _refetchQueued = true; return }
        _fetchingProfiles = true
        _retry(() => Api.fetchAllProfiles()).then(list => {
            if (list && list.error) throw new Error(list.error)
            profiles = list || []
            profilesLoaded = true
            _recomputeMerged()
        }).catch(error => {
            console.error("Error fetching profiles:", error && error.message ? error.message : error)
            _profilesRetry.start()
        }).then(() => {
            _fetchingProfiles = false
            if (_refetchQueued) { _refetchQueued = false; refetch() }
        })
    }
    property Timer _profilesRetry: Timer { interval: 5000; repeat: false; onTriggered: ctx.refetch() }

    function refetchLast() {
        _retry(() => Api.getLastProfile()).then(last => {
            if (last && last.error) throw new Error(last.error)
            lastProfile = last || null
            _recomputeMerged()
        }).catch(error => console.error("Error fetching last profile:", error && error.message ? error.message : error))
    }
    function refetchDefaults() {
        return _retry(() => Api.getDefaultProfiles()).then(data => {
            if (data && data.error) throw new Error(data.error)
            defaultProfiles = data
            return data
        }).catch(error => console.error("GetDefaultProfiles error:", error && error.message ? error.message : error))
    }
    function refetchDefaultImages() {
        _retry(() => Api.getProfileDefaultImages()).then(data => {
            if (data && data.error) throw new Error(data.error)
            defaultImages = data || []
        }).catch(error => console.error("getDefaultProfileImages error:", error && error.message ? error.message : error))
    }

    // Installed Pour Over profiles (features/freePour/profileApi.ts). parsePourOverProfile, when the Free Pour
    // feature provides one, validates each entry; the rest are dropped as the React code does.
    property var parsePourOverProfile: null
    function refetchPourOver() {
        _retry(() => Api.get("/api/v1/pour-over/profile/list", { timeout: 5000 })).then(body => {
            if (!body || !Array.isArray(body.profiles)) throw new Error("Machine returned an invalid Pour Over profile list")
            const parsed = body.profiles.map(p => {
                if (!parsePourOverProfile) return p
                const result = parsePourOverProfile(p)
                if (result && result.success) return result.dialProfile
                console.error("Rejected installed Pour Over profile " + ((p && p.id) || "<unknown>"))
                return null
            }).filter(p => p !== null)
            if (JSON.stringify(parsed) !== JSON.stringify(pourOverProfiles)) pourOverProfiles = parsed
            pourOverLoaded = true
            _reconcilePourOver()
        }).catch(error => {
            pourOverLoaded = true
            console.error("Pour Over profiles:", error && error.message ? error.message : error)
        })
    }
    function deletePourOverProfile(profileId) {
        const previous = pourOverProfiles
        pourOverProfiles = pourOverProfiles.filter(p => p.id !== profileId)
        return Api.del("/api/v1/pour-over/profile/delete/" + encodeURIComponent(profileId), { timeout: 5000 })
            .catch(error => {
                pourOverProfiles = previous
                console.error("Error deleting Pour Over profile:", error && error.message ? error.message : error)
                throw error
            }).then(() => refetchPourOver(), () => { refetchPourOver(); throw new Error("delete failed") })
    }
    function pourOverImageUrl(profileId) {
        return Api.base + "/api/v1/pour-over/profile/image/" + encodeURIComponent(profileId)
    }

    // ---- profile mutations (useSavePreset / useDeletePreset)
    function saveProfile(profile) {
        return Api.saveProfile(profile).then(data => { console.log("Profile added successfully."); return data })
            .catch(error => { console.error("Error adding profile:", error && error.message ? error.message : error); throw error })
    }
    function deleteProfile(id) {
        return Api.deleteProfile(id).then(data => { console.log("Profile deleted successfully."); return data })
            .catch(error => { console.error("Error deleting profile:", error && error.message ? error.message : error) })
    }

    // ---- mergedProfiles (useMemo): the list with the last loaded profile marked isLast
    function _recomputeMerged() {
        let merged
        if (!profiles) merged = []
        else {
            const last = lastProfile ? lastProfile.profile : null
            if (!last) merged = profiles
            else {
                const existingIndex = profiles.findIndex(p => p.id === last.id)
                merged = profiles.map(p => Object.assign({}, p, { isLast: false, temporary: false }))
                if (existingIndex !== -1) merged[existingIndex] = Object.assign({}, merged[existingIndex], { isLast: true })
            }
        }
        // React keeps the same array when the data did not change (structural sharing): no effects then.
        const json = JSON.stringify(merged)
        if (json === _mergedJson) return
        _mergedJson = json
        mergedProfiles = merged
        _onMergedProfilesChanged()
        _onIndexOrProfilesChanged()
    }

    // "If the last profile changes scroll to the last profile"
    function _onMergedProfilesChanged() {
        if (_hasJustHandledProfileEvent) {
            _hasJustHandledProfileEvent = false
            return
        }
        if (!mergedProfiles || mergedProfiles.length === 0) return
        const profileIndex = mergedProfiles.findIndex(p => p.isLast)
        if (profileIndex !== -1) {
            localProfileIndex = profileIndex
            localProfile = mergedProfiles[profileIndex]
        } else {
            localProfileIndex = 0
            localProfile = mergedProfiles[0]
        }
        localHoverState = true
    }

    // "If the profile index changes, update the local profile"
    function _onIndexOrProfilesChanged() {
        if (!mergedProfiles) return
        if (_profileIdToFind) {
            const profileIndex = mergedProfiles.findIndex(p => p.id === _profileIdToFind)
            if (profileIndex !== -1) {
                _profileIdToFind = null
                localProfileIndex = profileIndex
                localProfile = mergedProfiles[profileIndex]
                return
            }
        }
        if (localProfileIndex > mergedProfiles.length) {
            localProfileIndex = mergedProfiles.length
            localProfile = null
        } else if (localProfileIndex < mergedProfiles.length) {
            localProfile = mergedProfiles[localProfileIndex]
        }
    }
    onLocalProfileIndexChanged: _onIndexOrProfilesChanged()

    function setLocalProfileIndex(index) { localProfileIndex = index }

    // The backend's "profile" event (ProfileUpdate: { change: update | delete | create | load, profile_id }).
    function onProfileEvent(event) {
        refetch()
        _hasJustHandledProfileEvent = event.change !== "load"
        if (!mergedProfiles || mergedProfiles.length === 0) {
            console.error("No profiles available")
            return
        }
        const profileId = event.profile_id || ""
        const index = mergedProfiles.findIndex(p => p.id === profileId)
        switch (event.change) {
        case "update":
        case "create":
            if (index !== -1) localProfileIndex = index
            else _profileIdToFind = profileId
            break
        case "delete":
            if (index !== -1 && index < localProfileIndex) localProfileIndex = Math.max(localProfileIndex - 1, 0)
            break
        }
    }

    // The backend's "profileHover" event from the app ({ type: focus | scroll, id, from }).
    function onProfileHover(type, profileId) {
        localHoverState = type === "focus"
        homeMode = "espresso"
        selectedPourOverProfileId = null
        _profileIdToFind = profileId
        _onIndexOrProfilesChanged()
    }

    // reconcilePourOverCatalogSelection (homeSelection.ts), run by the home on catalog changes.
    function _reconcilePourOver() {
        if (homeMode !== "pour_over_profile" || !pourOverLoaded) return
        const ids = pourOverProfiles.map(p => p.id)
        if (selectedPourOverProfileId && ids.indexOf(selectedPourOverProfileId) >= 0) return
        if (ids.length > 0) {
            selectedPourOverProfileId = ids[0]
            return
        }
        homeMode = "free_pour"
        selectedPourOverProfileId = null
    }
    onHomeModeChanged: _reconcilePourOver()
    onSelectedPourOverProfileIdChanged: _reconcilePourOver()

    // ---- the home carousel's layout (homeSelection.ts)
    readonly property int profileCount: mergedProfiles.length
    readonly property int pourOverProfileCount: pourOverProfiles.length
    readonly property int freePourOptionIndex: profileCount + pourOverProfileCount
    readonly property int newOptionIndex: freePourOptionIndex + 1
    readonly property int selectedPourOverProfileIndex: Math.max(pourOverProfiles.findIndex(p => p.id === selectedPourOverProfileId), 0)
    readonly property int activeOption: activeHomeOption(homeMode, localProfileIndex, selectedPourOverProfileIndex)

    function pourOverProfileOptionIndex(pourOverProfileIndex) {
        if (pourOverProfileCount <= 0) return profileCount
        return profileCount + Math.min(Math.max(pourOverProfileIndex, 0), pourOverProfileCount - 1)
    }
    function activeHomeOption(mode, profileIndex, pourOverProfileIndex) {
        if (mode === "pour_over_profile" && pourOverProfileCount > 0) return pourOverProfileOptionIndex(pourOverProfileIndex || 0)
        if (mode === "free_pour") return freePourOptionIndex
        if (mode === "new") return newOptionIndex
        if (profileCount === 0) {
            if (pourOverProfileCount > 0) return pourOverProfileOptionIndex(0)
            return freePourOptionIndex
        }
        return Math.min(Math.max(profileIndex || 0, 0), profileCount - 1)
    }
    // getHomeSelection(option) -> { mode, profileIndex, pourOverProfileIndex }
    function homeSelection(option) {
        const bounded = Math.min(Math.max(option, 0), newOptionIndex)
        if (bounded < profileCount) return { mode: "espresso", profileIndex: bounded, pourOverProfileIndex: null }
        const pourOverIndex = bounded - profileCount
        if (pourOverIndex >= 0 && pourOverIndex < pourOverProfileCount)
            return { mode: "pour_over_profile", profileIndex: null, pourOverProfileIndex: pourOverIndex }
        if (bounded === freePourOptionIndex) return { mode: "free_pour", profileIndex: null, pourOverProfileIndex: null }
        if (bounded === newOptionIndex) return { mode: "new", profileIndex: null, pourOverProfileIndex: null }
        return { mode: "free_pour", profileIndex: null, pourOverProfileIndex: null }
    }
    // createDialProfileHover: the event the Dial sends when an espresso card is focused or scrolled to.
    function dialProfileHover(option, type) {
        const selection = homeSelection(option)
        if (selection.mode !== "espresso" || selection.profileIndex === null) return null
        const p = mergedProfiles[selection.profileIndex]
        return p && p.id ? { id: p.id, from: "dial", type: type } : null
    }

    // ---- profile editing helpers (src/utils/profiles.ts)
    readonly property string newProfileName: "Simple"
    function uuid() {
        // RFC 4122 version 4
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0
            return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16)
        })
    }
    function newProfileFromTemplate(template) {
        const display = Object.assign({}, template.display || {})
        display.image = (template.display && template.display.image) || ""
        return Object.assign({}, template, {
            id: uuid(), name: newProfileName, previous_authors: [],
            variables: template.variables || [], display: display
        })
    }
    function addVariablesToSettings(variables, nextId) {
        if (!variables || !variables.length) return []
        return variables.map((variable, index) => ({
            id: index + nextId, type: "numerical", isInternal: false, externalType: variable.type,
            key: variable.key, label: variable.name, value: variable.value
        }))
    }
    function addSettingsToProfile(profile) {
        const image = ((profile.display && profile.display.image) || "").replace("/api/v1/profile/image/", "")
        const settings = [
            { id: 1, type: "text", key: "name", label: "name", value: profile.name, isInternal: true },
            { id: 2, type: "numerical", key: "temperature", label: "temperature", value: profile.temperature || 85, unit: "°c", isInternal: true },
            { id: 3, type: "numerical", key: "output", label: "output", value: profile.final_weight || 36, unit: "g", isInternal: true },
            { id: 4, type: "image", key: "image", label: "Select image", value: image, isInternal: true }
        ].concat(addVariablesToSettings(profile.variables, 5))
        return Object.assign({}, profile, { settings: settings })
    }
    function applySettingsToProfile(profile, settings) {
        const find = key => settings.find(s => s.key === key && s.isInternal)
        const out = Object.assign({}, profile)
        delete out.settings
        out.name = find("name").value
        out.display = Object.assign({}, profile.display || {}, { image: find("image").value })
        out.temperature = find("temperature").value
        out.final_weight = find("output").value
        out.variables = settings.filter(s => !s.isInternal).map(p => ({ name: p.label, key: p.key, type: p.externalType, value: p.value }))
        return out
    }
}
