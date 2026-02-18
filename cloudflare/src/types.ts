export interface HttpLog {
  id: string;
  method: string;
  path: string;
  status_code: number;
  domain: string;
  timestamp: string;
  duration_ms: number | null;
  body_size: number | null;
}

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
}
