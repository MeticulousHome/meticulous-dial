import { useProfileContext } from '../context/ProfileContext';
import { useAppSelector } from '../components/store/hooks';
import { isManualProfile as isManualProfileFn } from '../types';

/**
 * Detects a manual brew from the streamed machine status.
 *
 * A brew is manual when the loaded profile carries `manual: true`, the machine
 * reports it is extracting, and the active setpoint is the pressure one. The
 * streamed pressure setpoint is the target the dial draws.
 */
export function useManualBrew() {
  const { lastProfile, localProfile } = useProfileContext();
  const stats = useAppSelector((s) => s.stats);

  const activeProfile = lastProfile?.profile ?? localProfile ?? null;
  const isManualProfile = isManualProfileFn(activeProfile);
  const isManualBrew =
    isManualProfile &&
    stats.extracting === true &&
    stats.setpoints?.active === 'pressure';
  const streamedTarget =
    typeof stats.setpoints?.pressure === 'number'
      ? stats.setpoints.pressure
      : undefined;

  return { activeProfile, isManualProfile, isManualBrew, streamedTarget };
}
