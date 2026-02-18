/**
 * Test helpers for Speakeasy log browser.
 * In-memory SQLite via bun:sqlite + D1 shim, same pattern as Callwell.
 */
import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { loadRoutes } from "@/router";
import { loadLayouts } from "@/layouts";
import type { Env } from "@/types";
import { readFileSync } from "fs";
import path from "path";

const MIGRATION_PATH = path.resolve(import.meta.dir, "../../migrations/0001_init.sql");

/**
 * D1Database shim wrapping bun:sqlite.
 */
function createD1Shim(sqlite: Database): D1Database {
  return {
    prepare(query: string) {
      return {
        _query: query,
        _bindings: [] as any[],
        bind(...args: any[]) {
          this._bindings = args;
          return this;
        },
        async all<T = any>() {
          const stmt = sqlite.prepare(this._query);
          const rows = stmt.all(...this._bindings);
          return { results: rows as T[], success: true, meta: {} };
        },
        async first<T = any>(col?: string) {
          const stmt = sqlite.prepare(this._query);
          const row = stmt.get(...this._bindings) as any;
          if (col && row) return row[col] as T;
          return (row ?? null) as T;
        },
        async run() {
          const stmt = sqlite.prepare(this._query);
          const info = stmt.run(...this._bindings);
          return {
            results: [],
            success: true,
            meta: { changes: info.changes, last_row_id: info.lastInsertRowid },
          };
        },
        async raw<T = any>() {
          const stmt = sqlite.prepare(this._query);
          const rows = stmt.all(...this._bindings);
          return rows.map((r: any) => Object.values(r)) as T[];
        },
      } as any;
    },
    async dump() { return new ArrayBuffer(0); },
    async batch(stmts: any[]) {
      return Promise.all(stmts.map((s: any) => s.all()));
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
  } as any;
}

export interface TestContext {
  app: Hono<{ Bindings: Env }>;
  sqlite: Database;
  d1: D1Database;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  /** Seed a log entry */
  seedLog: (overrides?: Partial<{
    id: string;
    method: string;
    path: string;
    status_code: number;
    domain: string;
    timestamp: string;
    duration_ms: number;
    body_size: number;
  }>) => void;
  /** Seed multiple logs at once */
  seedLogs: (count: number, defaults?: Partial<{
    method: string;
    domain: string;
    status_code: number;
  }>) => void;
}

export function createTestContext(): TestContext {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA journal_mode = WAL");

  // Apply migration
  const migration = readFileSync(MIGRATION_PATH, "utf-8");
  sqlite.exec(migration);

  const d1 = createD1Shim(sqlite);

  const app = new Hono<{ Bindings: Env }>();

  // Inject D1 binding (mock SEARCH_SESSION too)
  app.use("*", async (c, next) => {
    (c.env as any) = {
      ...c.env,
      DB: d1,
      SEARCH_SESSION: {
        idFromName: () => ({ toString: () => "test-id" }),
        get: () => ({
          fetch: () => new Response("ws mock", { status: 101 }),
        }),
      },
    };
    await next();
  });

  loadLayouts(app);
  loadRoutes(app);

  let logSeq = 0;

  const seedLog = (overrides?: Partial<{
    id: string;
    method: string;
    path: string;
    status_code: number;
    domain: string;
    timestamp: string;
    duration_ms: number;
    body_size: number;
  }>) => {
    logSeq++;
    sqlite.prepare(`
      INSERT INTO http_logs (id, method, path, status_code, domain, timestamp, duration_ms, body_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      overrides?.id ?? `log-${logSeq}`,
      overrides?.method ?? "GET",
      overrides?.path ?? `/api/test-${logSeq}`,
      overrides?.status_code ?? 200,
      overrides?.domain ?? "api.example.com",
      overrides?.timestamp ?? new Date(Date.now() - logSeq * 1000).toISOString(),
      overrides?.duration_ms ?? Math.floor(Math.random() * 500),
      overrides?.body_size ?? Math.floor(Math.random() * 10000),
    );
  };

  const seedLogs = (count: number, defaults?: Partial<{
    method: string;
    domain: string;
    status_code: number;
  }>) => {
    for (let i = 0; i < count; i++) {
      seedLog(defaults);
    }
  };

  const request = async (path: string, init?: RequestInit) => {
    return app.request(path, init);
  };

  return { app, sqlite, d1, request, seedLog, seedLogs };
}
