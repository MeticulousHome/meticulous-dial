import { AxiosResponse } from 'axios';

import { Api } from '.';
import { ProfileImplementation } from '../types/api';
import { IPreset } from '../types';

const PROFILE_BASE_URL = '/profile';
class Profile extends Api implements ProfileImplementation {
  async save(body: IPreset): Promise<AxiosResponse> {
    try {
      return await this._axios.post(PROFILE_BASE_URL + '/save', body);
    } catch (error) {
      console.log(error);
    }
  }

  async getAll(): Promise<AxiosResponse> {
    try {
      return await this._axios.get(PROFILE_BASE_URL + '/list');
    } catch (error) {
      console.log(error);
    }
  }

  async loadDataProfile(body: any): Promise<AxiosResponse> {
    try {
      return await this._axios.post(PROFILE_BASE_URL + '/load', body);
    } catch (error) {
      console.log(error);
    }
  }

  async loadProfile(profile_id: string | number): Promise<AxiosResponse> {
    try {
      return await this._axios.get(PROFILE_BASE_URL + `/load/${profile_id}`);
    } catch (error) {
      console.log(error);
    }
  }

  async get(profile_id: number | string): Promise<AxiosResponse> {
    try {
      return await this._axios.get(PROFILE_BASE_URL + `/get/${profile_id}`);
    } catch (error) {
      console.log(error);
    }
  }

  async delete(profile_id: number | string): Promise<AxiosResponse> {
    try {
      return await this._axios.get(PROFILE_BASE_URL + `/delete/${profile_id}`);
    } catch (error) {
      console.log(error);
    }
  }

  async start(): Promise<AxiosResponse> {
    try {
      return await this._axios.get('/action/start');
    } catch (error) {
      console.log(error);
    }
  }
}

export default new Profile();
