import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import path from "path";
import { facetToField, getUniqueValues, queryLogs, computePathWildcards, FACET_NAMES, FACETS } from "@/lib/facets";

// Reuse the D1 shim for unit testing the lib directly
function createD1(sqlite: Database): D1Database {
  return {
    prepare(query: string) {
      return {
        _query: query,
        _bindings: [] as any[],
        bind(...args: any[]) { this._bindings = args; return this; },
        async all<T = any>() {
          return { results: sqlite.prepare(this._query).all(...this._bindings) as T[], success: true, meta: {} };
        },
        async first<T = any>(col?: string) {
          const row = sqlite.prepare(this._query).get(...this._bindings) as any;
          if (col && row) return row[col] as T;
          return (row ?? null) as T;
        },
        async run() {
          const info = sqlite.prepare(this._query).run(...this._bindings);
          return { results: [], success: true, meta: { changes: info.changes } };
        },
        async raw<T = any>() {
          return sqlite.prepare(this._query).all(...this._bindings).map((r: any) => Object.values(r)) as T[];
        },
      } as any;
    },
    async dump() { return new ArrayBuffer(0); },
    async batch(s: any[]) { return Promise.all(s.map((x: any) => x.all())); },
    async exec(q: string) { sqlite.exec(q); return { count: 0, duration: 0 }; },
  } as any;
}

describe("facetToField", () => {
  it("maps known facets to DB fields", () => {
    expect(facetToField("method")).toBe("method");
    expect(facetToField("status")).toBe("status_code");
    expect(facetToField("domain")).toBe("domain");
    expect(facetToField("path")).toBe("path");
  });

  it("returns null for unknown facets", () => {
    expect(facetToField("unknown")).toBeNull();
    expect(facetToField("")).toBeNull();
  });
});

describe("FACETS", () => {
  it("has 4 facets defined", () => {
    expect(FACETS.length).toBe(4);
  });

  it("FACET_NAMES matches FACETS", () => {
    expect(FACET_NAMES).toEqual(FACETS.map(f => f.name));
  });
});

