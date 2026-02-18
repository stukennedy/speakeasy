import type { FC } from "hono/jsx";
import type { ActiveTag } from "@/types";

export const AiPanel: FC = () => (
  <div class="bg-[rgba(99,102,241,0.04)] border border-indigo-500/20 rounded-lg overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-2.5 border-b border-indigo-500/15">
      <div class="w-1.5 h-1.5 rounded-full bg-indigo-400" style="animation: pulse 2s ease-in-out infinite;" />
      <span class="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest font-mono">AI Assistant</span>
      <span class="text-[10px] text-gray-600 ml-1 font-mono">· Cloudflare Workers AI</span>
    </div>
    <div class="p-4">
      <form
        hx-post="/api/ai"
        hx-target="#ai-response"
        hx-swap="innerHTML"
        hx-indicator="#ai-spinner"
        class="flex gap-2"
      >
        <input type="hidden" id="ai-tags" name="tags" value="" />
        <input
          id="ai-question"
          type="text"
          name="question"
          placeholder="Ask about these logs… e.g. 'Has api.github.com returned any 5xx errors?'"
          class="ai-input flex-1 bg-transparent border border-[rgba(255,255,255,0.07)] rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/15 transition-all font-mono"
          autocomplete="off"
        />
        <button
          type="submit"
          class="px-4 py-2 bg-indigo-600/70 hover:bg-indigo-500/70 text-white text-xs font-semibold rounded-md transition-colors border border-indigo-500/30 whitespace-nowrap flex items-center gap-2 font-mono"
        >
          <span id="ai-spinner" class="htmx-indicator">
            <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
          Ask →
        </button>
      </form>
      <div id="ai-response" class="mt-3 empty:hidden" />
    </div>
  </div>
);

export const AiAnswer: FC<{ question?: string; answer?: string; error?: string; filters?: ActiveTag[] }> = ({
  question,
  answer,
  error,
  filters,
}) => {
  const resetInput = (
    <input
      id="ai-question"
      hx-swap-oob="true"
      type="text"
      name="question"
      placeholder="Ask about these logs… e.g. 'Has api.github.com returned any 5xx errors?'"
      class="ai-input flex-1 bg-transparent border border-[rgba(255,255,255,0.07)] rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/15 transition-all font-mono"
      autocomplete="off"
    />
  );

  if (error) {
    return (
      <div>
        {resetInput}
        {question && (
          <div class="text-[11px] font-mono text-gray-600 mb-2 italic">→ "{question}"</div>
        )}
        <div class="flex items-start gap-2 p-3 bg-rose-500/8 border border-rose-500/20 rounded-md">
          <svg class="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-rose-400 text-xs font-mono">{error}</span>
        </div>
      </div>
    );
  }

  const filtersStr = filters?.length
    ? filters.map((f) => `${f.facet}:${f.value}`).join("|")
    : null;

  return (
    <div>
      {resetInput}
      {question && (
        <div class="text-[11px] font-mono text-gray-600 mb-2 italic">→ "{question}"</div>
      )}
      <div class="p-3 bg-[rgba(99,102,241,0.06)] border border-indigo-500/20 rounded-md text-gray-200 text-xs font-mono leading-relaxed whitespace-pre-wrap">
        {answer}
      </div>
      {filtersStr && (
        <div
          class="mt-2 flex items-center flex-wrap gap-1.5"
          data-auto-filters={filtersStr}
        >
          <span class="text-[10px] font-mono text-indigo-400/60 uppercase tracking-wider mr-0.5">
            Applying →
          </span>
          {filters!.map((f) => (
            <button
              onclick={`addTag(${JSON.stringify(f.facet)}, ${JSON.stringify(f.value)})`}
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 hover:bg-indigo-500/25 transition-colors"
            >
              {f.facet}:{f.value}
            </button>
          ))}
          <button
            onclick={`setTags(${JSON.stringify(filtersStr)})`}
            class="ml-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono bg-indigo-600/50 text-indigo-100 border border-indigo-500/40 hover:bg-indigo-500/60 transition-colors"
          >
            Set all
          </button>
        </div>
      )}
    </div>
  );
};
