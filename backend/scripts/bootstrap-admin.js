import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { transaction, getPool } from '../src/db/pool.js';
import { email, password, text } from '../src/utils/validation.js';
import { hashPassword } from '../src/utils/password.js';

const hidden = new Writable({ write(_chunk, _encoding, done) { done(); } });
const normal = readline.createInterface({ input: process.stdin, output: process.stdout });
const address = email(process.env.ADMIN_EMAIL || await normal.question('Admin email: '));
const name = text(process.env.ADMIN_NAME || await normal.question('Admin name: '), 'Name', 120, true);
normal.close();
let secret = process.env.ADMIN_PASSWORD;
if (!secret) {
  if (!process.stdin.isTTY) throw new Error('Run in a terminal to enter the password securely.');
  process.stdout.write('Admin password (12–200 characters): ');
  const prompt = readline.createInterface({ input: process.stdin, output: hidden, terminal: true });
  secret = await prompt.question('');
  process.stdout.write('\n');
  process.stdout.write('Repeat password: ');
  const repeated = await prompt.question('');
  prompt.close();
  process.stdout.write('\n');
  if (secret !== repeated) throw new Error('Passwords did not match. No account was created.');
}
const hash = await hashPassword(password(secret));
try {
  const created = await transaction(async db => {
    await db.query('SELECT pg_advisory_xact_lock(601292)');
    const { rows } = await db.query('SELECT count(*)::int AS count FROM inventory.users');
    if (rows[0].count !== 0) return false;
    await db.query(`INSERT INTO inventory.users(email,name,password_hash,role)
      VALUES($1,$2,$3,'admin')`, [address, name, hash]);
    return true;
  });
  if (!created) throw new Error('An account already exists. Sign in as an admin to add more users.');
  console.log(`First admin created: ${address}`);
} finally {
  await getPool().end();
}
