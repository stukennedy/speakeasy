import { Hono } from "hono";
import type { Env } from "./types";
import { loadLayouts } from "./layouts";

// Re-export Durable Object
export { SearchSession } from "./lib/search-session";

const app = new Hono<{ Bindings: Env }>();

// Layout
loadLayouts(app);

// Routes (file-based style, manually wired)
import { onRequestGet as homeGet } from "./routes/index";
import { onRequestGet as wsGet } from "./routes/ws";
import { onRequestGet as suggestGet } from "./routes/api/suggest";
import { onRequestGet as logsGet } from "./routes/api/logs";

app.get("/", homeGet);
app.get("/ws", wsGet);
app.get("/api/suggest", suggestGet);
app.get("/api/logs", logsGet);

export default app;
