import { AxiosResponse } from 'axios';

import { IPreset } from '.';

export interface ProfileImplementation {
  get: (id: number) => Promise<AxiosResponse>;
  save: (body: IPreset) => Promise<AxiosResponse>;
  loadDataProfile: (data: any) => Promise<AxiosResponse>;
  loadProfile: (profile_id: number) => Promise<AxiosResponse>;
  getAll: () => Promise<AxiosResponse>;
}
