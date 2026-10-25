/** Small D1 boundary. Conditional INSERTs share one transaction with their CAS. */
export class McpAuthStore {
  private db: D1Database;
  constructor(db: D1Database) { this.db = db; }
  statement(sql: string, ...values: unknown[]) { return this.db.prepare(sql).bind(...values); }
  first<T>(sql: string, ...values: unknown[]) { return this.statement(sql, ...values).first<T>(); }
  all<T>(sql: string, ...values: unknown[]) { return this.statement(sql, ...values).all<T>(); }
  run(sql: string, ...values: unknown[]) { return this.statement(sql, ...values).run(); }
  batch(statements: D1PreparedStatement[]) { return this.db.batch(statements); }
  async rate(key: string, now: number, limit: number, window: number) {
    const row = await this.first<{ count: number }>(`INSERT INTO marker_mcp_limits(key,window_start,count) VALUES(?,?,1)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<=? THEN 1 ELSE count+1 END,
      window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END RETURNING count`, key, now, now-window, now-window);
    return Boolean(row && row.count <= limit);
  }
  async cleanup(now: number) {
    // Retain consumed refresh hashes until the family expires: reuse detection needs them.
    await this.batch([
      this.statement('DELETE FROM marker_mcp_login_requests WHERE expires_at<=?', now),
      this.statement('DELETE FROM marker_mcp_requests WHERE expires_at<=?', now),
      this.statement('DELETE FROM marker_mcp_codes WHERE expires_at<=?', now),
      this.statement('DELETE FROM marker_mcp_grants WHERE expires_at<=?', now),
      this.statement('DELETE FROM marker_mcp_clients WHERE authorized_at IS NULL AND expires_at<=? AND NOT EXISTS(SELECT 1 FROM marker_mcp_grants g WHERE g.client_id=marker_mcp_clients.client_id)', now),
      this.statement('DELETE FROM marker_mcp_limits WHERE window_start<?', now-86400),
    ]);
  }
}
