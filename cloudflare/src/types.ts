export type { HttpLog } from "@/db/schema";

export interface Facet {
  name: string;
  field: string;
}

export interface ActiveTag {
  facet: string;
  value: string;
}

export interface Env {
  DB: D1Database;
  SEARCH_SESSION: DurableObjectNamespace;
  AI: Ai;
}
