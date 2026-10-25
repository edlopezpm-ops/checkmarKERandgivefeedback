// Adapted from owned aekr-web src/analytics-auth-store.js at 81436c2f81bde7f39e589c6166d9c28d20465685; namespaced for marKER.
// Authentication persistence is deliberately separate from aggregate research data.
async function batch(db, statements) {
  const results = await db.batch(statements);
  if (results.some(result => result.success === false)) throw new Error('Owner authentication unavailable');
  return results;
}
function cleanup(db, now) {
  return [
    db.prepare('DELETE FROM marker_auth_challenges WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM marker_auth_sessions WHERE expires_at <= ? OR last_seen <= ?').bind(now, now - 1800),
    db.prepare('DELETE FROM marker_auth_limits WHERE window_start < ?').bind(Math.floor(now / 86400) * 86400),
  ];
}

export async function reserveChallenge(db, { challengeHash, ownerHash, codeHash, now, globalKey, dayKey, ipKey, ownerKey, known }) {
  const hour = Math.floor(now / 3600) * 3600;
  const day = Math.floor(now / 86400) * 86400;
  const statements = cleanup(db, now);
  const guardIndex = statements.length;
  // The transaction ticket binds subsequent writes to this admitted request.
  // Unknown emails and cooldown refusals consume the same IP/global quota.
  statements.push(db.prepare(`
    INSERT INTO marker_auth_limits (key, window_start, count, last_at, ticket)
    SELECT ?, ?, 1, ?, ?
    WHERE COALESCE((SELECT count FROM marker_auth_limits WHERE key = ? AND window_start = ?), 0) < 100
      AND COALESCE((SELECT count FROM marker_auth_limits WHERE key = ? AND window_start = ?), 0) < 10
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
      window_start = excluded.window_start, last_at = excluded.last_at, ticket = excluded.ticket
  `).bind(globalKey, hour, now, challengeHash, globalKey, hour, ipKey, hour));
  statements.push(db.prepare(`
    INSERT INTO marker_auth_limits (key, window_start, count, last_at, ticket)
    SELECT ?, ?, 1, ?, ? WHERE EXISTS (SELECT 1 FROM marker_auth_limits WHERE key = ? AND ticket = ?)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
      window_start = excluded.window_start, last_at = excluded.last_at, ticket = excluded.ticket
  `).bind(ipKey, hour, now, challengeHash, globalKey, challengeHash));
  statements.push(db.prepare(`
    INSERT INTO marker_auth_challenges (challenge_hash, owner_hash, code_hash, created_at, expires_at, attempts)
    SELECT ?, ?, ?, ?, ?, 0
    WHERE EXISTS (SELECT 1 FROM marker_auth_limits WHERE key = ? AND ticket = ?)
      AND COALESCE((SELECT count FROM marker_auth_limits WHERE key = ? AND window_start = ?), 0) < 5
      AND COALESCE((SELECT last_at FROM marker_auth_limits WHERE key = ?), 0) <= ?
      AND (? = 0 OR COALESCE((SELECT count FROM marker_auth_limits WHERE key = ? AND window_start = ?), 0) < 30)
      AND (SELECT COUNT(*) FROM marker_auth_challenges) < 100
  `).bind(challengeHash, ownerHash, codeHash, now, now + 300, globalKey, challengeHash, ownerKey, hour, ownerKey, now - 60, known ? 1 : 0, dayKey, day));
  statements.push(db.prepare(`
    INSERT INTO marker_auth_limits (key, window_start, count, last_at, ticket)
    SELECT ?, ?, 1, ?, ? WHERE EXISTS (SELECT 1 FROM marker_auth_challenges WHERE challenge_hash = ?)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
      window_start = excluded.window_start, last_at = excluded.last_at, ticket = excluded.ticket
  `).bind(ownerKey, hour, now, challengeHash, challengeHash));
  statements.push(db.prepare(`
    INSERT INTO marker_auth_limits (key, window_start, count, last_at, ticket)
    SELECT ?, ?, 1, ?, ? WHERE ? = 1 AND EXISTS (SELECT 1 FROM marker_auth_challenges WHERE challenge_hash = ?)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
      window_start = excluded.window_start, last_at = excluded.last_at, ticket = excluded.ticket
  `).bind(dayKey, day, now, challengeHash, known ? 1 : 0, challengeHash));
  const results = await batch(db, statements);
  if (results[guardIndex].meta.changes !== 1) return 'rate';
  return results[guardIndex + 2].meta.changes === 1 ? 'created' : 'cooldown';
}

