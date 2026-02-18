/**
 * Generates a large seed SQL file with realistic HTTP log data.
 * Usage: bun scripts/generate-seed.ts > seed.sql
 */

const DOMAINS = [
  "api.speakeasy.com",
  "api.example.com",
  "cdn.example.com",
  "auth.example.com",
  "api.acme.com",
  "gateway.acme.com",
  "api.google.com",
  "api.stripe.com",
  "hooks.slack.com",
  "api.github.com",
];

const PATHS = [
  "/",
  "/health",
  "/metrics",
  "/api/v1/users",
  "/api/v1/users/:id",
  "/api/v1/users/:id/sessions",
  "/api/v1/organizations",
  "/api/v1/organizations/:id",
  "/api/v1/organizations/:id/members",
  "/api/v1/sdks",
  "/api/v1/sdks/:id",
  "/api/v1/sdks/:id/generate",
  "/api/v1/apis",
  "/api/v1/apis/:id",
  "/api/v1/apis/:id/versions",
  "/api/v1/workspaces",
  "/api/v1/workspaces/:id",
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/refresh",
  "/api/v1/auth/me",
  "/api/v1/tokens",
  "/api/v1/tokens/:id",
  "/api/v1/events",
  "/api/v1/webhooks",
  "/api/v1/webhooks/:id",
  "/api/v2/users",
  "/api/v2/orgs",
  "/api/v2/orgs/:id/billing",
  "/api/v2/reports",
  "/api/v2/reports/:id",
  "/search",
  "/api/v1/products",
  "/api/v1/products/:id",
  "/api/v1/orders",
  "/api/v1/orders/:id",
  "/api/v1/payments",
  "/api/v1/subscriptions",
  "/api/v1/subscriptions/:id",
  "/api/v1/invoices",
];

const METHODS = ["GET", "GET", "GET", "GET", "POST", "PUT", "PATCH", "DELETE"];

// Weighted status codes — mostly 2xx, some errors
const STATUS_WEIGHTS: Array<[number, number]> = [
  [200, 50],
  [201, 12],
  [204, 6],
  [400, 8],
  [401, 5],
  [403, 4],
  [404, 8],
  [422, 3],
  [429, 2],
  [500, 4],
  [502, 1],
  [503, 1],
];

const STATUS_POOL: number[] = [];
for (const [code, weight] of STATUS_WEIGHTS) {
  for (let i = 0; i < weight; i++) STATUS_POOL.push(code);
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function durationFor(status: number, method: string): number {
  const base =
    status >= 500 ? randInt(200, 2000) :
    status === 429 ? randInt(5, 20) :
    method === "POST" || method === "PUT" ? randInt(30, 300) :
    method === "DELETE" ? randInt(20, 150) :
    randInt(5, 200);
  // Add occasional slow outlier
  return Math.random() < 0.02 ? base * randInt(5, 20) : base;
}

function bodySizeFor(status: number, method: string): number {
  if (status === 204 || status === 304) return 0;
  if (status >= 400) return randInt(50, 512);
  if (method === "GET") return randInt(128, 32768);
  if (method === "POST" || method === "PUT") return randInt(256, 8192);
  return randInt(0, 1024);
}

function resolvedPath(template: string): string {
  return template.replace(/:id/g, () => String(randInt(1, 9999)));
}

// Spread 50k logs over the last 30 days
const NOW = Date.now();
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const COUNT = 50_000;
const BATCH = 500;

console.log("-- Generated seed: " + COUNT + " HTTP log entries");
console.log("DELETE FROM http_logs;");
console.log();

let id = 1;
for (let batch = 0; batch < COUNT / BATCH; batch++) {
  const rows: string[] = [];
  for (let i = 0; i < BATCH; i++) {
    const method = rand(METHODS);
    const status = rand(STATUS_POOL);
    const domain = rand(DOMAINS);
    const path = resolvedPath(rand(PATHS));
    const duration = durationFor(status, method);
    const bodySize = bodySizeFor(status, method);
    // Cluster timestamps: more traffic during business hours, Mon–Fri
    const ageMs = Math.pow(Math.random(), 1.5) * THIRTY_DAYS_MS;
    const ts = new Date(NOW - ageMs).toISOString();
    rows.push(`('${id++}','${method}','${path}',${status},'${domain}','${ts}',${duration},${bodySize})`);
  }
  console.log(
    `INSERT INTO http_logs (id,method,path,status_code,domain,timestamp,duration_ms,body_size) VALUES\n` +
    rows.join(",\n") + ";"
  );
  console.log();
}
