import type { Context } from "hono";
import type { Env } from "@/types";

export const onRequestGet = async (c: Context<{ Bindings: Env }>) => {
  if (c.req.header("Upgrade") !== "websocket") {
    return c.text("Expected WebSocket", 426);
  }
  const id = c.env.SEARCH_SESSION.idFromName(
    c.req.header("CF-Connecting-IP") || "anonymous"
  );
  const stub = c.env.SEARCH_SESSION.get(id);
  return stub.fetch(
    new Request(new URL("/ws", c.req.url).href, { headers: c.req.raw.headers })
  );
};
