// The singleton is server selected; neither requests nor providers choose it.
export async function authRows(db, sql, ...args) {
  const result = await db.batch([db.prepare(sql).bind(...args)]);
  if (result.some(entry => entry.success === false)) throw new Error('Authentication unavailable');
  return result[0].results || [];
}
export async function authBatch(db, statements) {
  const result = await db.batch(statements);
  if (result.some(entry => entry.success === false)) throw new Error('Authentication unavailable');
  return result;
}
export async function retainedOperator(db, ownerHash, bind = false) {
  if (bind) await authBatch(db, [db.prepare('UPDATE marker_auth_operator SET owner_hash=? WHERE id=1 AND owner_hash IS NULL').bind(ownerHash)]);
  const [operator] = await authRows(db, 'SELECT tenant_id,user_id,owner_hash FROM marker_auth_operator WHERE id=1');
  if (!operator || operator.owner_hash !== ownerHash) return null;
  return operator;
}
export async function sessionPrincipal(config, sessionHash, now, touch = true) {
  const [session] = await authRows(config.db, `SELECT session_hash,owner_hash,created_at,expires_at,last_seen
    FROM marker_auth_sessions WHERE session_hash=? AND expires_at>? AND last_seen>? AND owner_hash=?`,
    sessionHash, now, now - 1800, config.ownerHashes[0]);
  if (!session) return null;
  const operator = await retainedOperator(config.db, session.owner_hash, true);
  if (!operator) return null;
  const statements = [config.db.prepare(`INSERT OR IGNORE INTO marker_auth_principals(session_hash,tenant_id,user_id,auth_method,authenticated_at)
    SELECT session_hash,?,?,'email',created_at FROM marker_auth_sessions WHERE session_hash=? AND owner_hash=?`).bind(operator.tenant_id, operator.user_id, sessionHash, session.owner_hash)];
  if (touch) statements.push(config.db.prepare('UPDATE marker_auth_sessions SET last_seen=? WHERE session_hash=? AND expires_at>? AND last_seen>?').bind(now, sessionHash, now, now - 1800));
  await authBatch(config.db, statements);
  const [principal] = await authRows(config.db, `SELECT p.tenant_id,p.user_id,p.auth_method,p.authenticated_at,s.session_hash,s.owner_hash
    FROM marker_auth_principals p JOIN marker_auth_sessions s ON s.session_hash=p.session_hash
    WHERE p.session_hash=? AND p.tenant_id=? AND p.user_id=? AND s.expires_at>? AND s.last_seen>? AND s.owner_hash=?`, sessionHash, operator.tenant_id, operator.user_id, now, now - 1800, operator.owner_hash);
  return principal || null;
}
export async function boundGoogle(config) {
  return boundProvider(config,'https://accounts.google.com');
}
export async function boundProvider(config,issuer) {
  const operator = await retainedOperator(config.db, config.ownerHashes[0]);
  if (!operator) return null;
  const [identity] = await authRows(config.db, "SELECT subject_hash,tenant_id,user_id FROM marker_auth_identities WHERE issuer=? AND tenant_id=? AND user_id=?", issuer,operator.tenant_id, operator.user_id);
  return identity || null;
}
export async function purgeTenantAuth(db, now) {
  return authBatch(db, [
    db.prepare('DELETE FROM marker_auth_oauth_flows WHERE expires_at<=?').bind(now),
    db.prepare('DELETE FROM marker_auth_oauth_limits WHERE window_start<?').bind(Math.floor(now / 3600) * 3600),
    db.prepare('DELETE FROM marker_auth_principals WHERE NOT EXISTS(SELECT 1 FROM marker_auth_sessions s WHERE s.session_hash=marker_auth_principals.session_hash)').bind(),
  ]);
}
