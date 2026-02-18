import { Hono } from "hono";
import type { Env } from "./types";
import { loadLayouts } from "./layouts";
import { loadRoutes } from "./router";
import { markdownMiddleware } from "./middleware/markdown";

// Re-export Durable Object
export { SearchSession } from "./lib/search-session";

const app = new Hono<{ Bindings: Env }>();

loadLayouts(app);
app.use("*", markdownMiddleware);
loadRoutes(app);

export default app;
