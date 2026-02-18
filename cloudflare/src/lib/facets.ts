import type { ActiveTag, Env } from "../types";

export const FACETS = [
  { name: "method", field: "method" },
  { name: "status", field: "status_code" },
  { name: "domain", field: "domain" },
  { name: "path", field: "path" },
] as const;

export const FACET_NAMES = FACETS.map((f) => f.name);

export function facetToField(facet: string): string | null {
  const f = FACETS.find((x) => x.name === facet);
  return f ? f.field : null;
}

/**
 * Get unique values for a facet, optionally filtered by prefix.
 * Respects active tags (filters the dataset first).
 */
export async function getUniqueValues(
  db: D1Database,
  facet: string,
  prefix: string,
  activeTags: ActiveTag[]
): Promise<string[]> {
  const field = facetToField(facet);
  if (!field) return [];

  let sql = `SELECT DISTINCT CAST(${field} AS TEXT) as val FROM http_logs`;
  const params: string[] = [];
  const wheres: string[] = [];

  // Apply active tag filters
  for (const tag of activeTags) {
    const tagField = facetToField(tag.facet);
    if (tagField) {
      wheres.push(`CAST(${tagField} AS TEXT) = ?`);
      params.push(tag.value);
    }
  }

  // Apply prefix filter
  if (prefix) {
    wheres.push(`CAST(${field} AS TEXT) LIKE ?`);
    params.push(`%${prefix}%`);
  }

  if (wheres.length > 0) {
    sql += ` WHERE ${wheres.join(" AND ")}`;
  }

  sql += ` ORDER BY val ASC LIMIT 50`;

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<{ val: string }>();

  return result.results.map((r) => r.val);
}

/**
 * Query logs with active tag filters
 */
export async function queryLogs(
  db: D1Database,
  activeTags: ActiveTag[],
  limit = 100,
  offset = 0
): Promise<{ logs: any[]; total: number }> {
  const wheres: string[] = [];
  const params: string[] = [];

  for (const tag of activeTags) {
    const field = facetToField(tag.facet);
    if (field) {
      wheres.push(`CAST(${field} AS TEXT) = ?`);
      params.push(tag.value);
    }
  }

  const whereClause =
    wheres.length > 0 ? ` WHERE ${wheres.join(" AND ")}` : "";

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM http_logs${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();

  const total = countResult?.count ?? 0;

  const logsResult = await db
    .prepare(
      `SELECT * FROM http_logs${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all();

  return { logs: logsResult.results, total };
}
