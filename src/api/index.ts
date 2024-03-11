import axios, { AxiosInstance } from 'axios';

export class Api {
  public _axios: AxiosInstance;

  constructor() {
    this._axios = axios.create({
      baseURL: process.env.SERVER_URL || 'http://localhost:8080',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }
}

export default new Api();
