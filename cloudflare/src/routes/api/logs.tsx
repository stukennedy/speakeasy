import type { Context } from "hono";
import type { ActiveTag, Env } from "@/types";
import { queryLogs } from "@/lib/facets";
import { LogTable } from "@/components/LogTable";

function parseTags(s: string): ActiveTag[] {
  if (!s) return [];
  return s.split("|").map((t) => {
    const i = t.indexOf(":");
    return i < 0 ? null : { facet: t.slice(0, i), value: t.slice(i + 1) };
  }).filter(Boolean) as ActiveTag[];
}

export const onRequestGet = async (c: Context<{ Bindings: Env }>) => {
  const tags = parseTags(c.req.query("tags") || "");
  const { logs, total } = await queryLogs(c.env.DB, tags);
  return c.html(<LogTable logs={logs as any} total={total} />);
};
