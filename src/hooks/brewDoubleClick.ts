import { MACHINE_OWNED_STAGES } from '../constants/setting.ts';

/**
 * What a double click should ask the machine to do.
 *
 * `finish` ends the user stages through the normal retract, as if the last
 * stage had exited on its own.
 *
 * `abort` is the backend's `end_profile()`. The backend used to run it itself
 * on every double click; the dial now reproduces it for every profile.
 *
 * `null` means the double click is not ours to act on.
 */
export type DoubleClickDecision = 'abort' | 'finish' | null;

/**
 * True while the machine is running a user-defined stage of the loaded
 * profile.
 *
 * The name check is what makes this correct: `extracting` stays true through
 * the final retract, so `extracting` alone would misread the machine-owned
 * tail of a shot as a user stage.
 */
export function isUserStage(
  s: { name: string; extracting: boolean },
  machineOwnedStages: readonly string[] = MACHINE_OWNED_STAGES
): boolean {
  return s.extracting && !machineOwnedStages.includes(s.name);
}

/**
 * Decide what a double click sends for the given machine status.
 *
 * Idle is left alone. Inside a user stage the shot is finished through the
 * normal retract; on every other non-idle stage the profile is aborted, which
 * is what the backend used to do itself on every double click.
 */
export function decideDoubleClick(
  s: { name: string; extracting: boolean },
  machineOwnedStages?: readonly string[]
): DoubleClickDecision {
  if (s.name === 'idle') return null;
  if (isUserStage(s, machineOwnedStages)) return 'finish';
  return 'abort';
}
