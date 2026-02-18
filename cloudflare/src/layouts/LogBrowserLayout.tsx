import { jsxRenderer } from "hono/jsx-renderer";
import { ViteClient, Link, Script } from "vite-ssr-components/hono";

export const LogBrowserLayout = jsxRenderer(({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Log Browser — Speakeasy</title>
        <ViteClient />
        <Link href="/src/tailwind.css" rel="stylesheet" />
        <script src="/js/htmx.js"></script>
        <script src="/js/hx-ws.js"></script>
      </head>
      <body class="min-h-screen" hx-ext="ws">
        {children}
        <Script src="/src/client/main.ts" />
      </body>
    </html>
  );
});
