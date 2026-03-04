const { autoUpdater } = require('electron-updater');
const { dialog, Notification } = require('electron');

function setupAutoUpdater(mainWindow) {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;

  // Check for updates on start
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Update check failed:', err.message);
  });

  // Re-check every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Update check failed:', err.message);
    });
  }, 4 * 60 * 60 * 1000);

  autoUpdater.on('update-available', (info) => {
    new Notification({
      title: 'Actualizare disponibila',
      body: `Versiunea ${info.version} se descarca automat.`,
    }).show();
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Reporneste acum', 'Mai tarziu'],
        title: 'Actualizare disponibila',
        message: `Versiunea ${info.version} a fost descarcata.`,
        detail: 'Aplicatia se va reporni pentru a instala actualizarea.',
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message);
  });
}

module.exports = { setupAutoUpdater };
