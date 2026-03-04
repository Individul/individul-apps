const { Notification } = require('electron');
const path = require('path');
const config = require('./config');
const { getValidToken } = require('./token-manager');

let pollInterval = null;
let lastKnownUnreadCount = 0;
let lastKnownAlertIds = new Set();
let trayUpdateCallback = null;

async function fetchUnreadCount(token) {
  const response = await fetch(
    `${config.API_BASE_URL}${config.ALERTS_UNREAD_COUNT}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function fetchUnreadAlerts(token) {
  const params = new URLSearchParams({
    is_read: 'false',
    ordering: '-created_at',
  });
  const response = await fetch(
    `${config.API_BASE_URL}${config.ALERTS_LIST}?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.results;
}

function getAlertTypeTitle(alertType) {
  const titles = {
    overdue: 'Termen depasit',
    imminent: 'Termen iminent',
    upcoming: 'Termen in curand',
    fulfilled: 'Termen indeplinit',
  };
  return titles[alertType] || 'Alerta noua';
}

function showAlertNotification(alert, mainWindow) {
  const notification = new Notification({
    title: getAlertTypeTitle(alert.alert_type),
    body: `${alert.person_name}: ${alert.message}`,
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  notification.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.loadURL(
      config.APP_URL.replace(/\/$/, '') + '/termene/alerts/'
    );
  });

  notification.show();
}

async function pollTick(mainWindow) {
  try {
    const token = await getValidToken(mainWindow.webContents);
    if (!token) return; // User not logged in

    const { count } = await fetchUnreadCount(token);

    // Update tray badge
    if (trayUpdateCallback) {
      trayUpdateCallback(count);
    }

    // If count increased, fetch alerts and show notifications
    if (count > lastKnownUnreadCount) {
      const alerts = await fetchUnreadAlerts(token);
      const newAlerts = alerts.filter((a) => !lastKnownAlertIds.has(a.id));

      // Show max 5 individual notifications
      const toNotify = newAlerts.slice(0, 5);
      for (const alert of toNotify) {
        showAlertNotification(alert, mainWindow);
      }

      // Summary if more than 5
      if (newAlerts.length > 5) {
        const summary = new Notification({
          title: 'Alerte noi',
          body: `Aveti ${newAlerts.length} alerte noi necitite.`,
          icon: path.join(__dirname, '../assets/icon.png'),
        });
        summary.on('click', () => {
          mainWindow.show();
          mainWindow.focus();
        });
        summary.show();
      }

      lastKnownAlertIds = new Set(alerts.map((a) => a.id));
    } else if (count === 0) {
      lastKnownAlertIds.clear();
    }

    lastKnownUnreadCount = count;
  } catch (err) {
    console.error('Alert polling error:', err.message);
  }
}

function startPolling(mainWindow, updateTrayBadgeFn) {
  trayUpdateCallback = updateTrayBadgeFn;

  // Initial poll after 10s (let the page load)
  setTimeout(() => pollTick(mainWindow), 10000);

  // Then poll every 2 minutes
  pollInterval = setInterval(
    () => pollTick(mainWindow),
    config.POLL_INTERVAL_MS
  );
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

module.exports = { startPolling, stopPolling };
