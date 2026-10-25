import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentStore, AgentSqlValue } from "./agents-store.ts";

/** Separate SQLite custody; never writes workspace.json or studio.sqlite. */
export function createLocalAgentStore(directory: string): AgentStore {
  mkdirSync(resolve(directory), { recursive: true });
  const db = new DatabaseSync(join(resolve(directory), "agents.sqlite"));
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;");
  db.exec(readFileSync(new URL("../migrations-d1/0006_agents.sql", import.meta.url), "utf8"));
  return {
    async all<T>(sql: string, args: AgentSqlValue[] = []) { return db.prepare(sql).all(...args) as T[]; },
    async run(sql, args = []) { return Number(db.prepare(sql).run(...args).changes); },
    async batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const result = statements.map(({ sql, args = [] }) => Number(db.prepare(sql).run(...args).changes)); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    close() { db.close(); },
  };
}
