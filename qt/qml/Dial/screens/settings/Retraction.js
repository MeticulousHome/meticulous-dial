.pragma library
// src/utils/retraction.ts: the partial retraction is stored in mm of piston travel and shown as the volume
// it draws back (piston radius 26.5 mm).

const PISTON_RADIUS_MM = 26.5
const RETRACTION_MIN_VOLUME_ML = 80
const RETRACTION_DEFAULT_VOLUME_ML = 100
const RETRACTION_MAX_VOLUME_ML = 150
const RETRACTION_VOLUME_STEP_ML = 1

const PISTON_AREA_MM2 = Math.PI * PISTON_RADIUS_MM * PISTON_RADIUS_MM

function retractionMmToVolumeMl(distanceMm) {
    return Math.round((PISTON_AREA_MM2 * distanceMm) / 1000)
}

function volumeMlToRetractionMm(volumeMl) {
    return Math.round((volumeMl * 1000 * 100) / PISTON_AREA_MM2) / 100
}
