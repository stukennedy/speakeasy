import type { MiddlewareHandler } from "hono";
import type { Env } from "@/types";

// File extensions that should never be converted
const STATIC_EXT = /\.(js|mjs|ts|css|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|otf|map|json|xml|txt)$/i;

export const markdownMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  // Only act when client explicitly requests Markdown
  const accept = c.req.header("Accept") ?? "";
  if (!accept.includes("text/markdown")) {
    return next();
  }

  // Skip static assets and WebSocket upgrade requests
  const path = new URL(c.req.url).pathname;
  if (STATIC_EXT.test(path) || c.req.header("Upgrade") === "websocket") {
    return next();
  }

  await next();

  // Only convert HTML responses
  const contentType = c.res.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/html")) {
    return;
  }

  const ai = (c.env as any).AI;
  if (!ai) return;

  const html = await c.res.text();

  const [result] = await ai.toMarkdown([
    {
      name: "page.html",
      blob: new Blob([html], { type: "text/html" }),
    },
  ]);

  c.res = new Response(result.data, {
    status: c.res.status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
};
