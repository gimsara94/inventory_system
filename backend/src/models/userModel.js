import { getPool } from '../db/pool.js';

export async function findUserByEmail(db, address) {
  const { rows } = await db.query('SELECT * FROM inventory.users WHERE email=$1', [address]);
  return rows[0] ?? null;
}

export async function findAuthenticatedUser(id) {
  const { rows } = await getPool().query(
    'SELECT id,email,name,role,active,token_version FROM inventory.users WHERE id=$1',
    [id],
  );
  return rows[0] ?? null;
}

export async function listUsers() {
  const { rows } = await getPool().query(
    'SELECT id,email,name,role,active FROM inventory.users ORDER BY id',
  );
  return rows;
}

export async function createUser({ address, name, passwordHash, role }) {
  const { rows } = await getPool().query(
    `INSERT INTO inventory.users(email,name,password_hash,role)
      VALUES($1,$2,$3,$4) RETURNING id,email,name,role,active`,
    [address, name, passwordHash, role],
  );
  return rows[0];
}

export async function findUserForUpdate(db, id) {
  const { rows } = await db.query(
    'SELECT * FROM inventory.users WHERE id=$1 FOR UPDATE',
    [id],
  );
  return rows[0] ?? null;
}

export async function lockUserAdministration(db) {
  await db.query('SELECT pg_advisory_xact_lock(601291)');
}

export async function countActiveAdmins(db) {
  const { rows } = await db.query(
    "SELECT count(*)::int AS count FROM inventory.users WHERE role='admin' AND active=true",
  );
  return rows[0].count;
}

export async function updateUser(db, { id, name, role, active, passwordHash }) {
  const { rows } = await db.query(
    `UPDATE inventory.users SET
      name=$2,role=$3,active=$4,password_hash=$5,
      token_version=token_version+1 WHERE id=$1
      RETURNING id,email,name,role,active`,
    [id, name, role, active, passwordHash],
  );
  return rows[0];
}

export async function updatePasswordHash(db, id, passwordHash) {
  await db.query(
    'UPDATE inventory.users SET password_hash=$2 WHERE id=$1',
    [id, passwordHash],
  );
}
