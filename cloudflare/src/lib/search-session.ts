import { DurableObject } from "cloudflare:workers";
import type { ActiveTag, Env } from "../types";
import { FACET_NAMES, getUniqueValues, queryLogs } from "./facets";
import { queryStats } from "./stats";
import { jsxToString } from "./render";
import { LogTable } from "@/components/LogTable";
import { TagBar } from "@/components/TagBar";
import { StatsBar } from "@/components/StatsBar";
import { FacetList, ValueList, NoResults } from "@/components/Dropdown";

/**
 * SearchSession Durable Object
 * Manages a WebSocket connection per user session.
 * Receives search interactions, queries D1, returns HTML partials via WS envelope.
 */
export class SearchSession extends DurableObject<Env> {
  private tags: ActiveTag[] = [];
  private connections = new Set<WebSocket>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.connections.add(server);

    // Fetch initial data in parallel
    const [{ logs, total }, stats] = await Promise.all([
      queryLogs(this.env.DB, this.tags),
      queryStats(this.env.DB, this.tags),
    ]);

    this.sendUi(server, "#log-table", "outerHTML", await jsxToString(LogTable({ logs, total })));
    this.sendUi(server, "#stats-bar", "outerHTML", await jsxToString(StatsBar({ stats })));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let msg: any;
    try { msg = JSON.parse(message); } catch { return; }

    const values = msg.values || {};
    const action = (values.action || "").trim();
    const query = (values.query || "").trim();
    const tagsStr = values.tags || "";
    const activeTags = this.parseTags(tagsStr);

    if (action === "suggest") {
      await this.handleSuggest(ws, query, activeTags, msg.request_id);
    } else if (action === "add_tag") {
      activeTags.push({ facet: values.facet || "", value: values.value || "" });
      this.tags = activeTags;
      await this.refreshAll(ws, activeTags);
    } else if (action === "remove_tag") {
      const idx = parseInt(values.removeIdx || "0", 10);
      if (idx >= 0 && idx < activeTags.length) activeTags.splice(idx, 1);
      this.tags = activeTags;
      await this.refreshAll(ws, activeTags);
    } else if (action === "refresh") {
      this.tags = activeTags;
      await this.refreshTable(ws, activeTags);
    } else if (action === "set_tags") {
      // AI-driven: replace all active tags and refresh everything
      this.tags = activeTags;
      await this.refreshAll(ws, activeTags);
    }
  }

  webSocketClose(ws: WebSocket) { this.connections.delete(ws); }
  webSocketError(ws: WebSocket) { this.connections.delete(ws); }

  private sendUi(ws: WebSocket, target: string, swap: string, payload: string) {
    ws.send(JSON.stringify({ channel: "ui", format: "html", target, swap, payload }));
  }

  private async handleSuggest(ws: WebSocket, query: string, activeTags: ActiveTag[], requestId?: string) {
    let html: string;

    if (!query) {
      html = await jsxToString(FacetList({ facets: FACET_NAMES }));
    } else {
      const colonIdx = query.indexOf(":");
      if (colonIdx > 0) {
        const facet = query.slice(0, colonIdx).toLowerCase();
        const prefix = query.slice(colonIdx + 1);
        if (!FACET_NAMES.includes(facet)) {
          html = await jsxToString(NoResults({ message: `Unknown facet: ${facet}` }));
        } else {
          const values = await getUniqueValues(this.env.DB, facet, prefix, activeTags);
          html = values.length === 0
            ? await jsxToString(NoResults({ message: "No matching values" }))
            : await jsxToString(ValueList({ facet, values, prefix: prefix || undefined }));
        }
      } else {
        const matching = FACET_NAMES.filter((f) => f.includes(query.toLowerCase()));
        html = matching.length === 0
          ? await jsxToString(NoResults({ message: "No matching facets" }))
          : await jsxToString(FacetList({ facets: matching }));
      }
    }

    ws.send(JSON.stringify({
      channel: "ui", format: "html",
      target: "#dropdown", swap: "innerHTML",
      payload: html, request_id: requestId,
    }));
  }

  private async refreshTable(ws: WebSocket, tags: ActiveTag[]) {
    const { logs, total } = await queryLogs(this.env.DB, tags);
    this.sendUi(ws, "#log-table", "outerHTML", await jsxToString(LogTable({ logs, total })));
  }

  private async refreshAll(ws: WebSocket, tags: ActiveTag[]) {
    const tagsStr = tags.map((t) => `${t.facet}:${t.value}`).join("|");

    const [{ logs, total }, stats] = await Promise.all([
      queryLogs(this.env.DB, tags),
      queryStats(this.env.DB, tags),
    ]);

    this.sendUi(ws, "#log-table", "outerHTML", await jsxToString(LogTable({ logs, total })));
    this.sendUi(ws, "#stats-bar", "outerHTML", await jsxToString(StatsBar({ stats })));
    this.sendUi(ws, "#tag-bar", "outerHTML", await jsxToString(TagBar({ tags })));
    this.sendUi(ws, "#dropdown", "innerHTML", "");
    ws.send(JSON.stringify({ channel: "state", tags: tagsStr, clearInput: true }));
  }

  private parseTags(tagsStr: string): ActiveTag[] {
    if (!tagsStr) return [];
    return tagsStr.split("|").map((t) => {
      const idx = t.indexOf(":");
      return idx < 0 ? null : { facet: t.slice(0, idx), value: t.slice(idx + 1) };
    }).filter(Boolean) as ActiveTag[];
  }
}
