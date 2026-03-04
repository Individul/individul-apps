const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const config = require('./config');
const { setupTray, updateTrayBadge } = require('./tray-manager');
const { startPolling, stopPolling } = require('./alert-poller');
const { setupAutoUpdater } = require('./auto-updater');

let mainWindow = null;

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.WINDOW_WIDTH,
    height: config.WINDOW_HEIGHT,
    minWidth: config.WINDOW_MIN_WIDTH,
    minHeight: config.WINDOW_MIN_HEIGHT,
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(config.APP_URL);

  // Show when content is ready (avoid white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Hide menu bar
  mainWindow.setMenuBarVisibility(false);

  // Handle new windows: allow same-origin and blob URLs, open external in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const appOrigin = new URL(config.APP_URL).origin;

    // Allow blank windows (used for file preview via blob URLs)
    if (!url || url === '' || url === 'about:blank') {
      return { action: 'allow' };
    }

    // Allow blob URLs (file previews)
    if (url.startsWith('blob:')) {
      return { action: 'allow' };
    }

    // Allow same-origin URLs (app navigation)
    try {
      if (new URL(url).origin === appOrigin) {
        return { action: 'allow' };
      }
    } catch {}

    // External URLs open in default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// IPC handlers
ipcMain.handle('get-app-version', () => app.getVersion());

app.whenReady().then(() => {
  createWindow();
  setupTray(mainWindow);
  startPolling(mainWindow, updateTrayBadge);
  setupAutoUpdater(mainWindow);
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopPolling();
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows
});
