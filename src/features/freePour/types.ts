export const FREE_POUR_SCHEMA_VERSION = 1 as const;

export type FreePourCompletion = 'brewer_removed' | 'dial_fallback';

export interface FreePourSample {
  /** Milliseconds from the start of the first pour. */
  t: number;
  /** Water weight shown during the brew. */
  w: number;
  /** Gravimetric flow in grams per second. */
  f: number;
  /** One-based pour number, or zero while waiting/drawing down. */
  p: number;
}

export interface FreePourPour {
  number: number;
  startTimeMs: number;
  endTimeMs: number;
  startWeightG: number;
  endWeightG: number;
  waterG: number;
  averageFlowGps: number;
  peakFlowGps: number;
}

export interface PourOverPourTarget {
  number: number;
  startTimeMs: number;
  stopWeightG: number;
  flowGps?: number;
  flowRangeGps?: [number, number];
}

/**
 * A first-class brew record. Uploading is intentionally represented as data,
 * not performed here, so community sync can consume the record independently.
 */
export interface FreePourSession {
  schemaVersion: typeof FREE_POUR_SCHEMA_VERSION;
  id: string;
  brewType: 'pour_over';
  mode: 'free_pour';
  name: 'Free Pour';
  source: 'dial';
  startedAt: string;
  completedAt: string;
  recipe: {
    /** Null for Free Pour; populated by future downloaded profiles. */
    profileId: string | null;
    profileName: string;
    doseG: number;
    targetWaterG: number | null;
    pourTargets: PourOverPourTarget[];
  };
  measurements: {
    emptyServerG: number;
    setupG: number;
    waterPouredG: number;
    beverageG: number | null;
    retainedG: number | null;
    durationMs: number;
    status: 'measured' | 'skipped';
  };
  pours: FreePourPour[];
  samples: FreePourSample[];
  completion: FreePourCompletion;
  sync: {
    status: 'pending' | 'uploaded' | 'failed';
    attempts: number;
    uploadedAt?: string;
  };
}
