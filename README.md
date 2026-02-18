# Speakeasy Log Browser

A DataDog-style log browser with faceted search, built two ways — same UI, different architectures.

![Log Browser](https://img.shields.io/badge/HTMX_4-alpha-violet) ![Datastar](https://img.shields.io/badge/Datastar-SSE-blue) ![Cloudflare](https://img.shields.io/badge/Cloudflare_Workers-D1-orange)

## Two Implementations

### `cloudflare/` — HTMX 4 + WebSockets + Cloudflare Workers

- **Stack:** Hono SSR, HTMX 4 alpha, hx-ws WebSocket extension, Tailwind v4, Cloudflare Workers, D1, Durable Objects
- **Transport:** WebSocket — all interactions (search, filter, tag management) flow through a single persistent connection
- **Database:** D1 (SQLite at the edge)
- **Architecture:** `SearchSession` Durable Object manages per-user WS connection → queries D1 → pushes HTML partials via WS envelope `{channel, format, target, swap, payload}`
- **Fallback:** HTTP endpoints for graceful degradation before WS connects

```bash
cd cloudflare
bun install
bun run db:migrate
bun run db:seed
bun run dev
# → http://localhost:8787
```

### `irgo/` — Datastar + Go + Templ (IRGO framework)

- **Stack:** Go, Datastar (SSE-based reactivity), Templ (type-safe compiled templates), Tailwind v4
- **Transport:** SSE (Server-Sent Events) — Datastar's native transport
- **Database:** In-memory (Go slice)
- **Architecture:** Go handlers return HTML fragments via SSE. Templ compiles templates to Go code. Zero JavaScript framework.
- **Cross-platform:** Runs as web server, desktop app (webview), iOS, or Android via IRGO

```bash
cd irgo
bun install
irgo dev
# → http://localhost:8080

# Or run as desktop app:
irgo run desktop --dev
```

## Features (both versions)

- **Faceted search input** — type a facet name (`method`, `status`, `domain`, `path`) to autocomplete, type `:` to see unique values
- **Keyboard navigation** — ↑↓ arrow keys to navigate dropdown, Enter to select, Escape to close, Backspace on empty input removes last tag
- **Mouse support** — click facets, click values, click ✕ to remove tags
- **Tag pills** — active filters shown as removable violet pills
- **Colored method badges** — GET (green), POST (blue), PUT (amber), PATCH (orange), DELETE (red)
- **Status code coloring** — 2xx green, 3xx blue, 4xx amber, 5xx red
- **Dark theme** — DataDog-inspired dark UI

## Architecture Comparison

| | Cloudflare (HTMX 4) | IRGO (Datastar) |
|---|---|---|
| Language | TypeScript | Go |
| Templates | HTML strings (server-side) | Templ (compiled, type-safe) |
| Transport | WebSocket (persistent) | SSE (per-request) |
| Reactivity | htmx swaps + hx-ws extension | Datastar signals + SSE patches |
| State | Durable Object (persisted) | In-memory |
| Database | D1 (SQLite, edge) | In-memory slice |
| Deploy target | Cloudflare Workers | Anywhere (binary) |
| Client framework | None (htmx) | None (Datastar) |
| JS on page | ~60 lines (keyboard nav + tag state) | ~80 lines (keyboard nav + tag state) |

## Data

Both versions use the same 20 sample HTTP log entries with fields: `method`, `path`, `status_code`, `domain`, `timestamp`, `duration_ms`.

## Note on AI Usage

AI tooling (Claude) was used to assist with scaffolding and implementation. The HTMX 4 WebSocket extension (`hx-ws.js`) is original work — a core contribution to the HTMX 4 project.

## License

MIT
