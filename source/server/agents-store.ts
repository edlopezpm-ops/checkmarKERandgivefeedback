export type AgentSqlValue = string | number | null;
export type AgentSql = { sql: string; args?: AgentSqlValue[] };
export interface AgentStore {
  all<T>(sql: string, args?: AgentSqlValue[]): Promise<T[]>;
  run(sql: string, args?: AgentSqlValue[]): Promise<number>;
  batch(statements: AgentSql[]): Promise<number[]>;
  close?(): void;
}
export function createD1AgentStore(db: D1Database): AgentStore {
  return {
    async all<T>(sql: string, args: AgentSqlValue[] = []) { return (await db.prepare(sql).bind(...args).all<T>()).results; },
    async run(sql, args = []) { return Number((await db.prepare(sql).bind(...args).run()).meta.changes ?? 0); },
    async batch(statements) { return (await db.batch(statements.map(({ sql, args = [] }) => db.prepare(sql).bind(...args)))).map(result => Number(result.meta.changes ?? 0)); },
  };
}
