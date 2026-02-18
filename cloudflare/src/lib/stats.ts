import { drizzle } from "drizzle-orm/d1";
import { asc, desc, count, sql, and } from "drizzle-orm";
import { httpLogs } from "@/db/schema";
import { tagToCondition, buildTagConditions } from "./facets";
import type { ActiveTag } from "@/types";

export interface StatsSummary {
  total: number;
  errorCount: number;
  errorRate: number;
  avgDuration: number;
}

export interface StatusGroup { group: string; count: number }
export interface DomainCount { domain: string; count: number }
export interface DayCount    { day: string;    count: number }
export interface MethodCount { method: string; count: number }

export interface Stats {
  summary:    StatsSummary;
  statusDist: StatusGroup[];
  topDomains: DomainCount[];
  volumeByDay: DayCount[];
  methodDist: MethodCount[];
}

// buildConditions is an alias for buildTagConditions (same-facet OR, cross-facet AND)
export { buildTagConditions as buildConditions };
// Local alias for internal use
const buildConditions = buildTagConditions;

export async function queryAiContext(
  d1: D1Database,
  activeTags: ActiveTag[],
  question: string,
): Promise<string> {
  const db = drizzle(d1);
  const baseConditions = buildConditions(activeTags);

  // Detect time window from question text
  const q = question.toLowerCase();
  const timeCondition =
    q.includes("24 hour") || q.includes("today") || q.includes("tonight")
      ? sql`timestamp > datetime('now', '-24 hours')`
      : q.includes("week") || q.includes("7 day")
      ? sql`timestamp > datetime('now', '-7 days')`
      : q.includes("hour")
      ? sql`timestamp > datetime('now', '-1 hour')`
      : null;

  const timeLabel = timeCondition
    ? q.includes("24 hour") || q.includes("today") ? "last 24 hours"
      : q.includes("week") || q.includes("7 day") ? "last 7 days"
      : "last 1 hour"
    : "all time";

  const allConditions = timeCondition
    ? [...baseConditions, timeCondition]
    : [...baseConditions];

  const where = allConditions.length > 0 ? and(...allConditions) : undefined;

  // Run queries in parallel
  const [
    [summary],
    domainBreakdown,
    errorStatuses,
    distinctMethods,
    distinctStatuses,
  ] = await Promise.all([
    db.select({
      total: count(),
      errors:    sql<number>`COUNT(CASE WHEN status_code >= 400 THEN 1 END)`,
      errors5xx: sql<number>`COUNT(CASE WHEN status_code >= 500 THEN 1 END)`,
      errors4xx: sql<number>`COUNT(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 END)`,
      avgDuration: sql<number>`CAST(COALESCE(AVG(duration_ms), 0) AS INTEGER)`,
    }).from(httpLogs).where(where),

    db.select({
      domain: httpLogs.domain,
      total:  count(),
      errors: sql<number>`COUNT(CASE WHEN status_code >= 400 THEN 1 END)`,
    })
      .from(httpLogs).where(where)
      .groupBy(httpLogs.domain)
      .orderBy(desc(sql`COUNT(CASE WHEN status_code >= 400 THEN 1 END)`))
      .limit(10),

    db.select({
      status: httpLogs.status_code,
      cnt: sql<number>`count(*)`,
    })
      .from(httpLogs)
      .where(where
        ? and(where, sql`${httpLogs.status_code} >= 400`)
        : sql`${httpLogs.status_code} >= 400`
      )
      .groupBy(httpLogs.status_code)
      .orderBy(sql`count(*) desc`)
      .limit(10),

    db.selectDistinct({ val: httpLogs.method })
      .from(httpLogs).where(where)
      .orderBy(asc(httpLogs.method)),

    db.selectDistinct({ val: httpLogs.status_code })
      .from(httpLogs).where(where)
      .orderBy(asc(httpLogs.status_code))
      .limit(40),
  ]);

  const filterLabel = activeTags.length > 0
    ? activeTags.map((t) => `${t.facet}:${t.value}`).join(", ")
    : "none";

  const errPct = summary.total > 0
    ? ((Number(summary.errors) / summary.total) * 100).toFixed(1)
    : "0.0";

  const lines = [
    `DATA CONTEXT — scope: ${timeLabel} | active filters: ${filterLabel}`,
    `─────────────────────────────────────────────`,
    `Total requests: ${summary.total.toLocaleString()}`,
    `Errors (4xx+5xx): ${Number(summary.errors).toLocaleString()} (${errPct}%)`,
    `  • 4xx client errors: ${Number(summary.errors4xx).toLocaleString()}`,
    `  • 5xx server errors: ${Number(summary.errors5xx).toLocaleString()}`,
    `Avg response time: ${summary.avgDuration}ms`,
    ``,
    `All domains — requests & errors (${timeLabel}):`,
    ...domainBreakdown.map((d) => {
      const dp = d.total > 0 ? ((Number(d.errors) / d.total) * 100).toFixed(1) : "0.0";
      return `  ${d.domain}: ${Number(d.errors)} errors / ${d.total} total (${dp}% error rate)`;
    }),
  ];

  if (errorStatuses.length > 0) {
    lines.push(``, `Error status code breakdown (${timeLabel}):`);
    errorStatuses.forEach((s) => lines.push(`  HTTP ${s.status}: ${s.cnt} occurrences`));
  }

  // Valid filter values — give the LLM exact values to use in FILTERS line
  const validMethods = distinctMethods.map((m) => m.val).join(", ");
  const validDomains = domainBreakdown.map((d) => d.domain).join(", ");
  const validStatuses = distinctStatuses.map((s) => s.val).join(", ");

  lines.push(
    ``,
    `VALID FILTER VALUES (use these EXACTLY in FILTERS line):`,
    `  method: ${validMethods}`,
    `  domain: ${validDomains}`,
    `  status: ${validStatuses}`,
    `  status wildcards: 2xx, 3xx, 4xx, 5xx, 4xx+5xx (all errors)`,
  );

  return lines.join("\n");
}