describe("getUniqueValues", () => {
  let db: D1Database;
  let sqlite: Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    const migration = readFileSync(
      path.resolve(import.meta.dir, "../../../migrations/0001_init.sql"), "utf-8"
    );
    sqlite.exec(migration);
    db = createD1(sqlite);
  });

  it("returns unique methods", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/a', 200, 'x.com'),
      ('2', 'POST', '/b', 200, 'x.com'),
      ('3', 'GET', '/c', 200, 'x.com')
    `);

    const values = await getUniqueValues(db, "method", "", []);
    expect(values).toEqual(["GET", "POST"]);
  });

  it("filters by prefix", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/a', 200, 'x.com'),
      ('2', 'POST', '/b', 200, 'x.com'),
      ('3', 'PUT', '/c', 200, 'x.com')
    `);

    const values = await getUniqueValues(db, "method", "P", []);
    expect(values).toEqual(["POST", "PUT"]);
  });

  it("respects active tags", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/a', 200, 'a.com'),
      ('2', 'POST', '/b', 200, 'a.com'),
      ('3', 'GET', '/c', 200, 'b.com'),
      ('4', 'DELETE', '/d', 200, 'b.com')
    `);

    const values = await getUniqueValues(db, "method", "", [{ facet: "domain", value: "a.com" }]);
    expect(values).toEqual(["GET", "POST"]);
  });

  it("returns empty for unknown facet", async () => {
    const values = await getUniqueValues(db, "bogus", "", []);
    expect(values).toEqual([]);
  });

  it("limits results to 50", async () => {
    const inserts = Array.from({ length: 60 }, (_, i) =>
      `('id${i}', 'M${i}', '/p', 200, 'x.com')`
    ).join(",");
    sqlite.exec(`INSERT INTO http_logs (id, method, path, status_code, domain) VALUES ${inserts}`);

    const values = await getUniqueValues(db, "method", "", []);
    expect(values.length).toBe(50);
  });
});

describe("queryLogs", () => {
  let db: D1Database;
  let sqlite: Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    const migration = readFileSync(
      path.resolve(import.meta.dir, "../../../migrations/0001_init.sql"), "utf-8"
    );
    sqlite.exec(migration);
    db = createD1(sqlite);
  });

  it("returns all logs with no filters", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/a', 200, 'x.com'),
      ('2', 'POST', '/b', 404, 'y.com')
    `);

    const { logs, total } = await queryLogs(db, []);
    expect(total).toBe(2);
    expect(logs.length).toBe(2);
  });

  it("filters by tags", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/a', 200, 'x.com'),
      ('2', 'POST', '/b', 200, 'x.com'),
      ('3', 'GET', '/c', 500, 'y.com')
    `);

    const { logs, total } = await queryLogs(db, [{ facet: "method", value: "GET" }]);
    expect(total).toBe(2);
    expect(logs.every((l: any) => l.method === "GET")).toBe(true);
  });

  it("filters by multiple tags (AND)", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/a', 200, 'x.com'),
      ('2', 'GET', '/b', 200, 'y.com'),
      ('3', 'POST', '/c', 200, 'x.com')
    `);

    const { total } = await queryLogs(db, [
      { facet: "method", value: "GET" },
      { facet: "domain", value: "x.com" },
    ]);
    expect(total).toBe(1);
  });

  it("returns correct total with limit", async () => {
    for (let i = 0; i < 10; i++) {
      sqlite.prepare(
        "INSERT INTO http_logs (id, method, path, status_code, domain) VALUES (?, 'GET', '/x', 200, 'x.com')"
      ).run(`id-${i}`);
    }

    const { logs, total } = await queryLogs(db, [], 3, 0);
    expect(total).toBe(10);
    expect(logs.length).toBe(3);
  });

  it("respects offset", async () => {
    for (let i = 0; i < 5; i++) {
      sqlite.prepare(
        "INSERT INTO http_logs (id, method, path, status_code, domain, timestamp) VALUES (?, 'GET', '/x', 200, 'x.com', ?)"
      ).run(`id-${i}`, new Date(Date.now() - i * 1000).toISOString());
    }

    const { logs } = await queryLogs(db, [], 2, 2);
    expect(logs.length).toBe(2);
  });

  it("orders by timestamp descending", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain, timestamp) VALUES
      ('old', 'GET', '/a', 200, 'x.com', '2025-01-01T00:00:00Z'),
      ('new', 'GET', '/b', 200, 'x.com', '2025-12-01T00:00:00Z')
    `);

    const { logs } = await queryLogs(db, []);
    expect((logs[0] as any).id).toBe("new");
    expect((logs[1] as any).id).toBe("old");
  });

  it("ignores unknown facet tags", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/a', 200, 'x.com')
    `);

    const { total } = await queryLogs(db, [{ facet: "bogus", value: "whatever" }]);
    expect(total).toBe(1);
  });

  it("filters by wildcard path tag with LIKE + depth check", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/api/v1/users', 200, 'x.com'),
      ('2', 'GET', '/api/v2/users', 200, 'x.com'),
      ('3', 'GET', '/api/v1/health', 200, 'x.com'),
      ('4', 'GET', '/other/path', 200, 'x.com')
    `);

    const { logs, total } = await queryLogs(db, [{ facet: "path", value: "/api/*/users" }]);
    expect(total).toBe(2);
    expect(logs.map((l: any) => l.path).sort()).toEqual(["/api/v1/users", "/api/v2/users"]);
  });

  it("wildcard path does not match deeper paths", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/api/v1/users', 200, 'x.com'),
      ('2', 'GET', '/api/v1/sub/users', 200, 'x.com')
    `);

    const { total } = await queryLogs(db, [{ facet: "path", value: "/api/*/users" }]);
    expect(total).toBe(1);
  });

  it("exact path tag still uses = match", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/api/v1/users', 200, 'x.com'),
      ('2', 'GET', '/api/v2/users', 200, 'x.com')
    `);

    const { total } = await queryLogs(db, [{ facet: "path", value: "/api/v1/users" }]);
    expect(total).toBe(1);
  });
});

describe("computePathWildcards", () => {
  it("returns wildcard patterns for paths differing in one segment", () => {
    const result = computePathWildcards([
      "/api/v1/users", "/api/v2/users", "/api/v1/health", "/api/v2/health",
    ]);
    expect(result).toEqual(["/api/*/health", "/api/*/users", "/api/v1/*", "/api/v2/*"]);
  });

  it("returns empty when all paths are unique structure", () => {
    const result = computePathWildcards(["/a/b/c", "/d/e/f"]);
    expect(result).toEqual([]);
  });

  it("returns empty for single-segment paths", () => {
    const result = computePathWildcards(["/foo", "/bar"]);
    // Both are ["", "foo"] and ["", "bar"] — position 1 wildcard = "/*" matches 2 paths
    expect(result).toEqual(["/*"]);
  });

  it("does not wildcard paths of different lengths", () => {
    const result = computePathWildcards(["/a/b", "/a/b/c"]);
    expect(result).toEqual([]);
  });

  it("handles empty input", () => {
    expect(computePathWildcards([])).toEqual([]);
  });

  it("handles duplicate paths", () => {
    const result = computePathWildcards(["/api/v1/users", "/api/v1/users"]);
    // Same path duplicated — only 1 distinct path per template, so no wildcards
    expect(result).toEqual([]);
  });
});

describe("getUniqueValues with path facet", () => {
  let db: D1Database;
  let sqlite: Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    const migration = readFileSync(
      path.resolve(import.meta.dir, "../../../migrations/0001_init.sql"), "utf-8"
    );
    sqlite.exec(migration);
    db = createD1(sqlite);
  });

  it("prepends wildcards before exact path values", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/api/v1/users', 200, 'x.com'),
      ('2', 'GET', '/api/v2/users', 200, 'x.com')
    `);

    const values = await getUniqueValues(db, "path", "", []);
    // Wildcards first, then exact values
    expect(values[0]).toBe("/api/*/users");
    expect(values).toContain("/api/v1/users");
    expect(values).toContain("/api/v2/users");
  });

  it("filters wildcards by prefix", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/api/v1/users', 200, 'x.com'),
      ('2', 'GET', '/api/v2/users', 200, 'x.com'),
      ('3', 'GET', '/api/v1/health', 200, 'x.com'),
      ('4', 'GET', '/api/v2/health', 200, 'x.com')
    `);

    const values = await getUniqueValues(db, "path", "/api/v1", []);
    // Only wildcards containing "/api/v1" should appear
    const wildcards = values.filter((v) => v.includes("*"));
    expect(wildcards).toEqual(["/api/v1/*"]);
  });

  it("returns no wildcards when paths are all unique", async () => {
    sqlite.exec(`
      INSERT INTO http_logs (id, method, path, status_code, domain) VALUES
      ('1', 'GET', '/a', 200, 'x.com'),
      ('2', 'GET', '/b/c', 200, 'x.com')
    `);

    const values = await getUniqueValues(db, "path", "", []);
    expect(values.every((v) => !v.includes("*"))).toBe(true);
  });
});
