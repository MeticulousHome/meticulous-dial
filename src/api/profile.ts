import { AxiosResponse } from 'axios';

import { Api } from '.';
import { ProfileImplementation } from '../types/api';
import { IPreset } from '../types';

class Profile extends Api implements ProfileImplementation {
  private PROFILE_BASE_URL = '/profile';

  async save(body: IPreset): Promise<AxiosResponse> {
    return this._axios.post(this.PROFILE_BASE_URL + '/save', body);
  }

  async getAll(): Promise<AxiosResponse> {
    return this._axios.get(this.PROFILE_BASE_URL + '/list');
  }

  async loadDataProfile(body: any): Promise<AxiosResponse> {
    return this._axios.post(this.PROFILE_BASE_URL + '/load', body);
  }

  async loadProfile(profile_id: string | number): Promise<AxiosResponse> {
    return this._axios.get(this.PROFILE_BASE_URL + `/load/${profile_id}`);
  }

  async get(id: number): Promise<AxiosResponse> {
    return this._axios.get(this.PROFILE_BASE_URL + `/get/${id}`);
  }
}

export default new Profile();
