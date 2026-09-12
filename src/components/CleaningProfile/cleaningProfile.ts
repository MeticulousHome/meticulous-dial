import { Profile } from '@meticulous-home/espresso-profile';
import groupFlushProfile from '../../assets/group-flush.json';
import { CleaningProfile } from '../../types/MachineProfile';

export const CLEANING_PROFILE_ID = 'fc14d89e-2b10-47b5-9ea0-a2735c7ee777';
export const CLEANING_TEMPERATURE = 65;

/**
 * This fail-closed maintenance profile is bundled into the Dial rather than
 * saved to the user's profile store. Firmware that predates cleaning-profile
 * support rejects it because it intentionally has no espresso stages or final
 * weight.
 */
export const CLEANING_PROFILE = groupFlushProfile as CleaningProfile;

export const isCleaningProfile = (
  profile: Pick<Profile, 'id'> | Pick<CleaningProfile, 'id'> | null | undefined
) => profile?.id === CLEANING_PROFILE_ID;
