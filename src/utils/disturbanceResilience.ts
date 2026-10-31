// "Disturbance resilience" in advanced settings: the backend setting
// `disturbance_resilience` (default off), saved on the machine's ESP32. The
// Dial shows a value only once the backend has confirmed it.

export const DISTURBANCE_RESILIENCE_LABEL = 'Disturbance resilience';

export type DisturbanceResilienceState = {
  /** The setting as the backend last reported it; absent means off. */
  settings?: { disturbance_resilience?: boolean } | null;
  /** A save is in flight. */
  saving?: boolean;
  /** The last save was refused or failed. */
  failed?: boolean;
};

export const isDisturbanceResilienceOn = (
  settings?: { disturbance_resilience?: boolean } | null
): boolean => settings?.disturbance_resilience === true;

/** Hidden only when the machine says its firmware cannot store it. */
export const showDisturbanceResilience = (
  machine?: { disturbance_resilience_supported?: boolean } | null
): boolean => machine?.disturbance_resilience_supported !== false;

export function disturbanceResilienceLabel({
  settings,
  saving,
  failed
}: DisturbanceResilienceState): string {
  const value = isDisturbanceResilienceOn(settings) ? 'ENABLED' : 'DISABLED';
  const suffix = saving ? ' (saving)' : failed ? ' (not saved)' : '';
  return `${DISTURBANCE_RESILIENCE_LABEL}: ${value}${suffix}`;
}
