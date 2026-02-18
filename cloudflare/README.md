# Speakeasy Log Browser

A real-time HTTP access log browser built on Cloudflare Workers. Datadog-style faceted search with AI-powered analysis, running entirely on the Cloudflare stack.

## Stack

- **Runtime**: Cloudflare Workers
- **Framework**: [Hono](https://hono.dev/) with server-side JSX
- **UI**: [HTMX](https://htmx.org/) + WebSockets (Durable Objects)
- **Database**: Cloudflare D1 (SQLite) via [Drizzle ORM](https://orm.drizzle.team/)
- **AI**: Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct` + `toMarkdown`)
- **Styles**: Tailwind CSS v4
- **Build**: Vite + `@cloudflare/vite-plugin`

## Features

- **Faceted search** — filter by `method`, `status`, `domain`, `path` with tag pills
- **Same-facet OR / cross-facet AND** logic (e.g. `status:4xx + status:5xx` shows all errors; adding `domain:api.github.com` narrows to that domain)
- **Status wildcards** — `2xx`, `3xx`, `4xx`, `5xx`, `4xx+5xx` in the search dropdown
- **Live stats** — total requests, error count/rate, avg duration, status distribution bar, 14-day volume sparkline, method breakdown
- **AI assistant** — ask questions about your logs in plain English; automatically suggests and applies filters
- **Markdown API** — any HTML endpoint returns `text/markdown` when requested with `Accept: text/markdown`, powered by `env.AI.toMarkdown()`

## Schema

```sql
http_logs (
  id               TEXT PRIMARY KEY,
  method           TEXT NOT NULL,
  path             TEXT NOT NULL,
  status_code      INTEGER NOT NULL,
  domain           TEXT NOT NULL,
  timestamp        TEXT DEFAULT (datetime('now')),
  duration_ms      INTEGER,
  request_headers  TEXT,
  response_headers TEXT,
  body_size        INTEGER
)
```

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Set up the database

```bash
# Generate migrations from schema
bun run db:generate

# Apply migrations locally
bun run db:migrate

# Seed with sample data
bun run db:seed
```

### 3. Run locally

```bash
bun run dev
# → http://localhost:8788
```

### 4. Deploy

```bash
bun run deploy
```

For production, apply migrations to the remote D1 database first:

```bash
bun run db:migrate:remote
```

## Bindings (wrangler.jsonc)

| Binding          | Type             | Purpose                        |
|------------------|------------------|--------------------------------|
| `DB`             | D1 Database      | Log storage                    |
| `SEARCH_SESSION` | Durable Object   | Per-session WebSocket state    |
| `AI`             | Workers AI       | LLM analysis + Markdown export |

## API

| Method | Path           | Description                              |
|--------|----------------|------------------------------------------|
| `GET`  | `/`            | Log browser UI                           |
| `GET`  | `/ws`          | WebSocket endpoint (Durable Object)      |
| `GET`  | `/api/logs`    | Paginated log query (supports `?tags=`)  |
| `GET`  | `/api/suggest` | Facet autocomplete (supports `?q=&tags=`)|
| `POST` | `/api/ai`      | AI question answering                    |

### Tag filter format

Tags are passed as `facet:value` pairs joined by `|`:

```
?tags=status:4xx+5xx|domain:api.github.com
```

### Markdown API

Any HTML endpoint returns Markdown when called with `Accept: text/markdown`:

```bash
# Get all logs as a Markdown table
curl -H "Accept: text/markdown" http://localhost:8788/api/logs

# Filtered — 5xx errors from a specific domain
curl -H "Accept: text/markdown" \
  "http://localhost:8788/api/logs?tags=status:5xx|domain:api.github.com"
```

## Development

```bash
# Run tests
bun test

# Regenerate router from src/routes/ file structure
bun run routes
```
