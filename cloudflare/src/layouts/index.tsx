import type { Hono, Env } from "hono";
import { LogBrowserLayout } from "./LogBrowserLayout";

export const loadLayouts = <T extends Env>(app: Hono<T>) => {
  app.use("/*", LogBrowserLayout);
};
