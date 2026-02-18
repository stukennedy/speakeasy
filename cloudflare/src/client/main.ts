/**
 * Client-side logic for the log browser.
 * Manages tag state, keyboard navigation, and WS form submission.
 */

// HTMX 4 + hx-ws loaded via public/ scripts in layout
declare const htmx: any;

interface Tag {
  facet: string;
  value: string;
}

let activeTags: Tag[] = [];
let highlightIdx = -1;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const input = () => $("search-input") as HTMLInputElement;
const dropdown = () => $("dropdown");

function getTagsStr(): string {
  return activeTags.map((t) => `${t.facet}:${t.value}`).join("|");
}

// --- WebSocket-driven actions ---

function wsSuggest() {
  ($("ws-query") as HTMLInputElement).value = input().value;
  ($("ws-tags") as HTMLInputElement).value = getTagsStr();
  htmx.trigger($("suggest-form"), "suggest");
}

// Exposed to onclick handlers in server-rendered HTML
(window as any).selectFacet = (facet: string) => {
  input().value = facet + ":";
  input().focus();
  highlightIdx = -1;
  wsSuggest();
};

(window as any).addTag = (facet: string, value: string) => {
  ($("ws-add-facet") as HTMLInputElement).value = facet;
  ($("ws-add-value") as HTMLInputElement).value = value;
  ($("ws-add-tags") as HTMLInputElement).value = getTagsStr();
  htmx.trigger($("add-tag-form"), "submit");
};

(window as any).removeTag = (index: number) => {
  ($("ws-remove-idx") as HTMLInputElement).value = String(index);
  ($("ws-remove-tags") as HTMLInputElement).value = getTagsStr();
  htmx.trigger($("remove-tag-form"), "submit");
};

function refreshTable() {
  ($("ws-refresh-tags") as HTMLInputElement).value = getTagsStr();
  htmx.trigger($("refresh-form"), "submit");
}

function renderTagBar() {
  const bar = $("tag-bar");
  bar.innerHTML = activeTags
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
}

// --- Input events ---

document.addEventListener("DOMContentLoaded", () => {
  const inp = input();
  const dd = dropdown();

  // Debounced suggest on input
  inp.addEventListener("input", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(wsSuggest, 150);
  });

  inp.addEventListener("focus", wsSuggest);

  // Keyboard navigation
  inp.addEventListener("keydown", (e) => {
    const items = dd.querySelectorAll<HTMLElement>(".dropdown-item");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIdx = Math.min(highlightIdx + 1, items.length - 1);
      updateHighlight(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIdx = Math.max(highlightIdx - 1, 0);
      updateHighlight(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < items.length) {
        items[highlightIdx].click();
      }
    } else if (e.key === "Escape") {
      dd.innerHTML = "";
      dd.classList.add("hidden");
    } else if (e.key === "Backspace" && inp.value === "" && activeTags.length > 0) {
      (window as any).removeTag(activeTags.length - 1);
    }
  });

  // Show/hide dropdown
  const observer = new MutationObserver(() => {
    dd.classList.toggle("hidden", !dd.innerHTML.trim());
  });
  observer.observe(dd, { childList: true, subtree: true });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest("#search-container")) {
      dd.innerHTML = "";
      dd.classList.add("hidden");
    }
  });

  // Reset highlight on new dropdown content
  document.body.addEventListener("htmx:afterSwap", ((e: CustomEvent) => {
    const target = e.detail?.target;
    if (target === dd || target?.id === "dropdown") {
      highlightIdx = -1;
    }
  }) as EventListener);

  // Handle state messages from WebSocket (non-ui channel)
  document.body.addEventListener("htmx:wsMessage", ((e: CustomEvent) => {
    const d = e.detail;
    if (d?.channel === "state") {
      if (d.tags !== undefined) {
        activeTags = d.tags
          ? d.tags.split("|").map((t: string) => {
              const idx = t.indexOf(":");
              return { facet: t.slice(0, idx), value: t.slice(idx + 1) };
            })
          : [];
        renderTagBar();
      }
      if (d.clearInput) {
        inp.value = "";
        inp.focus();
      }
    }
  }) as EventListener);
});

function updateHighlight(items: NodeListOf<HTMLElement>) {
  items.forEach((item, i) => {
    item.classList.toggle("highlighted", i === highlightIdx);
    if (i === highlightIdx) item.scrollIntoView({ block: "nearest" });
  });
}
