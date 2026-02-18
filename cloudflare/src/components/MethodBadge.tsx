import type { FC } from "hono/jsx";

const COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  PATCH: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/20",
};

export const MethodBadge: FC<{ method: string }> = ({ method }) => (
  <span
    class={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${COLORS[method] || "bg-gray-500/15 text-gray-400 border-gray-500/20"}`}
  >
    {method}
  </span>
);

const DOT_COLORS: Record<string, string> = {
  GET: "bg-emerald-400",
  POST: "bg-blue-400",
  PUT: "bg-amber-400",
  PATCH: "bg-orange-400",
  DELETE: "bg-red-400",
};

export const MethodDot: FC<{ method: string }> = ({ method }) => (
  <span class={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[method] || "bg-gray-400"}`} />
);

export const StatusDot: FC<{ status: string }> = ({ status }) => {
  const c = status[0];
  const color =
    c === "2" ? "bg-emerald-400"
    : c === "3" ? "bg-blue-400"
    : c === "4" ? "bg-amber-400"
    : c === "5" ? "bg-red-400"
    : "bg-gray-400";
  return <span class={`w-1.5 h-1.5 rounded-full ${color}`} />;
};

export function statusColor(code: number): string {
  if (code >= 500) return "text-red-400";
  if (code >= 400) return "text-amber-400";
  if (code >= 300) return "text-blue-400";
  if (code >= 200) return "text-emerald-400";
  return "text-gray-400";
}
