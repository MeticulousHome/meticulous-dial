import Api from '@meticulous-home/espresso-api';

export const api = new Api(
  undefined,
  process.env.SERVER_URL || 'http://localhost:8080/'
);
