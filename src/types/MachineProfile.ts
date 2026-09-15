import { Profile } from '@meticulous-home/espresso-profile';

export interface MachineProfileNode {
  id: number;
  controllers: Record<string, unknown>[];
  triggers: Record<string, unknown>[];
}

export interface MachineProfileStage {
  name: string;
  nodes: MachineProfileNode[];
}

export interface CleaningProfile {
  profile_type: 'cleaning';
  name: string;
  id: string;
  author: string;
  author_id: string;
  previous_authors?: string[];
  display?: Profile['display'];
  temperature: number;
  source: 'Meticulous';
  stages: MachineProfileStage[];
}

export type MachineProfile = Profile | CleaningProfile;
