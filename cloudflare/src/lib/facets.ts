import { drizzle } from "drizzle-orm/d1";
import { asc, desc, count, sql, and } from "drizzle-orm";
import { httpLogs } from "@/db/schema";
import type { HttpLog } from "@/db/schema";
import type { ActiveTag } from "@/types";

export const FACETS = [
  { name: "method", field: "method", col: httpLogs.method },
  { name: "status", field: "status_code", col: httpLogs.status_code },
  { name: "domain", field: "domain", col: httpLogs.domain },
  { name: "path", field: "path", col: httpLogs.path },
];

export const FACET_NAMES = FACETS.map((f) => f.name);

export function facetToField(facet: string): string | null {
  const f = FACETS.find((x) => x.name === facet);
  return f ? f.field : null;
}

function facetToCol(facet: string) {
  const f = FACETS.find((x) => x.name === facet);
  return f ? f.col : null;
}

/**
 * Get unique values for a facet, optionally filtered by prefix.
 * Respects active tags (filters the dataset first).
 */
export async function getUniqueValues(
  d1: D1Database,
  facet: string,
  prefix: string,
  activeTags: ActiveTag[]
): Promise<string[]> {
  const col = facetToCol(facet);
  if (!col) return [];

  const db = drizzle(d1);

  const conditions = activeTags
    .map((tag) => {
      const tagCol = facetToCol(tag.facet);
      return tagCol ? sql`CAST(${tagCol} AS TEXT) = ${tag.value}` : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (prefix) {
    conditions.push(sql`CAST(${col} AS TEXT) LIKE ${"%" + prefix + "%"}`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .selectDistinct({ val: sql<string>`CAST(${col} AS TEXT)` })
    .from(httpLogs)
    .where(where)
    .orderBy(asc(sql`CAST(${col} AS TEXT)`))
    .limit(50);

  return result.map((r) => r.val);
}

/**
 * Query logs with active tag filters.
 */
export async function queryLogs(
  d1: D1Database,
  activeTags: ActiveTag[],
  limit = 100,
  offset = 0
): Promise<{ logs: HttpLog[]; total: number }> {
  const db = drizzle(d1);

  const conditions = activeTags
    .map((tag) => {
      const col = facetToCol(tag.facet);
      return col ? sql`CAST(${col} AS TEXT) = ${tag.value}` : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(httpLogs)
    .where(where);

  const logs = await db
    .select()
    .from(httpLogs)
    .where(where)
    .orderBy(desc(httpLogs.timestamp))
    .limit(limit)
    .offset(offset);

  return { logs, total };
}
