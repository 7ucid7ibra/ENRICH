const { app, BrowserWindow, globalShortcut, systemPreferences } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;

const ipc = require('./ipc');

function createWindow() {
  if (process.platform === 'darwin' && isDev) {
    const devIcon = path.join(__dirname, '..', 'assets', 'icon.png');
    if (devIcon && require('fs').existsSync(devIcon)) {
      app.dock.setIcon(devIcon);
    }
  }
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  // Load the app
  const devPort = process.env.DEV_PORT || '3000';
  const startUrl = isDev 
    ? `http://localhost:${devPort}` 
    : `file://${path.join(__dirname, '../frontend/out/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// Global hotkey registration
function registerGlobalHotkey() {
  const ret = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    console.log('Global hotkey triggered');
    ipc.handleGlobalMainRecordingToggle().catch((error) => {
      console.error('Global hotkey toggle failed:', error);
    });
  });

  if (!ret) {
    console.error('Global hotkey registration failed');
  }
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  ipc.setupIpcHandlers(mainWindow);
  registerGlobalHotkey();

  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').catch((error) => {
      console.warn('Microphone permission request failed:', error);
    });
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
