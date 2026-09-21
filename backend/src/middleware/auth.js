import { randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { requireConfig } from '../config/env.js';
import { findAuthenticatedUser } from '../models/userModel.js';
import { InputError } from '../utils/validation.js';

const COOKIE = 'inventory_session';

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(entry => {
    const index = entry.indexOf('=');
    return index < 0 ? [] : [entry.slice(0, index).trim(), entry.slice(index + 1).trim()];
  }).filter(entry => entry.length === 2));
}

function cookie(value, maxAge) {
  const secure = requireConfig().publicOrigin.startsWith('https://') ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${maxAge}`;
}

export function issueSession(res, user) {
  const config = requireConfig();
  const csrf = randomBytes(32).toString('base64url');
  const token = jwt.sign({ role: user.role, v: user.token_version, csrf }, config.jwtSecret, {
    algorithm: 'HS256', issuer: 'workshop-inventory', audience: 'inventory-api',
    subject: String(user.id), expiresIn: '12h',
  });
  res.setHeader('Set-Cookie', cookie(token, 12 * 3600));
  return csrf;
}

export function clearSession(res) { res.setHeader('Set-Cookie', cookie('', 0)); }

export async function authenticate(req, _res, next) {
  try {
    const bearer = /^Bearer (.+)$/i.exec(req.get('authorization') || '');
    const token = bearer?.[1] || parseCookies(req.get('cookie'))[COOKIE];
    if (!token) throw new InputError('Please sign in.', 401);
    const payload = jwt.verify(token, requireConfig().jwtSecret, {
      algorithms: ['HS256'], issuer: 'workshop-inventory', audience: 'inventory-api',
    });
    const user = await findAuthenticatedUser(payload.sub);
    if (!user || !user.active || user.token_version !== payload.v || user.role !== payload.role) {
      throw new InputError('Session expired. Sign in again.', 401);
    }
    req.user = user;
    req.csrf = payload.csrf;
    req.bearer = Boolean(bearer);
    next();
  } catch (error) {
    next(error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError
      ? new InputError('Session expired. Sign in again.', 401) : error);
  }
}

export function requireCsrf(req, _res, next) {
  if (req.bearer || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const supplied = req.get('x-csrf-token') || '';
  const expected = req.csrf || '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (!a.length || a.length !== b.length || !timingSafeEqual(a, b)) return next(new InputError('Invalid CSRF token. Refresh and retry.', 403));
  next();
}

export function adminOnly(req, _res, next) {
  return req.user.role === 'admin' ? next() : next(new InputError('Admin access required.', 403));
}
