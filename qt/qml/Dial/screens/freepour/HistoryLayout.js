.pragma library

// The physical Dial is a 480 px circle. Keep the complete title rectangle inside
// an inset circle rather than treating the top of the display as a 480 px-wide row.
const DISPLAY_DIAMETER = 480
const HISTORY_TITLE_TOP = 48
const HISTORY_TITLE_LINE_HEIGHT = 22
const HISTORY_TITLE_EDGE_INSET = 8
const HISTORY_TITLE_MAX_PIXEL_SIZE = 22
const HISTORY_TITLE_MIN_PIXEL_SIZE = 14
const HISTORY_METADATA_TOP = 76
const POST_BREW_EXIT_TIMEOUT_MS = 120000

function safeCircleChordWidth(diameter, top, height, edgeInset) {
    const center = diameter / 2
    const radius = Math.max(0, center - Math.max(0, edgeInset))
    const bottom = top + height
    const farthestY = Math.max(Math.abs(top - center), Math.abs(bottom - center))
    if (farthestY >= radius) return 0
    return 2 * Math.sqrt(radius * radius - farthestY * farthestY)
}

const HISTORY_TITLE_WIDTH = safeCircleChordWidth(DISPLAY_DIAMETER, HISTORY_TITLE_TOP,
                                                   HISTORY_TITLE_LINE_HEIGHT, HISTORY_TITLE_EDGE_INSET)
const HISTORY_TITLE_LEFT = (DISPLAY_DIAMETER - HISTORY_TITLE_WIDTH) / 2
