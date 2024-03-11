import { AxiosResponse } from 'axios';

import { GlobalSettings, IPreset } from '.';

export interface ProfileImplementation {
  get: (id: number | string) => Promise<AxiosResponse>;
  save: (body: IPreset) => Promise<AxiosResponse>;
  delete(id: number | string): Promise<AxiosResponse>;
  loadDataProfile: (data: any) => Promise<AxiosResponse>;
  loadProfile: (profile_id: number) => Promise<AxiosResponse>;
  getAll: () => Promise<AxiosResponse>;
}

export interface SettingsImplementation {
  get(): Promise<AxiosResponse>;
  update(body: Partial<GlobalSettings>): Promise<AxiosResponse>;
}
