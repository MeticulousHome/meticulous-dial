.pragma library
// src/features/freePour/profileEvents.ts: a backend "profile" event about a pour-over profile (Backend.qml
// makes the same test before refetching Profiles.pourOverProfiles).

function isPourOverProfileEvent(event) {
    return !!(event && typeof event === "object" && "brew_type" in event && event.brew_type === "pour_over")
}
