import { Profile } from '@meticulous-home/espresso-profile';

export interface CleaningProfile {
  profile_type: 'cleaning';
  name: string;
  id: string;
  author: string;
  author_id: string;
  previous_authors?: [];
  display?: Profile['display'];
  temperature: number;
  workflow: ['heat', 'wait_for_dial', 'raise', 'purge'];
}

export type MachineProfile = Profile | CleaningProfile;