export async function queryStats(d1: D1Database, activeTags: ActiveTag[]): Promise<Stats> {
  const db = drizzle(d1);
  const conditions = buildConditions(activeTags);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [row] = await db.select({
    total:       count(),
    errorCount:  sql<number>`COUNT(CASE WHEN status_code >= 400 THEN 1 ELSE NULL END)`,
    avgDuration: sql<number>`CAST(COALESCE(AVG(duration_ms), 0) AS INTEGER)`,
  }).from(httpLogs).where(where);

  const total      = row.total || 1;
  const errorCount = Number(row.errorCount) || 0;

  const statusDist = await db.select({
    group: sql<string>`CASE
      WHEN status_code < 300 THEN '2xx'
      WHEN status_code < 400 THEN '3xx'
      WHEN status_code < 500 THEN '4xx'
      ELSE '5xx' END`,
    count: count(),
  })
    .from(httpLogs).where(where)
    .groupBy(sql`1`).orderBy(sql`1`);

  const topDomains = await db.select({ domain: httpLogs.domain, count: count() })
    .from(httpLogs).where(where)
    .groupBy(httpLogs.domain).orderBy(desc(count())).limit(6);

  const volumeWhere = conditions.length > 0
    ? and(...conditions, sql`timestamp > datetime('now', '-14 days')`)
    : sql`timestamp > datetime('now', '-14 days')`;

  const volumeByDay = await db.select({
    day:   sql<string>`strftime('%m/%d', timestamp)`,
    count: count(),
  })
    .from(httpLogs).where(volumeWhere)
    .groupBy(sql`strftime('%Y-%m-%d', timestamp)`)
    .orderBy(sql`strftime('%Y-%m-%d', timestamp)`);

  const methodDist = await db.select({ method: httpLogs.method, count: count() })
    .from(httpLogs).where(where)
    .groupBy(httpLogs.method).orderBy(desc(count()));

  return {
    summary: {
      total:       row.total,
      errorCount,
      errorRate:   (errorCount / total) * 100,
      avgDuration: Number(row.avgDuration) || 0,
    },
    statusDist,
    topDomains,
    volumeByDay,
    methodDist,
  };
}
