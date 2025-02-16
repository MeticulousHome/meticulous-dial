import { app, BrowserWindow, ipcMain } from 'electron';

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  let config: Electron.BrowserWindowConstructorOptions = {
    height: 480,
    width: 480,
    title: 'Meticulous',
    useContentSize: true,
    darkTheme: true,
    backgroundColor: 'black',
    center: true,
    minimizable: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: true,
      contextIsolation: true
    }
  };

  if (app.isPackaged) {
    config = {
      ...config,
      autoHideMenuBar: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      closable: false,
      titleBarStyle: 'hidden',

      // These will be changed once the renderer sends a message to change the window
      kiosk: false,
      height: 1,
      width: 1
    };
  }
  // Create the browser window.
  let mainWindow = new BrowserWindow(config);
  mainWindow.center();

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('webContents: render-process-gone', details, event);
    console.error('Killing app after render-process-gone!!!');
    app.quit();
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.on('ready', async () => {
    console.log('React indicates it is ready');

    const status = app.getGPUFeatureStatus();
    console.log('GPU Feature Status:', status);

    if (!app.isPackaged) {
      return;
    }

    mainWindow.restore();
    mainWindow.setSize(480, 480);
    mainWindow.setContentSize(480, 480);
    mainWindow.setKiosk(true);
    mainWindow.center();
    mainWindow.setMenuBarVisibility(false);
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
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
