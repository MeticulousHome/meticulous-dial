import { app, BrowserWindow, ipcMain } from 'electron';
// eslint-disable-next-line import/no-unresolved
import { IpcMainEvent } from 'electron/main';
import { promises as fs } from 'fs';
import _, { difference } from 'lodash';
import mockPreset from './data/mock_presets.json';
import { IPreset, IPresetSetting, IPresetsSettingData } from './types';
import { isValidJson } from './utils';
import { settingsDefaultNewPreset } from './utils/mock';
// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const DEFAULT_USER_PATHNAME = 'userData';
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  let config: Electron.BrowserWindowConstructorOptions = {
    height: 480,
    width: 480,
    minHeight: 480,
    minWidth: 480,
    title: 'Meticulous',
    useContentSize: true,
    darkTheme: true,
    backgroundColor: 'black',
    center: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
    }
  };

  if (app.isPackaged) {
    config = {
      ...config,
      autoHideMenuBar: true,
      resizable: false,
      movable: false,
      kiosk: true,
      alwaysOnTop: true,
      closable: false
    };
  }
  // Create the browser window.
  const mainWindow = new BrowserWindow(config);

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

const saveFile = async (
  _event: IpcMainEvent,
  filename: string,
  content: string
) => {
  const path = app.getPath(DEFAULT_USER_PATHNAME);
  // const path = './';
  const filePath = `${path}/${filename}`;
  return await fs.writeFile(filePath, content);
};

const getLegacyPresetSettings = async (): Promise<
  IPresetsSettingData[] | undefined
> => {
  const path = app.getPath(DEFAULT_USER_PATHNAME);
  const presetSettingPath = `${path}/presetSettings.json`;
  try {
    const presetSettingData = await fs.readFile(presetSettingPath, 'utf-8');
    if (presetSettingData.trim()) return JSON.parse(presetSettingData.trim());
  } catch (error) {
    return undefined;
  }
};

const removePresetSettingFile = async () => {
  try {
    const path = app.getPath(DEFAULT_USER_PATHNAME);
    await fs.unlink(`${path}/presetSettings.json`);
    return true;
  } catch (error) {
    return true;
  }
};

const getUpdatedKeys = (
  oldData: IPresetSetting[],
  newData: IPresetSetting[]
) => {
  const keyOldData = oldData.map((i: IPresetSetting) => i.key);
  const keyNewData = newData.map((i: IPresetSetting) => i.key);
  const keys = difference(keyNewData, keyOldData);

  return keys;
};

const getPresetData = async () => {
  const defaultData = JSON.stringify(mockPreset);

  // const path = './src/data';
  const path = app.getPath(DEFAULT_USER_PATHNAME);
  const presetPath = `${path}/presets.json`;
  const presetSettingData = await getLegacyPresetSettings();
  //get file
  try {
    const presetData = await fs.readFile(presetPath, 'utf-8');
    if (presetData.trim() && isValidJson(presetData)) {
      if (presetSettingData) {
        const data = JSON.parse(presetData.trim()) as IPreset[];
        const presetDataWithSettings = data.map((preset) => {
          const settings = presetSettingData.find(
            (setting) => Number(setting.presetId) === preset.id
          ).settings;
          /* const nameKeyIndex = settings.findIndex(
            (setting) => setting.key === 'name'
          ); */

          const diffKeys = getUpdatedKeys(settings, settingsDefaultNewPreset);

          if (diffKeys.length > 0) {
            const settingsUpdated = diffKeys.map((key: any) => [
              ...settings,
              ...settingsDefaultNewPreset.filter((ns) => ns.key === key)
            ]);

            const keyOrdering = settingsDefaultNewPreset.map(
              (i: IPresetSetting) => i.key
            );

            const settingsPurged = keyOrdering
              .map((key: any, index: number) => {
                const settings = settingsUpdated[0].filter(
                  (setting: IPresetSetting) => setting.key === key
                );
                return { ...settings[0], id: ++index };
              })
              .map((item) => ({ ...item }));

            console.log(JSON.stringify(settingsPurged));

            return {
              ...preset,
              settings: settingsPurged
            };
          } else {
            return { ...preset, settings };
          }
        });
        const stringifyData = JSON.stringify(presetDataWithSettings);
        await removePresetSettingFile();
        await fs.writeFile(presetPath, stringifyData);
        return stringifyData;
      } else return presetData;
    } else {
      return defaultData;
    }
  } catch (error) {
    console.error('ERROR >>> ', error);
    await removePresetSettingFile();
    await fs.writeFile(presetPath, defaultData);
    return defaultData;
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  ipcMain.handle('saveFile', saveFile);
  ipcMain.handle('getPresetData', getPresetData);

  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
