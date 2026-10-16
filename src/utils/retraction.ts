export const PISTON_RADIUS_MM = 26.5;
export const RETRACTION_MIN_VOLUME_ML = 80;
export const RETRACTION_DEFAULT_VOLUME_ML = 100;
export const RETRACTION_MAX_VOLUME_ML = 150;
export const RETRACTION_VOLUME_STEP_ML = 1;

const PISTON_AREA_MM2 = Math.PI * PISTON_RADIUS_MM * PISTON_RADIUS_MM;

export const retractionMmToVolumeMl = (distanceMm: number): number =>
  Math.round((PISTON_AREA_MM2 * distanceMm) / 1000);

export const volumeMlToRetractionMm = (volumeMl: number): number =>
  Math.round((volumeMl * 1000 * 100) / PISTON_AREA_MM2) / 100;
