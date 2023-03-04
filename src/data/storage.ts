import os from 'os';
import storage from 'electron-json-storage';

const dataPath = storage.getDataPath();
console.log(dataPath);

export default storage;
