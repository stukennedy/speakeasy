import type { Context } from "hono";
import type { ActiveTag, Env } from "@/types";
import { FACET_NAMES, getUniqueValues } from "@/lib/facets";
import { FacetList, ValueList, NoResults } from "@/components/Dropdown";

function parseTags(s: string): ActiveTag[] {
  if (!s) return [];
  return s.split("|").map((t) => {
    const i = t.indexOf(":");
    return i < 0 ? null : { facet: t.slice(0, i), value: t.slice(i + 1) };
  }).filter(Boolean) as ActiveTag[];
}

export const onRequestGet = async (c: Context<{ Bindings: Env }>) => {
  const query = (c.req.query("query") || "").trim();
  const tags = parseTags(c.req.query("tags") || "");

  if (!query) return c.html(<FacetList facets={FACET_NAMES} />);

  const colonIdx = query.indexOf(":");
  if (colonIdx > 0) {
    const facet = query.slice(0, colonIdx).toLowerCase();
    const prefix = query.slice(colonIdx + 1);
    if (!FACET_NAMES.includes(facet)) return c.html(<NoResults message={`Unknown facet: ${facet}`} />);
    const values = await getUniqueValues(c.env.DB, facet, prefix, tags);
    return values.length === 0
      ? c.html(<NoResults message="No matching values" />)
      : c.html(<ValueList facet={facet} values={values} />);
  }

  const matching = FACET_NAMES.filter((f) => f.includes(query.toLowerCase()));
  return matching.length === 0
    ? c.html(<NoResults message="No matching facets" />)
    : c.html(<FacetList facets={matching} />);
};
