import { Hono } from "hono";
import type { Env } from "./types";
import { FACET_NAMES, getUniqueValues, queryLogs } from "./lib/facets";
import { renderLogTable, renderFacetList, renderValueList, renderNoResults } from "./lib/render";
import type { ActiveTag } from "./types";

// Re-export Durable Object
export { SearchSession } from "./lib/search-session";

const app = new Hono<{ Bindings: Env }>();

// WebSocket upgrade → Durable Object
app.get("/ws", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected WebSocket", 426);
  }

  // Use a session ID (could be from cookie/auth, using IP for now)
  const id = c.env.SEARCH_SESSION.idFromName(
    c.req.header("CF-Connecting-IP") || "anonymous"
  );
  const stub = c.env.SEARCH_SESSION.get(id);
  return stub.fetch(new Request(new URL("/ws", c.req.url), {
    headers: c.req.raw.headers,
  }));
});

// Fallback HTTP endpoints for suggest/logs (used before WS connects)
function parseTags(tagsStr: string): ActiveTag[] {
  if (!tagsStr) return [];
  return tagsStr.split("|").map((t) => {
    const idx = t.indexOf(":");
    if (idx < 0) return null;
    return { facet: t.slice(0, idx), value: t.slice(idx + 1) };
  }).filter(Boolean) as ActiveTag[];
}

app.get("/api/suggest", async (c) => {
  const query = (c.req.query("query") || "").trim();
  const tagsStr = c.req.query("tags") || "";
  const activeTags = parseTags(tagsStr);

  if (!query) {
    return c.html(renderFacetList(FACET_NAMES, ""));
  }
  const colonIdx = query.indexOf(":");
  if (colonIdx > 0) {
    const facet = query.slice(0, colonIdx).toLowerCase();
    const prefix = query.slice(colonIdx + 1);
    if (!FACET_NAMES.includes(facet)) {
      return c.html(renderNoResults(`Unknown facet: ${facet}`));
    }
    const values = await getUniqueValues(c.env.DB, facet, prefix, activeTags);
    return values.length === 0
      ? c.html(renderNoResults("No matching values"))
      : c.html(renderValueList(facet, values, tagsStr));
  }
  const matching = FACET_NAMES.filter((f) => f.includes(query.toLowerCase()));
  return matching.length === 0
    ? c.html(renderNoResults("No matching facets"))
    : c.html(renderFacetList(matching, query));
});

app.get("/api/logs", async (c) => {
  const tagsStr = c.req.query("tags") || "";
  const activeTags = parseTags(tagsStr);
  const { logs, total } = await queryLogs(c.env.DB, activeTags);
  return c.html(renderLogTable(logs as any, total));
});

// Home page
app.get("/", (c) => {
  return c.html(homePage());
});

function homePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Log Browser — Speakeasy</title>
  <script src="/js/htmx.js"></script>
  <script src="/js/hx-ws.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@4/index.min.css" rel="stylesheet"/>
  <style>
    body { background: #0a0c14; color: #c9d1d9; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    .search-input:focus { outline: none; }
    .dropdown-item.highlighted { background: rgba(139, 92, 246, 0.15); color: #c4b5fd; }
    .fade-in { animation: fadeIn 0.15s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .tag-pill { transition: all 0.15s ease; }
    .tag-pill:hover { filter: brightness(1.2); }
    .log-row { transition: background 0.1s ease; }
    .log-row:hover { background: rgba(255,255,255,0.02); }
  </style>
</head>
<body class="min-h-screen" hx-ext="ws">
  <div class="min-h-screen p-6">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
          </svg>
          Log Browser
        </h1>
        <p class="text-sm text-gray-500 mt-1">Filter HTTP logs using faceted search · HTMX 4 + WebSockets (fully WS-driven)</p>
      </div>

      <!-- Everything inside the WS connection container — all interactions go through the socket -->
      <div id="ws-container" hx-ws-connect="/ws">

        <!-- Hidden form for sending suggest requests over WS -->
        <form id="suggest-form" hx-ws-send hx-trigger="suggest" style="display:none">
          <input type="hidden" name="action" value="suggest"/>
          <input type="hidden" name="query" id="ws-query"/>
          <input type="hidden" name="tags" id="ws-tags"/>
        </form>

        <!-- Hidden form for adding a tag over WS -->
        <form id="add-tag-form" hx-ws-send hx-trigger="submit" style="display:none">
          <input type="hidden" name="action" value="add_tag"/>
          <input type="hidden" name="facet" id="ws-add-facet"/>
          <input type="hidden" name="value" id="ws-add-value"/>
          <input type="hidden" name="tags" id="ws-add-tags"/>
        </form>

        <!-- Hidden form for removing a tag over WS -->
        <form id="remove-tag-form" hx-ws-send hx-trigger="submit" style="display:none">
          <input type="hidden" name="action" value="remove_tag"/>
          <input type="hidden" name="removeIdx" id="ws-remove-idx"/>
          <input type="hidden" name="tags" id="ws-remove-tags"/>
        </form>

        <!-- Hidden form for refreshing the table over WS -->
        <form id="refresh-form" hx-ws-send hx-trigger="submit" style="display:none">
          <input type="hidden" name="action" value="refresh"/>
          <input type="hidden" name="tags" id="ws-refresh-tags"/>
        </form>

        <!-- Search bar -->
        <div class="relative mb-4" id="search-container">
          <div class="flex items-center bg-[#111827]/80 border border-gray-700/40 rounded-lg focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
            <div id="tag-bar" class="flex items-center gap-1 pl-3 shrink-0 flex-wrap"></div>
            <div class="pl-3 pr-2 text-gray-500">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              id="search-input"
              class="search-input flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 py-2.5 pr-3 min-w-[200px]"
              placeholder="Filter logs… type a facet (method, status, domain, path)"
              autocomplete="off"
            />
          </div>

          <!-- Dropdown -->
          <div id="dropdown" class="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1d2e] border border-gray-700/50 rounded-lg shadow-xl shadow-black/40 overflow-hidden max-h-72 overflow-y-auto hidden"></div>
        </div>

        <!-- Log table (initial load comes from WS on connect) -->
        <div id="log-table">
          <div class="bg-[#111827]/80 border border-gray-700/40 rounded-lg p-12 text-center text-gray-500">Connecting...</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    var activeTags = [];
    var highlightIdx = -1;
    var input = document.getElementById('search-input');
    var dropdown = document.getElementById('dropdown');
    var debounceTimer = null;

    function getTagsStr() {
      return activeTags.map(function(t) { return t.facet + ':' + t.value; }).join('|');
    }

    // --- Send suggest request over WebSocket ---
    function wsSuggest() {
      document.getElementById('ws-query').value = input.value;
      document.getElementById('ws-tags').value = getTagsStr();
      htmx.trigger(document.getElementById('suggest-form'), 'suggest');
    }

    // --- Debounced suggest on input ---
    input.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        wsSuggest();
      }, 150);
    });

    input.addEventListener('focus', function() {
      wsSuggest();
    });

    function selectFacet(facet) {
      input.value = facet + ':';
      input.focus();
      highlightIdx = -1;
      wsSuggest();
    }

    function addTag(facet, value) {
      // Send add_tag over WS — server will respond with updated table + tag bar + state
      document.getElementById('ws-add-facet').value = facet;
      document.getElementById('ws-add-value').value = value;
      document.getElementById('ws-add-tags').value = getTagsStr();
      htmx.trigger(document.getElementById('add-tag-form'), 'submit');
    }

    function removeTag(index) {
      document.getElementById('ws-remove-idx').value = index;
      document.getElementById('ws-remove-tags').value = getTagsStr();
      htmx.trigger(document.getElementById('remove-tag-form'), 'submit');
    }

    function refreshTable() {
      document.getElementById('ws-refresh-tags').value = getTagsStr();
      htmx.trigger(document.getElementById('refresh-form'), 'submit');
    }

    function renderTagBar() {
      var bar = document.getElementById('tag-bar');
      bar.innerHTML = activeTags.map(function(tag, i) {
        return '<span class="tag-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 whitespace-nowrap">' +
          '<span class="text-violet-400/70">' + tag.facet + ':</span>' +
          '<span>' + tag.value + '</span>' +
          '<button onclick="removeTag(' + i + ')" class="ml-0.5 text-violet-400/60 hover:text-violet-300 transition-colors">' +
          '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
          '</button></span>';
      }).join('');
    }

    // Show/hide dropdown based on content
    var observer = new MutationObserver(function() {
      if (dropdown.innerHTML.trim()) {
        dropdown.classList.remove('hidden');
      } else {
        dropdown.classList.add('hidden');
      }
    });
    observer.observe(dropdown, { childList: true, subtree: true });

    // Keyboard navigation
    input.addEventListener('keydown', function(e) {
      var items = dropdown.querySelectorAll('.dropdown-item');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightIdx = Math.min(highlightIdx + 1, items.length - 1);
        updateHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightIdx = Math.max(highlightIdx - 1, 0);
        updateHighlight(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < items.length) {
          items[highlightIdx].click();
        }
      } else if (e.key === 'Escape') {
        dropdown.innerHTML = '';
        dropdown.classList.add('hidden');
      } else if (e.key === 'Backspace' && input.value === '' && activeTags.length > 0) {
        removeTag(activeTags.length - 1);
      }
    });

    function updateHighlight(items) {
      items.forEach(function(item, i) {
        if (i === highlightIdx) {
          item.classList.add('highlighted');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('highlighted');
        }
      });
    }

    // Close dropdown on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#search-container')) {
        dropdown.innerHTML = '';
        dropdown.classList.add('hidden');
      }
    });

    // Reset highlight on new dropdown content
    document.body.addEventListener('htmx:afterSwap', function(e) {
      if (e.detail.target === dropdown || e.detail.target.id === 'dropdown') {
        highlightIdx = -1;
      }
    });

    // Handle state messages from WebSocket (non-ui channel)
    document.body.addEventListener('htmx:wsMessage', function(e) {
      var d = e.detail;
      if (d.channel === 'state') {
        if (d.tags !== undefined) {
          if (d.tags) {
            activeTags = d.tags.split('|').map(function(t) {
              var parts = t.split(':');
              return { facet: parts[0], value: parts.slice(1).join(':') };
            });
          } else {
            activeTags = [];
          }
          renderTagBar();
        }
        if (d.clearInput) {
          input.value = '';
          input.focus();
        }
      }
    });
  </script>
</body>
</html>`;
}

export default app;
