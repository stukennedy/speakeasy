import type { FC } from "hono/jsx";
import { MethodDot, StatusDot } from "./MethodBadge";

export const FacetList: FC<{ facets: string[] }> = ({ facets }) => (
  <div id="dropdown-content">
    <div class="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Facets</div>
    {facets.map((f) => (
      <button
        class="dropdown-item w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-violet-500/10 hover:text-violet-300 flex items-center gap-2 transition-colors cursor-pointer"
        data-facet={f}
        onclick={`selectFacet('${f}')`}
      >
        <span class="text-violet-400 font-mono text-xs px-1.5 py-0.5 bg-violet-500/10 rounded">{f}</span>
        <span class="text-gray-500 text-xs">:</span>
      </button>
    ))}
  </div>
);

export const ValueList: FC<{ facet: string; values: string[] }> = ({ facet, values }) => (
  <div id="dropdown-content">
    <div class="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
      {facet} values
    </div>
    {values.map((v, i) => (
      <button
        class="dropdown-item w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-violet-500/10 hover:text-violet-300 flex items-center gap-2 transition-colors cursor-pointer"
        data-value={v}
        data-index={i}
        onclick={`addTag('${facet}','${v}')`}
      >
        <span class="font-mono text-xs">{v}</span>
        {facet === "method" && <MethodDot method={v} />}
        {facet === "status" && <StatusDot status={v} />}
      </button>
    ))}
  </div>
);

export const NoResults: FC<{ message: string }> = ({ message }) => (
  <div id="dropdown-content">
    <div class="px-3 py-4 text-center text-sm text-gray-500">{message}</div>
  </div>
);
