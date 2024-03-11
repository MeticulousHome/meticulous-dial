import { AxiosResponse } from 'axios';

import { Api } from '.';
import { type SettingsImplementation } from '../types/api';

const SETTINGS_BASE_URL = '/settings';

class Settings extends Api implements SettingsImplementation {
  async get(): Promise<AxiosResponse> {
    try {
      return this._axios.get(SETTINGS_BASE_URL);
    } catch (error) {
      console.log(error);
    }
  }

  async update(body: any): Promise<AxiosResponse> {
    try {
      return this._axios.post(SETTINGS_BASE_URL, body);
    } catch (error) {
      console.log(error);
    }
  }
}

export default new Settings();
