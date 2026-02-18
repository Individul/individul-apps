import { Router } from 'express';
import { createToken, validateToken, deleteToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.APP_PASSWORD) {
    return res.status(401).json({ error: 'Parolă incorectă' });
  }
  const token = createToken();
  res.json({ token });
});

router.get('/check', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ authenticated: false });
  }
  const token = authHeader.slice(7);
  if (!validateToken(token)) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true });
});

router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    deleteToken(authHeader.slice(7));
  }
  res.json({ ok: true });
});

export default router;
