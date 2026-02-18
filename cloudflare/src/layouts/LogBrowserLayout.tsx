import { jsxRenderer } from "hono/jsx-renderer";
import { ViteClient, Link, Script } from "vite-ssr-components/hono";

export const LogBrowserLayout = jsxRenderer(({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Log Browser — Speakeasy</title>
        <meta
          name="description"
          content="Browse and filter HTTP request logs with faceted search. Filter by method, status code, domain, and path in real time."
        />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <ViteClient />
        <Link href="/src/tailwind.css" rel="stylesheet" />
      </head>
      <body class="min-h-screen" hx-ext="ws">
        {children}
        <script src="/js/htmx.js" defer></script>
        <script src="/js/hx-ws.js" defer></script>
        <Script src="/src/client/main.ts" />
      </body>
    </html>
  );
});
