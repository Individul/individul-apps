import { randomBytes } from 'crypto';

const tokens = new Map();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createToken() {
  const token = randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + TOKEN_EXPIRY_MS);
  return token;
}

export function validateToken(token) {
  const expiry = tokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    tokens.delete(token);
    return false;
  }
  return true;
}

export function deleteToken(token) {
  tokens.delete(token);
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token necesar' });
  }
  const token = authHeader.slice(7);
  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Token invalid sau expirat' });
  }
  next();
}
