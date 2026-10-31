// "Disturbance resilience": the backend setting `disturbance_resilience`
// (default off), saved on the machine's ESP32. Listed in the config menu and
// changed on its own full screen with a Disabled and an Enabled pill.

export const DISTURBANCE_RESILIENCE_LABEL = 'disturbance resilience';
export const DISTURBANCE_RESILIENCE_TITLE = 'Disturbance resilience';

type DisturbanceResilienceSettings = {
  disturbance_resilience?: boolean | null;
} | null;

export type DisturbanceResilienceOption = {
  key: 'disabled' | 'enabled';
  label: string;
  /** The value saved when this pill is pushed. */
  value: boolean;
  /** Shown under the title while this pill has the focus. */
  copy: string;
};

export const DISTURBANCE_RESILIENCE_OPTIONS: DisturbanceResilienceOption[] = [
  {
    key: 'disabled',
    label: 'Disabled',
    value: false,
    copy:
      'The machine will prioritize the weight target over scale ' +
      'disturbances on high flow profiles.'
  },
  {
    key: 'enabled',
    label: 'Enabled',
    value: true,
    copy:
      'The machine will prioritize ignoring scale disturbances over the ' +
      'weight target on high flow profiles.'
  }
];

export const isDisturbanceResilienceOn = (
  settings?: DisturbanceResilienceSettings
): boolean => settings?.disturbance_resilience === true;

/** Hidden only when the machine says its firmware cannot store it. */
export const showDisturbanceResilience = (
  machine?: { disturbance_resilience_supported?: boolean } | null
): boolean => machine?.disturbance_resilience_supported !== false;

/**
 * Config menu label. Without settings (not loaded yet) it has no value, like
 * the other items in that menu.
 */
export function disturbanceResilienceLabel(
  settings?: DisturbanceResilienceSettings
): string {
  if (!settings) return DISTURBANCE_RESILIENCE_LABEL;
  const value = isDisturbanceResilienceOn(settings) ? 'ENABLED' : 'DISABLED';
  return `${DISTURBANCE_RESILIENCE_LABEL}: ${value}`;
}

/** The pill focused when the screen opens: the stored value, else Disabled. */
export const initialDisturbanceResilienceIndex = (
  settings?: DisturbanceResilienceSettings
): number =>
  DISTURBANCE_RESILIENCE_OPTIONS.findIndex(
    (option) => option.value === isDisturbanceResilienceOn(settings)
  );

/** The copy follows the focused pill, not the stored value. */
export const disturbanceResilienceCopy = (focusedIndex: number): string =>
  DISTURBANCE_RESILIENCE_OPTIONS[
    Math.min(
      Math.max(focusedIndex, 0),
      DISTURBANCE_RESILIENCE_OPTIONS.length - 1
    )
  ].copy;
