// A minimal D1Database-compatible adapter backed by node:sqlite (Node >= 22.5).
// Lets db.ts and the route layer run against a real SQLite database in tests.
import { createRequire } from "node:module";
// node:sqlite is resolved at runtime so vite-node never sees the builtin specifier.
const req = createRequire(import.meta.url);
const { DatabaseSync } = req("node:sqlite") as { DatabaseSync: new (p?: string) => DatabaseSyncLike };

interface DatabaseSyncLike {
  exec(sql: string): void;
  prepare(sql: string): unknown;
  close(): void;
}

export interface D1BatchItem {
  sql: string;
  params: unknown[];
}

const norm = (v: unknown): unknown => {
  if (v === undefined || v === null) return null;
  if (typeof v === "bigint") return Number(v);
  return v;
};

export class SqliteD1 {
  private db: DatabaseSyncLike;
  constructor(path: string = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys = OFF;");
  }
  exec(sql: string): void {
    this.db.exec(sql);
  }
  prepare(sql: string) {
    const stmt = this.db.prepare(sql) as unknown as {
      all: (...args: unknown[]) => unknown[];
      run: (...args: unknown[]) => { lastInsertRowid: number | bigint; changes: number };
    };
    return {
      bind: (...args: unknown[]) => ({
        all: async <T = Record<string, unknown>>() => {
          const rows = stmt.all(...args.map(norm)) as T[];
          return { results: rows };
        },
        run: async () => {
          const info = stmt.run(...args.map(norm));
          return { meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) } };
        },
      }),
    };
  }
  async batch(items: Array<D1BatchItem | { run: () => Promise<unknown> }>): Promise<unknown[]> {
    this.db.exec("BEGIN");
    try {
      const out: unknown[] = [];
      for (const item of items) {
        if (item && typeof (item as { run?: unknown }).run === "function") {
          out.push(await (item as { run: () => Promise<unknown> }).run());
          continue;
        }
        const raw = item as D1BatchItem;
        const stmt = this.db.prepare(raw.sql) as unknown as {
          run: (...args: unknown[]) => { lastInsertRowid: number | bigint; changes: number };
        };
        const info = stmt.run(...raw.params.map(norm));
        out.push({ meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) } });
      }
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close(): void {
    this.db.close();
  }
}
