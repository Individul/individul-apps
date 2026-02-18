import 'dotenv/config';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';

// Import DB (triggers schema migration on first import)
import db from './db/database.js';

// Import routes
import authRoutes from './routes/auth.js';
import persoaneRoutes from './routes/persoane.js';
import sedinteRoutes from './routes/sedinte.js';
import dashboardRoutes from './routes/dashboard.js';
import setariRoutes from './routes/setari.js';
import verificareRoutes from './routes/verificare.js';
import cautareRoutes from './routes/cautare.js';
import hotarariRoutes from './routes/hotarari.js';

// Import services
import { startScheduler } from './services/scheduler.js';
import { startTelegramBot } from './services/telegram.js';

// Import middleware
import { authMiddleware } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());

// Health check (unauthenticated)
app.get('/api/health', (req, res) => {
  let dbOk = false;
  let ultimaVerificare = null;
  try {
    db.prepare('SELECT 1').get();
    dbOk = true;
    ultimaVerificare = db.prepare('SELECT timestamp FROM verificari_log ORDER BY timestamp DESC LIMIT 1').get();
  } catch { /* ignore */ }

  res.json({
    status: dbOk ? 'ok' : 'degraded',
    uptime: process.uptime(),
    db: dbOk,
    ultima_verificare: ultimaVerificare?.timestamp || null,
    telegram_configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    version: '1.0.0'
  });
});

// Auth routes (unauthenticated)
app.use('/api/auth', authRoutes);

// Protected API routes
app.use('/api/persoane', authMiddleware, persoaneRoutes);
app.use('/api/sedinte', authMiddleware, sedinteRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/setari', authMiddleware, setariRoutes);
app.use('/api/verificare', authMiddleware, verificareRoutes);
app.use('/api/cautare', authMiddleware, cautareRoutes);
app.use('/api/hotarari', authMiddleware, hotarariRoutes);

// Serve static frontend (built Vite output)
const frontendDist = join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// SPA fallback: all non-API routes serve index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(frontendDist, 'index.html'));
  }
});

// Start services
startScheduler();
if (process.env.TELEGRAM_BOT_TOKEN) {
  startTelegramBot();
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Monitor Sedinte running on port ${PORT}`);
});
