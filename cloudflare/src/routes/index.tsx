import type { Context } from "hono";
import { SearchBar, WsForms } from "@/components/SearchBar";
import { AiPanel } from "@/components/AiPanel";
import type { Env } from "@/types";

export const onRequestGet = async (c: Context<{ Bindings: Env }>) => {
  return c.render(
    <main class="min-h-screen px-5 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <header class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div
            class="live-ring w-2 h-2 rounded-full shrink-0"
            style="background:#10b981;"
            aria-hidden="true"
          />
          <h1 class="text-sm font-semibold text-white tracking-tight" style="font-family:'IBM Plex Mono',monospace">
            log.browser
          </h1>
          <span class="text-gray-700 text-xs hidden sm:inline" style="font-family:'IBM Plex Mono',monospace">
            / speakeasy · http access logs
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button
            id="ai-toggle-btn"
            onclick="toggleAiPanel()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border"
            style="background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.25);color:#a5b4fc;font-family:'IBM Plex Mono',monospace"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI
          </button>
        </div>
      </header>

      {/* WS container */}
      <div id="ws-container" hx-ws-connect="/ws">
        <WsForms />

        {/* Stats bar — populated by WS on connect */}
        <div id="stats-bar" class="mb-4">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {[...Array(4)].map(() => (
              <div class="stat-card">
                <div class="h-2 rounded mb-3" style="background:rgba(255,255,255,0.05);width:60%" />
                <div class="h-6 rounded" style="background:rgba(255,255,255,0.04);width:80%" />
              </div>
            ))}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[...Array(3)].map(() => (
              <div class="stat-card h-24" style="background:rgba(255,255,255,0.02)" />
            ))}
          </div>
        </div>

        {/* AI Panel — hidden by default */}
        <div id="ai-panel-wrapper" class="hidden mb-4">
          <AiPanel />
        </div>

        {/* Search bar */}
        <SearchBar />

        {/* Log table — populated by WS on connect */}
        <div id="log-table">
          <div
            class="rounded-lg p-12 text-center border"
            style="background:rgba(255,255,255,0.02);border-color:rgba(255,255,255,0.06)"
          >
            <div class="flex flex-col items-center gap-2">
              <div
                class="w-1.5 h-1.5 rounded-full"
                style="background:#22d3ee;animation:pulse 1.5s ease-in-out infinite"
              />
              <span
                class="text-xs text-gray-600"
                style="font-family:'IBM Plex Mono',monospace"
              >
                Connecting…
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
