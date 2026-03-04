module.exports = {
  // Production URL where the web app is served
  APP_URL: 'http://46.224.209.71/hub/',

  // API base URL (through Nginx proxy)
  API_BASE_URL: 'http://46.224.209.71/hub-api',

  // Alert polling interval (2 minutes)
  POLL_INTERVAL_MS: 2 * 60 * 1000,

  // Refresh token 5 minutes before expiry
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000,

  // Window dimensions
  WINDOW_WIDTH: 1280,
  WINDOW_HEIGHT: 800,
  WINDOW_MIN_WIDTH: 900,
  WINDOW_MIN_HEIGHT: 600,

  // localStorage keys (must match web app)
  ACCESS_TOKEN_KEY: 'access_token',
  REFRESH_TOKEN_KEY: 'refresh_token',

  // API endpoints (relative to API_BASE_URL)
  ALERTS_UNREAD_COUNT: '/api/v1/alerts/unread_count/',
  ALERTS_LIST: '/api/v1/alerts/',
  TOKEN_REFRESH: '/api/v1/auth/refresh/',
};
