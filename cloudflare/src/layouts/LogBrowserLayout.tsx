import { jsxRenderer } from "hono/jsx-renderer";
import { ViteClient, Link, Script } from "vite-ssr-components/hono";

export const LogBrowserLayout = jsxRenderer(({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Log Browser — Speakeasy</title>
        <meta name="description" content="Browse and filter HTTP request logs with faceted search. Filter by method, status code, domain, and path in real time." />
        <ViteClient />
        <Link href="/src/tailwind.css" rel="stylesheet" />
      </head>
      <body class="min-h-screen bg-gray-950" hx-ext="ws">
        {children}
        <script src="/js/htmx.js" defer></script>
        <script src="/js/hx-ws.js" defer></script>
        <Script src="/src/client/main.ts" />
      </body>
    </html>
  );
});
