import { DurableObject } from "cloudflare:workers";
import type { ActiveTag, Env } from "../types";
import { FACET_NAMES, getUniqueValues, queryLogs } from "./facets";
import { renderLogTable, renderFacetList, renderValueList, renderNoResults } from "./render";

interface SearchState {
  tags: ActiveTag[];
}

/**
 * SearchSession Durable Object
 * Manages a WebSocket connection per user session.
 * Receives search interactions, queries D1, returns HTML partials via WS envelope.
 */
export class SearchSession extends DurableObject<Env> {
  private state: SearchState = { tags: [] };
  private connections = new Set<WebSocket>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      this.connections.add(server);

      // Send initial table on connect
      const db = this.env.DB;
      const { logs, total } = await queryLogs(db, this.state.tags);
      const html = renderLogTable(logs, total);
      server.send(JSON.stringify({
        channel: "ui",
        format: "html",
        target: "#log-table",
        swap: "outerHTML",
        payload: html,
      }));

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;

    let msg: any;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    const db = this.env.DB;
    const values = msg.values || {};
    const requestId = msg.request_id;

    // Route based on the path or action
    const action = values.action || "";
    const query = (values.query || "").trim();
    const tagsStr = values.tags || "";

    // Parse current tags from the hidden input
    const activeTags = this.parseTags(tagsStr);

    if (action === "suggest") {
      await this.handleSuggest(ws, query, activeTags, tagsStr, requestId);
    } else if (action === "add_tag") {
      const facet = values.facet || "";
      const value = values.value || "";
      activeTags.push({ facet, value });
      this.state.tags = activeTags;
      await this.refreshAll(ws, activeTags, requestId);
    } else if (action === "remove_tag") {
      const idx = parseInt(values.removeIdx || "0", 10);
      if (idx >= 0 && idx < activeTags.length) {
        activeTags.splice(idx, 1);
      }
      this.state.tags = activeTags;
      await this.refreshAll(ws, activeTags, requestId);
    } else if (action === "refresh") {
      this.state.tags = activeTags;
      await this.refreshTable(ws, activeTags, requestId);
    }
  }

  webSocketClose(ws: WebSocket) {
    this.connections.delete(ws);
  }

  webSocketError(ws: WebSocket) {
    this.connections.delete(ws);
  }

  private async handleSuggest(
    ws: WebSocket,
    query: string,
    activeTags: ActiveTag[],
    tagsStr: string,
    requestId?: string
  ) {
    const db = this.env.DB;
    let html: string;

    if (!query) {
      html = renderFacetList(FACET_NAMES, "");
    } else {
      const colonIdx = query.indexOf(":");
      if (colonIdx > 0) {
        const facet = query.slice(0, colonIdx).toLowerCase();
        const prefix = query.slice(colonIdx + 1);

        if (!FACET_NAMES.includes(facet)) {
          html = renderNoResults(`Unknown facet: ${facet}`);
        } else {
          const values = await getUniqueValues(db, facet, prefix, activeTags);
          if (values.length === 0) {
            html = renderNoResults("No matching values");
          } else {
            html = renderValueList(facet, values, tagsStr);
          }
        }
      } else {
        const matching = FACET_NAMES.filter((f) => f.includes(query.toLowerCase()));
        if (matching.length === 0) {
          html = renderNoResults("No matching facets");
        } else {
          html = renderFacetList(matching, query);
        }
      }
    }

    ws.send(JSON.stringify({
      channel: "ui",
      format: "html",
      target: "#dropdown",
      swap: "innerHTML",
      payload: html,
      request_id: requestId,
    }));
  }

  private async refreshTable(ws: WebSocket, tags: ActiveTag[], requestId?: string) {
    const db = this.env.DB;
    const { logs, total } = await queryLogs(db, tags);
    ws.send(JSON.stringify({
      channel: "ui",
      format: "html",
      target: "#log-table",
      swap: "outerHTML",
      payload: renderLogTable(logs, total),
      request_id: requestId,
    }));
  }

  private async refreshAll(ws: WebSocket, tags: ActiveTag[], requestId?: string) {
    const db = this.env.DB;
    const { logs, total } = await queryLogs(db, tags);
    const tagsStr = tags.map((t) => `${t.facet}:${t.value}`).join("|");

    // Send table update
    ws.send(JSON.stringify({
      channel: "ui",
      format: "html",
      target: "#log-table",
      swap: "outerHTML",
      payload: renderLogTable(logs, total),
    }));

    // Send tag bar update + clear input signal
    ws.send(JSON.stringify({
      channel: "ui",
      format: "html",
      target: "#tag-bar",
      swap: "outerHTML",
      payload: renderTagBar(tags, tagsStr),
    }));

    // Clear dropdown
    ws.send(JSON.stringify({
      channel: "ui",
      format: "html",
      target: "#dropdown",
      swap: "innerHTML",
      payload: "",
    }));

    // Signal to clear input and update hidden tags field
    ws.send(JSON.stringify({
      channel: "state",
      tags: tagsStr,
      clearInput: true,
    }));
  }

  private parseTags(tagsStr: string): ActiveTag[] {
    if (!tagsStr) return [];
    return tagsStr
      .split("|")
      .map((t) => {
        const idx = t.indexOf(":");
        if (idx < 0) return null;
        return { facet: t.slice(0, idx), value: t.slice(idx + 1) };
      })
      .filter(Boolean) as ActiveTag[];
  }
}

function renderTagBar(tags: ActiveTag[], tagsStr: string): string {
  if (tags.length === 0) {
    return `<div id="tag-bar" class="flex items-center gap-1 shrink-0 flex-wrap"></div>`;
  }
  const pills = tags.map((tag, i) => `
    <span class="tag-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 whitespace-nowrap">
      <span class="text-violet-400/70">${tag.facet}:</span>
      <span>${tag.value}</span>
      <button onclick="removeTag(${i})" class="ml-0.5 text-violet-400/60 hover:text-violet-300 transition-colors">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </span>
  `).join("");
  return `<div id="tag-bar" class="flex items-center gap-1 shrink-0 flex-wrap">${pills}</div>`;
}
