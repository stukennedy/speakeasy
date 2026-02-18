import { describe, it, expect, beforeEach } from "bun:test";
import { createTestContext, type TestContext } from "./helpers";

describe("GET /", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  it("returns the home page", async () => {
    const res = await ctx.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Log Browser");
    expect(html).toContain("hx-ws-connect");
  });

  it("includes the search bar", async () => {
    const res = await ctx.request("/");
    const html = await res.text();
    expect(html).toContain("log-table");
  });
});

describe("GET /ws", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  it("returns 426 without Upgrade header", async () => {
    const res = await ctx.request("/ws");
    expect(res.status).toBe(426);
    const text = await res.text();
    expect(text).toContain("Expected WebSocket");
  });

  it("forwards to Durable Object with Upgrade header", async () => {
    const res = await ctx.request("/ws", {
      headers: { Upgrade: "websocket" },
    });
    // Our mock DO returns 101
    expect(res.status).toBe(101);
  });
});
