import type { HttpLog } from "../types";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  PATCH: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/20",
};

function statusColor(code: number): string {
  if (code >= 500) return "text-red-400";
  if (code >= 400) return "text-amber-400";
  if (code >= 300) return "text-blue-400";
  if (code >= 200) return "text-emerald-400";
  return "text-gray-400";
}

function methodBadge(method: string): string {
  const cls = METHOD_COLORS[method] || "bg-gray-500/15 text-gray-400 border-gray-500/20";
  return `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded border ${cls}">${method}</span>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderLogTable(logs: HttpLog[], total: number): string {
  const rows = logs.length === 0
    ? `<tr><td colspan="6" class="px-4 py-12 text-center text-gray-500">
        <div class="flex flex-col items-center gap-2">
          <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <span>No logs match the current filters</span>
        </div>
      </td></tr>`
    : logs.map((log) => `
      <tr class="log-row">
        <td class="px-4 py-2.5">${methodBadge(log.method)}</td>
        <td class="px-4 py-2.5 font-mono text-xs ${statusColor(log.status_code)}">${log.status_code}</td>
        <td class="px-4 py-2.5 text-gray-400 font-mono text-xs">${esc(log.domain)}</td>
        <td class="px-4 py-2.5 text-gray-300 font-mono text-xs">${esc(log.path)}</td>
        <td class="px-4 py-2.5 text-gray-500 font-mono text-xs">${log.duration_ms != null ? log.duration_ms + "ms" : "—"}</td>
        <td class="px-4 py-2.5 text-gray-500 text-xs">${log.timestamp ? new Date(log.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</td>
      </tr>
    `).join("");

  return `<div id="log-table" class="bg-[#111827]/80 border border-gray-700/40 rounded-lg overflow-hidden fade-in">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-700/40">
          <th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-20">Method</th>
          <th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-20">Status</th>
          <th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-40">Domain</th>
          <th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Path</th>
          <th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-24">Duration</th>
          <th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-36">Timestamp</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-800/40">${rows}</tbody>
    </table>
    <div class="px-4 py-2 border-t border-gray-700/40 text-xs text-gray-500">${total} ${total === 1 ? "result" : "results"}</div>
  </div>`;
}

const METHOD_DOTS: Record<string, string> = {
  GET: "bg-emerald-400", POST: "bg-blue-400", PUT: "bg-amber-400",
  PATCH: "bg-orange-400", DELETE: "bg-red-400",
};

function statusDotColor(status: string): string {
  const c = status[0];
  return c === "2" ? "bg-emerald-400" : c === "3" ? "bg-blue-400" : c === "4" ? "bg-amber-400" : c === "5" ? "bg-red-400" : "bg-gray-400";
}

export function renderFacetList(facets: string[], query: string): string {
  const items = facets.map((f) => `
    <button class="dropdown-item w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-violet-500/10 hover:text-violet-300 flex items-center gap-2 transition-colors cursor-pointer" onclick="selectFacet('${f}')">
      <span class="text-violet-400 font-mono text-xs px-1.5 py-0.5 bg-violet-500/10 rounded">${f}</span>
      <span class="text-gray-500 text-xs">:</span>
    </button>
  `).join("");
  return `<div class="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Facets</div>${items}`;
}

export function renderValueList(facet: string, values: string[], tagsStr: string): string {
  const items = values.map((v, i) => {
    const dot = facet === "method" ? `<span class="w-1.5 h-1.5 rounded-full ${METHOD_DOTS[v] || "bg-gray-400"}"></span>` :
                facet === "status" ? `<span class="w-1.5 h-1.5 rounded-full ${statusDotColor(v)}"></span>` : "";
    return `
    <button class="dropdown-item w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-violet-500/10 hover:text-violet-300 flex items-center gap-2 transition-colors cursor-pointer" data-index="${i}" onclick="addTag('${facet}', '${esc(v)}')">
      <span class="font-mono text-xs">${esc(v)}</span>
      ${dot}
    </button>`;
  }).join("");
  return `<div class="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">${facet} values</div>${items}`;
}

export function renderNoResults(message: string): string {
  return `<div class="px-3 py-4 text-center text-sm text-gray-500">${esc(message)}</div>`;
}
