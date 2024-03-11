import { AxiosResponse } from 'axios';

import { GlobalSettings } from '.';

export interface SettingsImplementation {
  get(): Promise<AxiosResponse>;
  update(body: Partial<GlobalSettings>): Promise<AxiosResponse>;
}
