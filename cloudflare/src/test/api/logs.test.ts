import { describe, it, expect, beforeEach } from "bun:test";
import { createTestContext, type TestContext } from "../helpers";

describe("GET /api/logs", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  it("returns empty table when no logs", async () => {
    const res = await ctx.request("/api/logs");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("0 result");
  });

  it("returns logs as HTML table rows", async () => {
    ctx.seedLog({ method: "POST", path: "/users", status_code: 201, domain: "api.test.com" });
    ctx.seedLog({ method: "GET", path: "/health", status_code: 200, domain: "api.test.com" });

    const res = await ctx.request("/api/logs");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("POST");
    expect(html).toContain("/users");
    expect(html).toContain("201");
    expect(html).toContain("2 result");
  });

  it("filters by single tag", async () => {
    ctx.seedLog({ method: "GET", path: "/a" });
    ctx.seedLog({ method: "POST", path: "/b" });
    ctx.seedLog({ method: "POST", path: "/c" });

    const res = await ctx.request("/api/logs?tags=method:POST");
    const html = await res.text();
    expect(html).toContain("2 result");
    expect(html).not.toContain("/a"); // GET was filtered out
  });

  it("filters by multiple tags (AND logic)", async () => {
    ctx.seedLog({ method: "GET", domain: "a.com", status_code: 200 });
    ctx.seedLog({ method: "GET", domain: "b.com", status_code: 200 });
    ctx.seedLog({ method: "POST", domain: "a.com", status_code: 500 });

    const res = await ctx.request("/api/logs?tags=method:GET|domain:a.com");
    const html = await res.text();
    expect(html).toContain("1 result");
  });

  it("filters by status code", async () => {
    ctx.seedLog({ status_code: 200 });
    ctx.seedLog({ status_code: 404 });
    ctx.seedLog({ status_code: 500 });

    const res = await ctx.request("/api/logs?tags=status:404");
    const html = await res.text();
    expect(html).toContain("1 result");
  });

  it("filters by domain", async () => {
    ctx.seedLog({ domain: "alpha.com" });
    ctx.seedLog({ domain: "beta.com" });
    ctx.seedLog({ domain: "alpha.com" });

    const res = await ctx.request("/api/logs?tags=domain:alpha.com");
    const html = await res.text();
    expect(html).toContain("2 result");
  });

  it("filters by path", async () => {
    ctx.seedLog({ path: "/api/users" });
    ctx.seedLog({ path: "/api/health" });

    const res = await ctx.request("/api/logs?tags=path:/api/users");
    const html = await res.text();
    expect(html).toContain("1 result");
  });

  it("returns all logs with empty tags param", async () => {
    ctx.seedLogs(5);
    const res = await ctx.request("/api/logs?tags=");
    const html = await res.text();
    expect(html).toContain("5 result");
  });

  it("ignores unknown facet in tags", async () => {
    ctx.seedLogs(3);
    const res = await ctx.request("/api/logs?tags=unknown:value");
    const html = await res.text();
    expect(html).toContain("3 result");
  });

  it("contains table headers", async () => {
    const res = await ctx.request("/api/logs");
    const html = await res.text();
    expect(html).toContain("Method");
    expect(html).toContain("Status");
    expect(html).toContain("Domain");
    expect(html).toContain("Path");
    expect(html).toContain("Duration");
    expect(html).toContain("Time");
  });

  it("renders method badge colours", async () => {
    ctx.seedLog({ method: "GET" });
    ctx.seedLog({ method: "POST" });
    ctx.seedLog({ method: "DELETE" });

    const res = await ctx.request("/api/logs");
    const html = await res.text();
    // GET = emerald, POST = blue, DELETE = red
    expect(html).toContain("emerald");
    expect(html).toContain("blue");
    expect(html).toContain("red");
  });

  it("shows 'No logs match' for empty filtered result", async () => {
    ctx.seedLog({ method: "GET" });

    const res = await ctx.request("/api/logs?tags=method:DELETE");
    const html = await res.text();
    expect(html).toContain("No logs match");
  });
});
