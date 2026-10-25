import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMcpApi } from './mcp.ts';
import { json } from './api.ts';

/** Separate loopback authorization storage, never an import of hosted tokens or
 * the Codex account store. This adapter implements only D1 operations we use. */
export function createLocalMcpApi(options: { directory: string; backend(request: Request): Promise<Response> }) {
  mkdirSync(options.directory, { recursive: true });
  const sql = new DatabaseSync(join(options.directory, 'mcp.sqlite'));
  sql.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  if (!sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='marker_mcp_clients'").get()) {
    sql.exec('BEGIN IMMEDIATE');
    try {
      sql.exec('CREATE TABLE marker_account_lifecycle(id INTEGER PRIMARY KEY,status TEXT NOT NULL); INSERT INTO marker_account_lifecycle VALUES(1,\'active\'); CREATE TABLE marker_auth_operator(id INTEGER PRIMARY KEY,user_id TEXT UNIQUE NOT NULL,tenant_id TEXT UNIQUE NOT NULL);');
      sql.prepare('INSERT INTO marker_auth_operator VALUES(1,?,?)').run(crypto.randomUUID().replaceAll('-', ''), crypto.randomUUID().replaceAll('-', ''));
      sql.exec(readFileSync(new URL('../migrations-d1/0010_mcp.sql', import.meta.url), 'utf8'));
      sql.exec('COMMIT');
    } catch (error) { sql.exec('ROLLBACK'); sql.close(); throw error; }
  }
  if (!sql.prepare('PRAGMA table_info(marker_mcp_clients)').all().some(column => column.name === 'authorized_at')) {
    sql.exec('BEGIN IMMEDIATE');
    try {
      sql.exec(readFileSync(new URL('../migrations-d1/0011_mcp_connections.sql', import.meta.url), 'utf8'));
      sql.exec('COMMIT');
    } catch (error) { sql.exec('ROLLBACK'); sql.close(); throw error; }
  }
  type LocalStatement = { execute(): { success: boolean; results: unknown[]; meta: { changes: number } }; bind(...values: unknown[]): LocalStatement; first<T>(): Promise<T | null>; all(): Promise<unknown>; run(): Promise<unknown> };
  const adapter = {
    prepare(text: string): LocalStatement {
      let args: SQLInputValue[] = [];
      const statement: LocalStatement = {
        bind(...values) { args = values as SQLInputValue[]; return statement; },
        execute() { const query = sql.prepare(text); const rows = query.columns().length ? query.all(...args) : null; return { success: true, results: rows ?? [], meta: { changes: rows ? Number(sql.prepare('SELECT changes() AS n').get()!.n) : Number(query.run(...args).changes) } }; },
        async first<T>() { return (statement.execute().results[0] as T | undefined) ?? null; },
        async all() { return statement.execute(); },
        async run() { return statement.execute(); },
      };
      return statement;
    },
    async batch(statements: LocalStatement[]) {
      sql.exec('BEGIN IMMEDIATE');
      try { const result = statements.map(statement => statement.execute()); sql.exec('COMMIT'); return result; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  const db = adapter as unknown as D1Database;
  const operator = sql.prepare('SELECT user_id,tenant_id FROM marker_auth_operator WHERE id=1').get() as { user_id: string; tenant_id: string };
  return {
    close() { sql.close(); },
    async handle(request: Request) {
      const url = new URL(request.url);
      if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url.origin)) return json({ error: 'LOCAL_ACCESS_REQUIRED' }, 403);
      return createMcpApi({
        db, origin: url.origin, backend: options.backend,
        ownerSession: async () => ({ userId: operator.user_id, tenantId: operator.tenant_id, email: 'local@marker.invalid' }),
        async assertActive() { if (sql.prepare('SELECT status FROM marker_account_lifecycle WHERE id=1').get()?.status !== 'active') throw new Error('Account closed'); },
      }).handle(request);
    },
  };
}
