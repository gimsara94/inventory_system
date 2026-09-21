export async function lockLoginKeys(db, keys) {
  for (const key of keys) {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
  }
}

export async function findLoginAttemptsForUpdate(db, keys) {
  const { rows } = await db.query(
    'SELECT * FROM inventory.login_attempts WHERE key=ANY($1::text[]) FOR UPDATE',
    [keys],
  );
  return rows;
}

export async function recordLoginFailure(db, key) {
  await db.query(
    `INSERT INTO inventory.login_attempts(key,failures,window_started,blocked_until)
      VALUES($1,1,now(),NULL)
      ON CONFLICT(key) DO UPDATE SET
      failures=CASE
        WHEN inventory.login_attempts.window_started < now()-interval '10 minutes' THEN 1
        ELSE inventory.login_attempts.failures+1
      END,
      window_started=CASE
        WHEN inventory.login_attempts.window_started < now()-interval '10 minutes' THEN now()
        ELSE inventory.login_attempts.window_started
      END,
      blocked_until=CASE
        WHEN inventory.login_attempts.window_started >= now()-interval '10 minutes'
          AND inventory.login_attempts.failures >= 9 THEN now()+interval '10 minutes'
        ELSE NULL
      END`,
    [key],
  );
}

export async function clearLoginAttempts(db, keys) {
  await db.query(
    'DELETE FROM inventory.login_attempts WHERE key=ANY($1::text[])',
    [keys],
  );
}
