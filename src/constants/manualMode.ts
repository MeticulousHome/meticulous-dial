import { colorDataBlueLight } from './colors.ts';

/**
 * The backend seeds and owns the single "Manual mode" profile; the dial mirrors
 * only its id, to fetch and save that one document from the setup flow. A brew
 * is recognised as manual by `profile.manual === true` and never by this id.
 */
export const MANUAL_MODE_PROFILE_ID = '4d616e75-616c-4d6f-8465-000000000001';

/**
 * A `final_weight` at or above this is the convention for "no weight stop": the
 * machine can never reach it, so the shot ends on the long press instead.
 */
export const MANUAL_WEIGHT_DISABLED = 3000;

/** The quantity the machine is driving during a manual stage. */
export type ManualControl = 'pressure' | 'flow';

/**
 * The target tick and its trail take the colour of the control that is running,
 * so the ring reads as a flow ring in the flow stage: the plot's flow blue
 * there, the pressure yellow in the pressure stage and in every other brew.
 */
export const MANUAL_TARGET_COLORS: Record<ManualControl, string> = {
  pressure: '#F5C444',
  flow: colorDataBlueLight
};
