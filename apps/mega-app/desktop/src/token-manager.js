const config = require('./config');

let cachedAccessToken = null;
let cachedRefreshToken = null;

async function getAccessToken(webContents) {
  try {
    const token = await webContents.executeJavaScript(
      `localStorage.getItem('${config.ACCESS_TOKEN_KEY}')`
    );
    cachedAccessToken = token;
    return token;
  } catch {
    return cachedAccessToken;
  }
}

async function getRefreshToken(webContents) {
  try {
    const token = await webContents.executeJavaScript(
      `localStorage.getItem('${config.REFRESH_TOKEN_KEY}')`
    );
    cachedRefreshToken = token;
    return token;
  } catch {
    return cachedRefreshToken;
  }
}

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    const expiresAt = payload.exp * 1000;
    return Date.now() >= expiresAt - config.TOKEN_REFRESH_BUFFER_MS;
  } catch {
    return true;
  }
}

async function refreshAccessToken(webContents) {
  const refreshToken = await getRefreshToken(webContents);
  if (!refreshToken) return null;

  try {
    const response = await fetch(
      `${config.API_BASE_URL}${config.TOKEN_REFRESH}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.access) {
      // Write back to localStorage so the web app stays in sync
      await webContents.executeJavaScript(
        `localStorage.setItem('${config.ACCESS_TOKEN_KEY}', '${data.access}')`
      );
      cachedAccessToken = data.access;

      if (data.refresh) {
        await webContents.executeJavaScript(
          `localStorage.setItem('${config.REFRESH_TOKEN_KEY}', '${data.refresh}')`
        );
        cachedRefreshToken = data.refresh;
      }
      return data.access;
    }
    return null;
  } catch {
    return null;
  }
}

async function getValidToken(webContents) {
  let token = await getAccessToken(webContents);
  if (isTokenExpired(token)) {
    token = await refreshAccessToken(webContents);
  }
  return token;
}

module.exports = { getValidToken };
