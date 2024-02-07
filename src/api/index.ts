import axios, { AxiosInstance } from 'axios';

export class Api {
  public _axios: AxiosInstance;

  constructor() {
    this._axios = axios.create({
      baseURL: process.env.SERVER_URL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }
}

export default new Api();
