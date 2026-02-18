import { describe, it, expect, beforeEach } from "bun:test";
import { createTestContext, type TestContext } from "../helpers";

describe("GET /api/suggest", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  it("returns facet list when no query", async () => {
    const res = await ctx.request("/api/suggest");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("method");
    expect(html).toContain("status");
    expect(html).toContain("domain");
    expect(html).toContain("path");
  });

  it("returns facet list for empty query", async () => {
    const res = await ctx.request("/api/suggest?query=");
    const html = await res.text();
    expect(html).toContain("method");
  });

  it("filters facets by partial match", async () => {
    const res = await ctx.request("/api/suggest?query=meth");
    const html = await res.text();
    expect(html).toContain("method");
    expect(html).not.toContain("domain");
  });

  it("returns no results for unknown facet prefix", async () => {
    const res = await ctx.request("/api/suggest?query=xyz");
    const html = await res.text();
    expect(html).toContain("No matching");
  });

  it("returns unique values for facet:prefix query", async () => {
    ctx.seedLog({ method: "GET" });
    ctx.seedLog({ method: "POST" });
    ctx.seedLog({ method: "PUT" });
    ctx.seedLog({ method: "GET" }); // duplicate

    const res = await ctx.request("/api/suggest?query=method:");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("GET");
    expect(html).toContain("POST");
    expect(html).toContain("PUT");
  });

  it("filters values by prefix", async () => {
    ctx.seedLog({ method: "GET" });
    ctx.seedLog({ method: "POST" });
    ctx.seedLog({ method: "PUT" });

    const res = await ctx.request("/api/suggest?query=method:P");
    const html = await res.text();
    expect(html).toContain("POST");
    expect(html).toContain("PUT");
    expect(html).not.toContain("GET");
  });

  it("returns status code values", async () => {
    ctx.seedLog({ status_code: 200 });
    ctx.seedLog({ status_code: 404 });
    ctx.seedLog({ status_code: 500 });

    const res = await ctx.request("/api/suggest?query=status:");
    const html = await res.text();
    expect(html).toContain("200");
    expect(html).toContain("404");
    expect(html).toContain("500");
  });

  it("filters status values by prefix", async () => {
    ctx.seedLog({ status_code: 200 });
    ctx.seedLog({ status_code: 201 });
    ctx.seedLog({ status_code: 404 });

    const res = await ctx.request("/api/suggest?query=status:20");
    const html = await res.text();
    expect(html).toContain("200");
    expect(html).toContain("201");
    expect(html).not.toContain("404");
  });

  it("returns domain values", async () => {
    ctx.seedLog({ domain: "api.example.com" });
    ctx.seedLog({ domain: "cdn.example.com" });

    const res = await ctx.request("/api/suggest?query=domain:");
    const html = await res.text();
    expect(html).toContain("api.example.com");
    expect(html).toContain("cdn.example.com");
  });

  it("returns error for unknown facet with colon", async () => {
    const res = await ctx.request("/api/suggest?query=bogus:value");
    const html = await res.text();
    expect(html).toContain("Unknown facet");
  });

  it("returns no matching values message", async () => {
    ctx.seedLog({ method: "GET" });

    const res = await ctx.request("/api/suggest?query=method:ZZZZZ");
    const html = await res.text();
    expect(html).toContain("No matching");
  });

  it("respects active tags when suggesting values", async () => {
    ctx.seedLog({ method: "GET", domain: "a.com" });
    ctx.seedLog({ method: "POST", domain: "a.com" });
    ctx.seedLog({ method: "GET", domain: "b.com" });

    // When filtering by domain:a.com, method suggestions should only show GET and POST
    const res = await ctx.request("/api/suggest?query=method:&tags=domain:a.com");
    const html = await res.text();
    expect(html).toContain("GET");
    expect(html).toContain("POST");
  });

  it("returns path values", async () => {
    ctx.seedLog({ path: "/api/users" });
    ctx.seedLog({ path: "/api/health" });
    ctx.seedLog({ path: "/api/users" }); // dupe

    const res = await ctx.request("/api/suggest?query=path:/api");
    const html = await res.text();
    expect(html).toContain("/api/users");
    expect(html).toContain("/api/health");
  });
});
