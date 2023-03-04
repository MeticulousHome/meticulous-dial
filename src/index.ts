import { app, BrowserWindow, ipcMain } from 'electron';
import { IpcMainEvent } from 'electron/main';
import fs from 'fs';
// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

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

const saveFile = (_event: IpcMainEvent, filename: string) => {
  fs.writeFile(filename, 'write file using Electron', (err) => {
    if (err) throw err;
    console.log('The file has been saved!');
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  ipcMain.on('saveFile', saveFile);

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
