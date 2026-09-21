import { transaction } from '../db/pool.js';
import {
  countActiveAdmins,
  createUser as insertUser,
  findUserForUpdate,
  listUsers as selectUsers,
  lockUserAdministration,
  updateUser as persistUser,
} from '../models/userModel.js';
import { hashPassword } from '../utils/password.js';
import { publicUser } from '../utils/presenters.js';
import { email, InputError, password, positiveId, text } from '../utils/validation.js';

function validRole(value) {
  if (!['admin', 'staff'].includes(value)) {
    throw new InputError('Role must be admin or staff.');
  }
  return value;
}

export async function getUsers(_req, res) {
  const rows = await selectUsers();
  res.json(rows.map(publicUser));
}

export async function createUser(req, res) {
  const address = email(req.body?.email);
  const name = text(req.body?.name, 'Name', 120, true);
  const role = validRole(req.body?.role || 'staff');
  const passwordHash = await hashPassword(password(req.body?.password));
  const user = await insertUser({ address, name, passwordHash, role });
  res.status(201).json(publicUser(user));
}

export async function updateUser(req, res) {
  const id = positiveId(req.params.id);
  const body = req.body || {};
  const allowed = new Set(['name', 'role', 'active', 'password']);
  if (!Object.keys(body).length || Object.keys(body).some(key => !allowed.has(key))) {
    throw new InputError('Choose a user field to update.');
  }

  const name = body.name === undefined ? undefined : text(body.name, 'Name', 120, true);
  const role = body.role === undefined ? undefined : validRole(body.role);
  if (body.active !== undefined && typeof body.active !== 'boolean') {
    throw new InputError('active must be true or false.');
  }
  const passwordHash = body.password === undefined
    ? undefined
    : await hashPassword(password(body.password));

  const user = await transaction(async db => {
    await lockUserAdministration(db);
    const current = await findUserForUpdate(db, id);
    if (!current) throw new InputError('User not found.', 404);

    const nextRole = role ?? current.role;
    const nextActive = body.active ?? current.active;
    if (String(req.user.id) === id && (!nextActive || nextRole !== 'admin')) {
      throw new InputError('You cannot remove your own admin access.', 409);
    }
    if (current.role === 'admin' && current.active && (!nextActive || nextRole !== 'admin')) {
      if (await countActiveAdmins(db) <= 1) {
        throw new InputError('At least one active admin is required.', 409);
      }
    }

    return persistUser(db, {
      id,
      name: name ?? current.name,
      role: nextRole,
      active: nextActive,
      passwordHash: passwordHash ?? current.password_hash,
    });
  });
  res.json(publicUser(user));
}
