import type { Context } from "hono";
import type { Env, ActiveTag } from "@/types";
import { jsxToString } from "@/lib/render";
import { queryAiContext } from "@/lib/stats";
import { AiAnswer } from "@/components/AiPanel";

function parseTags(tagsStr: string): ActiveTag[] {
  if (!tagsStr) return [];
  return tagsStr.split("|").flatMap((t) => {
    const idx = t.indexOf(":");
    return idx < 0 ? [] : [{ facet: t.slice(0, idx), value: t.slice(idx + 1) }];
  });
}

function parseFiltersLine(text: string): { clean: string; filters: ActiveTag[] } {
  const match = text.match(/^FILTERS:\s*(.+)$/m);
  if (!match) return { clean: text.trim(), filters: [] };

  const filters: ActiveTag[] = match[1]
    .trim()
    .split(/\s+/)
    .flatMap((part) => {
      const idx = part.indexOf(":");
      return idx > 0 ? [{ facet: part.slice(0, idx), value: part.slice(idx + 1) }] : [];
    });

  const clean = text.replace(/^FILTERS:.*$/m, "").trim();
  return { clean, filters };
}

export const onRequestPost = async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.parseBody();
  const question = String(body.question || "").trim();
  const tags = String(body.tags || "");

  if (!question) {
    return c.html(await jsxToString(AiAnswer({ error: "Please enter a question." })));
  }

  const activeTags = parseTags(tags);
  const dataContext = await queryAiContext(c.env.DB, activeTags, question);

  const systemPrompt = `You are a concise HTTP log analysis assistant embedded in a real-time log browser. Answer based ONLY on the data provided below — do not guess or invent numbers.

${dataContext}

Instructions:
- Answer the user's question using only the data above. Be specific with real numbers.
- If something has 0 errors, say so explicitly based on the data.
- Keep responses under 120 words. Be direct and precise.
- Available filter facets: method (GET/POST/PUT/PATCH/DELETE), status (exact code e.g. 500), domain (exact domain name from data), path.

FILTER SUGGESTIONS: If the question asks to "show", "filter", "find", or "display" specific logs, add a final line in this exact format:
FILTERS: facet:value [facet:value ...]
Use only facet values that appear in the data context above. Include multiple filters if appropriate.
Examples:
- "show 500 errors from api.github.com" → FILTERS: domain:api.github.com status:500
- "show errors from api.github.com" → FILTERS: domain:api.github.com status:4xx+5xx
- "show github errors" → FILTERS: domain:api.github.com status:4xx+5xx
- "show all errors" → FILTERS: status:4xx+5xx
- "show GET requests" → FILTERS: method:GET
IMPORTANT: When the question mentions "errors" without a specific status code, always include status:4xx+5xx in the FILTERS line.
Only include the FILTERS line if you are confident about the exact values.`;

  try {
    const ai = (c.env as any).AI;
    if (!ai) throw new Error("AI binding not configured — add 'ai' binding to wrangler.jsonc");

    const result = await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    });

    const raw = (result as any)?.response ?? "No response generated.";
    const { clean: answer, filters } = parseFiltersLine(raw);

    return c.html(await jsxToString(AiAnswer({ question, answer, filters })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI service unavailable";
    return c.html(await jsxToString(AiAnswer({ question, error: msg })));
  }
};
