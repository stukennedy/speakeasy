import type { FC } from "hono/jsx";

export const SearchBar: FC = () => (
  <div class="relative mb-4" id="search-container">
    <div class="flex items-center bg-[#111827]/80 border border-gray-700/40 rounded-lg focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
      <div id="tag-bar" class="flex items-center gap-1 pl-3 shrink-0 flex-wrap" />
      <div class="pl-3 pr-2 text-gray-500">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

    {/* Dropdown */}
    <div
      id="dropdown"
      class="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1d2e] border border-gray-700/50 rounded-lg shadow-xl shadow-black/40 overflow-hidden max-h-72 overflow-y-auto hidden"
    />
  </div>
);

export const WsForms: FC = () => (
  <>
    <form id="suggest-form" hx-ws-send hx-trigger="suggest" style={{ display: "none" }}>
      <input type="hidden" name="action" value="suggest" />
      <input type="hidden" name="query" id="ws-query" />
      <input type="hidden" name="tags" id="ws-tags" />
    </form>
    <form id="add-tag-form" hx-ws-send hx-trigger="submit" style={{ display: "none" }}>
      <input type="hidden" name="action" value="add_tag" />
      <input type="hidden" name="facet" id="ws-add-facet" />
      <input type="hidden" name="value" id="ws-add-value" />
      <input type="hidden" name="tags" id="ws-add-tags" />
    </form>
    <form id="remove-tag-form" hx-ws-send hx-trigger="submit" style={{ display: "none" }}>
      <input type="hidden" name="action" value="remove_tag" />
      <input type="hidden" name="removeIdx" id="ws-remove-idx" />
      <input type="hidden" name="tags" id="ws-remove-tags" />
    </form>
    <form id="refresh-form" hx-ws-send hx-trigger="submit" style={{ display: "none" }}>
      <input type="hidden" name="action" value="refresh" />
      <input type="hidden" name="tags" id="ws-refresh-tags" />
    </form>
  </>
);
