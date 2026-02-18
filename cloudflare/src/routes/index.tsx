import type { Context } from "hono";
import { SearchBar, WsForms } from "@/components/SearchBar";
import type { Env } from "@/types";

export const onRequestGet = async (c: Context<{ Bindings: Env }>) => {
  return c.render(
    <main class="min-h-screen p-6">
      <div class="max-w-6xl mx-auto">
        {/* Header */}
        <div class="mb-6">
          <h1 class="text-xl font-semibold text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Log Browser
          </h1>
          <p class="text-sm text-gray-400 mt-1">
            Filter HTTP logs using faceted search · HTMX 4 + WebSockets
          </p>
        </div>

        {/* WS connection wraps everything */}
        <div id="ws-container" hx-ws-connect="/ws">
          <WsForms />
          <SearchBar />

          {/* Log table — initial load from WS on connect */}
          <div id="log-table">
            <div class="bg-[#111827]/80 border border-gray-700/40 rounded-lg p-12 text-center text-gray-400">
              Connecting…
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
