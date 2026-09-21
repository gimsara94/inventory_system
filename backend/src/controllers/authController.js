import { createHash } from 'node:crypto';
import { transaction } from '../db/pool.js';
import { clearSession, issueSession } from '../middleware/auth.js';
import {
  clearLoginAttempts,
  findLoginAttemptsForUpdate,
  lockLoginKeys,
  recordLoginFailure,
} from '../models/loginAttemptModel.js';
import { findUserByEmail, updatePasswordHash } from '../models/userModel.js';
import { hashPassword, needsRehash, verifyPassword } from '../utils/password.js';
import { publicUser } from '../utils/presenters.js';
import { email, InputError } from '../utils/validation.js';

const invalidCredentials = 'Invalid email or password.';
const dummyHash = await hashPassword('unused dummy password');

function loginKeys(address, ip) {
  return [
    `account:${createHash('sha256').update(address).digest('hex')}`,
    `ip:${createHash('sha256').update(ip).digest('hex')}`,
  ].sort();
}

export async function login(req, res) {
  const address = email(req.body?.email);
  const submittedPassword = req.body?.password;
  if (typeof submittedPassword !== 'string' || submittedPassword.length > 200) {
    throw new InputError(invalidCredentials, 401);
  }

  const keys = loginKeys(address, req.ip);
  const user = await transaction(async db => {
    await lockLoginKeys(db, keys);
    const attempts = await findLoginAttemptsForUpdate(db, keys);
    if (attempts.some(row => row.blocked_until && row.blocked_until > new Date())) {
      throw new InputError('Too many sign-in attempts. Try again in 10 minutes.', 429);
    }

    const candidate = await findUserByEmail(db, address);
    const passwordMatches = await verifyPassword(
      submittedPassword,
      candidate?.password_hash || dummyHash,
    );
    if (!candidate?.active || !passwordMatches) {
      for (const key of keys) await recordLoginFailure(db, key);
      return null;
    }

    if (needsRehash(candidate.password_hash)) {
      await updatePasswordHash(db, candidate.id, await hashPassword(submittedPassword));
    }
    await clearLoginAttempts(db, keys);
    return candidate;
  });

  if (!user) throw new InputError(invalidCredentials, 401);
  const csrf = issueSession(res, user);
  res.json({ user: publicUser(user), csrf });
}

export function getCurrentUser(req, res) {
  res.json({ user: publicUser(req.user), csrf: req.csrf });
}

export function logout(_req, res) {
  clearSession(res);
  res.json({ ok: true });
}
