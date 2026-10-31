import { PROFILE_ID } from './shot';

export const profile = { id: PROFILE_ID, name: 'Shot graph fixture' };

export const useProfileContext = () => ({ localProfile: profile });
