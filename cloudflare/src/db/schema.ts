import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const httpLogs = sqliteTable("http_logs", {
  id: text("id").primaryKey(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  status_code: integer("status_code").notNull(),
  domain: text("domain").notNull(),
  timestamp: text("timestamp").notNull().default(sql`(datetime('now'))`),
  duration_ms: integer("duration_ms"),
  request_headers: text("request_headers"),
  response_headers: text("response_headers"),
  body_size: integer("body_size"),
});

export type HttpLog = typeof httpLogs.$inferSelect;