// Help has its own HMAC-namespaced counters and never creates or cleans up auth state.
export async function reserveHelp(db, { ticket, now, globalKey, dayKey, ipKey, ownerKey, known }) {
  const hour = Math.floor(now / 3600) * 3600;
  const day = Math.floor(now / 86400) * 86400;
  const results = await batch(db, [
    db.prepare(`INSERT INTO marker_auth_limits (key, window_start, count, last_at, ticket)
      SELECT ?, ?, 1, ?, ?
      WHERE COALESCE((SELECT count FROM marker_auth_limits WHERE key = ? AND window_start = ?), 0) < 100
        AND COALESCE((SELECT count FROM marker_auth_limits WHERE key = ? AND window_start = ?), 0) < 10
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
        window_start = excluded.window_start, last_at = excluded.last_at, ticket = excluded.ticket
    `).bind(globalKey, hour, now, ticket, globalKey, hour, ipKey, hour),
    db.prepare(`INSERT INTO marker_auth_limits (key, window_start, count, last_at, ticket)
      SELECT ?, ?, 1, ?, ? WHERE EXISTS (SELECT 1 FROM marker_auth_limits WHERE key = ? AND ticket = ?)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
        window_start = excluded.window_start, last_at = excluded.last_at, ticket = excluded.ticket
    `).bind(ipKey, hour, now, ticket, globalKey, ticket),
    db.prepare(`INSERT INTO marker_auth_limits (key, window_start, count, last_at, ticket)
      SELECT ?, ?, 1, ?, ?
      WHERE EXISTS (SELECT 1 FROM marker_auth_limits WHERE key = ? AND ticket = ?)
        AND COALESCE((SELECT count FROM marker_auth_limits WHERE key = ? AND window_start = ?), 0) < 5
        AND COALESCE((SELECT last_at FROM marker_auth_limits WHERE key = ?), 0) <= ?
        AND (? = 0 OR COALESCE((SELECT count FROM marker_auth_limits WHERE key = ? AND window_start = ?), 0) < 30)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
        window_start = excluded.window_start, last_at = excluded.last_at, ticket = excluded.ticket
    `).bind(ownerKey, hour, now, ticket, globalKey, ticket, ownerKey, hour, ownerKey, now - 60, known ? 1 : 0, dayKey, day),
    db.prepare(`INSERT INTO marker_auth_limits (key, window_start, count, last_at, ticket)
      SELECT ?, ?, 1, ?, ? WHERE ? = 1 AND EXISTS (SELECT 1 FROM marker_auth_limits WHERE key = ? AND ticket = ?)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
        window_start = excluded.window_start, last_at = excluded.last_at, ticket = excluded.ticket
    `).bind(dayKey, day, now, ticket, known ? 1 : 0, ownerKey, ticket),
  ]);
  if (results[0].meta.changes !== 1) return 'rate';
  return results[2].meta.changes === 1 ? 'reserved' : 'cooldown';
}

export async function challengeOwner(db, hash) {
  const [result] = await batch(db, [db.prepare('SELECT owner_hash FROM marker_auth_challenges WHERE challenge_hash = ?').bind(hash)]);
  return result.results?.[0]?.owner_hash || null;
}

export async function consumeChallenge(db, { challengeHash, codeHash, sessionHash, ownerHashes, now }) {
  const [attempt, session, , remaining] = await batch(db, [
    db.prepare(`UPDATE marker_auth_challenges SET attempts = attempts + 1
      WHERE challenge_hash = ? AND expires_at > ? AND attempts < 5 AND consumed_at IS NULL`).bind(challengeHash, now),
    db.prepare(`INSERT INTO marker_auth_sessions (session_hash, owner_hash, created_at, expires_at, last_seen)
      SELECT ?, owner_hash, ?, ?, ? FROM marker_auth_challenges
      WHERE challenge_hash = ? AND code_hash = ? AND expires_at > ? AND attempts BETWEEN 1 AND 5
        AND consumed_at IS NULL AND changes() = 1 AND owner_hash IN (${ownerHashes.map(() => '?').join(',')})
    `).bind(sessionHash, now, now + 21600, now, challengeHash, codeHash, now, ...ownerHashes),
    db.prepare(`UPDATE marker_auth_challenges SET consumed_at = ?
      WHERE challenge_hash = ? AND EXISTS (SELECT 1 FROM marker_auth_sessions WHERE session_hash = ?)`)
      .bind(now, challengeHash, sessionHash),
    db.prepare(`SELECT 1 FROM marker_auth_challenges WHERE challenge_hash = ? AND expires_at > ?
      AND attempts < 5 AND consumed_at IS NULL`).bind(challengeHash, now),
  ]);
  return { accepted: attempt.meta.changes === 1 && session.meta.changes === 1, usable: Boolean(remaining.results?.length) };
}

export async function touchSession(db, hash, ownerHashes, now) {
  const [result] = await batch(db, [db.prepare(`UPDATE marker_auth_sessions SET last_seen = ?
    WHERE session_hash = ? AND expires_at > ? AND last_seen > ?
      AND owner_hash IN (${ownerHashes.map(() => '?').join(',')})`).bind(now, hash, now, now - 1800, ...ownerHashes)]);
  return result.meta.changes === 1;
}

export async function revokeAuth(db, session, challenge) {
  return batch(db, [
    db.prepare('DELETE FROM marker_auth_sessions WHERE session_hash = ?').bind(session),
    db.prepare('DELETE FROM marker_auth_challenges WHERE challenge_hash = ?').bind(challenge),
  ]);
}

export async function purgeAuth(db, now) { return batch(db, cleanup(db, now)); }
