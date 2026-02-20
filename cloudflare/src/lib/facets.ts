import { drizzle } from "drizzle-orm/d1";
import { asc, desc, count, sql, and, or } from "drizzle-orm";
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
 * Detect paths with common structure differing in one segment and return wildcard patterns.
 */
export function computePathWildcards(paths: string[]): string[] {
  // Group paths by segment count
  const byLength = new Map<number, string[][]>();
  for (const p of paths) {
    const segs = p.split("/");
    const group = byLength.get(segs.length) ?? [];
    group.push(segs);
    byLength.set(segs.length, group);
  }

  const wildcards = new Set<string>();

  for (const [segCount, segArrays] of byLength) {
    // For each segment position (skip 0 which is always ""), replace with * and group
    for (let pos = 1; pos < segCount; pos++) {
      const byTemplate = new Map<string, Set<string>>();
      for (const segs of segArrays) {
        const template = segs.map((s, i) => (i === pos ? "*" : s)).join("/");
        const original = segs.join("/");
        const group = byTemplate.get(template) ?? new Set();
        group.add(original);
        byTemplate.set(template, group);
      }
      // Any template matching 2+ distinct paths is a valid wildcard
      for (const [template, originals] of byTemplate) {
        if (originals.size >= 2) wildcards.add(template);
      }
    }
  }

  return Array.from(wildcards).sort();
}

/**
 * Convert a single ActiveTag to a Drizzle SQL condition.
 * Supports status wildcards (2xx, 3xx, 4xx, 5xx, 4xx+5xx) and path wildcards with *.
 */
export function tagToCondition(tag: ActiveTag) {
  const f = FACETS.find((x) => x.name === tag.facet);
  if (!f) return null;

  if (tag.facet === "status") {
    // Combined error wildcard: 4xx+5xx
    if (tag.value === "4xx+5xx") {
      return sql`${httpLogs.status_code} >= 400`;
    }
    // Standard range wildcard: 2xx / 3xx / 4xx / 5xx
    if (/^\dxx$/i.test(tag.value)) {
      const lo = parseInt(tag.value[0]) * 100;
      const hi = lo + 100;
      return sql`${httpLogs.status_code} >= ${lo} AND ${httpLogs.status_code} < ${hi}`;
    }
  }

  if (tag.facet === "path" && tag.value.includes("*")) {
    const likePattern = tag.value.replace(/\*/g, "%");
    const slashCount = (tag.value.match(/\//g) || []).length;
    return sql`${httpLogs.path} LIKE ${likePattern} AND (length(${httpLogs.path}) - length(replace(${httpLogs.path}, '/', ''))) = ${slashCount}`;
  }

  return sql`CAST(${f.col} AS TEXT) = ${tag.value}`;
}

/**
 * Build WHERE conditions from active tags.
 * Same-facet tags are OR'd together; different facets are AND'd.
 * e.g. [status:4xx, status:5xx, domain:github.com]
 *   → (status >= 400 AND status < 500 OR status >= 500) AND domain = 'github.com'
 */
export function buildTagConditions(activeTags: ActiveTag[]) {
  // Group tags by facet
  const byFacet = new Map<string, ActiveTag[]>();
  for (const tag of activeTags) {
    const group = byFacet.get(tag.facet) ?? [];
    byFacet.set(tag.facet, [...group, tag]);
  }

  return Array.from(byFacet.values()).flatMap((tags) => {
    const conds = tags.map(tagToCondition).filter((c): c is NonNullable<typeof c> => c !== null);
    if (conds.length === 0) return [];
    // Single condition for this facet — no OR wrapper needed
    if (conds.length === 1) return [conds[0]];
    // Multiple values for same facet → OR
    return [or(...conds)!];
  });
}

/**
 * Get unique values for a facet, optionally filtered by prefix.
 * Respects active tags.
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

  const conditions = buildTagConditions(activeTags);

  if (prefix) {
    // Status codes: prefix match (typing "4" → 4xx only, not 204/304)
    const likePattern = facet === "status" ? prefix + "%" : "%" + prefix + "%";
    conditions.push(sql`CAST(${col} AS TEXT) LIKE ${likePattern}`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .selectDistinct({ val: sql<string>`CAST(${col} AS TEXT)` })
    .from(httpLogs)
    .where(where)
    .orderBy(asc(sql`CAST(${col} AS TEXT)`))
    .limit(50);

  const dbValues = result.map((r) => r.val);

  // Inject wildcard options for status facet
  if (facet === "status") {
    const allWildcards = ["4xx+5xx", "2xx", "3xx", "4xx", "5xx"];
    const wildcards = prefix
      ? allWildcards.filter((w) => w[0] === prefix[0])
      : allWildcards;
    return [...wildcards, ...dbValues];
  }

  // Inject wildcard options for path facet
  if (facet === "path") {
    const allWildcards = computePathWildcards(dbValues);
    const wildcards = prefix
      ? allWildcards.filter((w) => w.includes(prefix))
      : allWildcards;
    return [...wildcards, ...dbValues];
  }

  return dbValues;
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

  const conditions = buildTagConditions(activeTags);
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
