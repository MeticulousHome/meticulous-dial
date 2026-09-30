import { useProfileContext } from '../context/ProfileContext';
import { useAppSelector } from '../components/store/hooks';
import { isManualProfile as isManualProfileFn } from '../types';
import { ManualControl } from '../constants/manualMode.ts';

const toManualControl = (active?: string): ManualControl | null =>
  active === 'pressure' || active === 'flow' ? active : null;

/**
 * Detects a manual brew from the streamed machine status.
 *
 * A brew is manual when the loaded profile carries `manual: true`, the machine
 * reports it is extracting, and the active setpoint names one of the two manual
 * controls. Which one it names is the whole state of the shot for the dial: the
 * machine switches between the pressure and the flow stage on its own button
 * triggers, and the streamed setpoint of the active control is the target the
 * dial draws.
 */
export function useManualBrew() {
  const { lastProfile, localProfile } = useProfileContext();
  const stats = useAppSelector((s) => s.stats);

  const activeProfile = lastProfile?.profile ?? localProfile ?? null;
  const isManualProfile = isManualProfileFn(activeProfile);
  const activeControl = toManualControl(stats.setpoints?.active);
  const isManualBrew =
    isManualProfile && stats.extracting === true && activeControl !== null;
  const streamed = activeControl ? stats.setpoints?.[activeControl] : undefined;
  const streamedTarget = typeof streamed === 'number' ? streamed : undefined;

  return {
    activeProfile,
    isManualProfile,
    isManualBrew,
    activeControl,
    streamedTarget
  };
}
