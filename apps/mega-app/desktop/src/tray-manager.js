const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let tray = null;
let mainWindow = null;

function setupTray(window) {
  mainWindow = window;

  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));

  tray.setToolTip('Mega Hub');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Deschide Mega Hub',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Iesire',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function updateTrayBadge(count) {
  if (!tray) return;

  if (count > 0) {
    tray.setToolTip(`Mega Hub - ${count} alerte necitite`);
    const alertIconPath = path.join(__dirname, '../assets/tray-icon-alert.png');
    tray.setImage(nativeImage.createFromPath(alertIconPath));
    if (mainWindow) {
      mainWindow.setOverlayIcon(
        nativeImage.createFromPath(alertIconPath),
        `${count} alerte necitite`
      );
    }
  } else {
    tray.setToolTip('Mega Hub');
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    tray.setImage(nativeImage.createFromPath(iconPath));
    if (mainWindow) {
      mainWindow.setOverlayIcon(null, '');
    }
  }
}

module.exports = { setupTray, updateTrayBadge };
