import Api from 'meticulous-api';

export const api = new Api(
  undefined,
  process.env.SERVER_URL || 'http://localhost:8080/'
);
