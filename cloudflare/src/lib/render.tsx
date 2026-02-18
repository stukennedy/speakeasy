/**
 * Server-side rendering helpers for WebSocket HTML partials.
 * Uses Hono JSX → string for the DO to send over WS.
 */
import { LogTable } from "@/components/LogTable";
import { FacetList, ValueList, NoResults } from "@/components/Dropdown";
import type { HttpLog, ActiveTag } from "@/types";

// Hono's JSX returns a JSXNode — we need to render to string for WS
// Using a simple approach: render via Hono's internal toString
async function jsxToString(node: any): Promise<string> {
  // Hono JSX nodes have a toString() that returns the HTML
  if (node && typeof node.toString === "function") {
    const result = node.toString();
    if (result instanceof Promise) return await result;
    return result;
  }
  return String(node);
}

export async function renderLogTable(logs: HttpLog[], total: number): Promise<string> {
  return jsxToString(<LogTable logs={logs} total={total} />);
}

export async function renderFacetList(facets: string[]): Promise<string> {
  return jsxToString(<FacetList facets={facets} />);
}

export async function renderValueList(facet: string, values: string[]): Promise<string> {
  return jsxToString(<ValueList facet={facet} values={values} />);
}

export async function renderNoResults(message: string): Promise<string> {
  return jsxToString(<NoResults message={message} />);
}

export function renderTagBar(tags: ActiveTag[], tagsStr: string): string {
  if (tags.length === 0) {
    return `<div id="tag-bar" class="flex items-center gap-1 shrink-0 flex-wrap"></div>`;
  }
  const pills = tags
    .map(
      (tag, i) =>
        `<span class="tag-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 whitespace-nowrap">` +
        `<span class="text-violet-400/70">${tag.facet}:</span>` +
        `<span>${tag.value}</span>` +
        `<button onclick="removeTag(${i})" class="ml-0.5 text-violet-400/60 hover:text-violet-300 transition-colors">` +
        `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>` +
        `</button></span>`
    )
    .join("");
  return `<div id="tag-bar" class="flex items-center gap-1 shrink-0 flex-wrap">${pills}</div>`;
}
