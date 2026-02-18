import type { FC } from "hono/jsx";
import type { Stats } from "@/lib/stats";

const STATUS_COLORS: Record<string, string> = {
  "2xx": "#10b981",
  "3xx": "#f59e0b",
  "4xx": "#f97316",
  "5xx": "#f43f5e",
};

const METHOD_COLORS: Record<string, string> = {
  GET: "#22d3ee",
  POST: "#818cf8",
  PUT: "#f59e0b",
  PATCH: "#f97316",
  DELETE: "#f43f5e",
  HEAD: "#64748b",
  OPTIONS: "#64748b",
};

const Sparkline: FC<{ data: { day: string; count: number }[] }> = ({ data }) => {
  const W = 200, H = 36, PAD = 3;
  if (!data.length) return <svg viewBox={`0 0 ${W} ${H}`} class="w-full h-9" />;

  const max = Math.max(...data.map((d) => d.count), 1);
  const pts = data.map((d, i) => ({
    x: PAD + (i / Math.max(data.length - 1, 1)) * (W - 2 * PAD),
    y: PAD + ((max - d.count) / max) * (H - 2 * PAD),
  }));

  const linePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillD = [
    `M ${pts[0].x.toFixed(1)},${H}`,
    ...pts.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L ${pts[pts.length - 1].x.toFixed(1)},${H} Z`,
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="w-full h-9" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#22d3ee" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#sg)" />
      <polyline
        points={linePts}
        fill="none"
        stroke="#22d3ee"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  );
};

export const StatsBar: FC<{ stats: Stats }> = ({ stats }) => {
  const { summary, statusDist, volumeByDay, methodDist } = stats;
  const totalStatus = statusDist.reduce((s, d) => s + d.count, 0) || 1;
  const maxMethodCount = Math.max(...methodDist.map((m) => m.count), 1);

  const errorRateColor =
    summary.errorRate > 10
      ? "text-rose-400"
      : summary.errorRate > 3
      ? "text-amber-400"
      : "text-emerald-400";

  return (
    <div id="stats-bar" class="mb-4 space-y-3 fade-in">
      {/* Metrics row */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="stat-card">
          <div class="stat-label">Total Requests</div>
          <div class="stat-value text-white">{summary.total.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Errors (4xx+5xx)</div>
          <div class={`stat-value ${summary.errorCount > 0 ? "text-rose-400" : "text-gray-500"}`}>
            {summary.errorCount.toLocaleString()}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Error Rate</div>
          <div class={`stat-value ${errorRateColor}`}>{summary.errorRate.toFixed(1)}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Duration</div>
          <div class="stat-value text-cyan-400 font-mono">{summary.avgDuration}ms</div>
        </div>
      </div>

      {/* Charts row */}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Status distribution */}
        <div class="stat-card">
          <div class="stat-label mb-3">Status Distribution</div>
          <div class="flex rounded-full overflow-hidden h-2 gap-px" style="background:#0a0c14">
            {statusDist.map((d) => {
              const pct = (d.count / totalStatus) * 100;
              const color = STATUS_COLORS[d.group] || "#6366f1";
              return pct > 0.5 ? (
                <div
                  style={`width:${pct.toFixed(1)}%;background:${color};`}
                  title={`${d.group}: ${d.count.toLocaleString()} (${pct.toFixed(1)}%)`}
                />
              ) : null;
            })}
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {statusDist.map((d) => {
              const pct = ((d.count / totalStatus) * 100).toFixed(0);
              const color = STATUS_COLORS[d.group] || "#6366f1";
              return (
                <div class="flex items-center gap-1.5">
                  <div class="w-1.5 h-1.5 rounded-full shrink-0" style={`background:${color}`} />
                  <span class="text-[11px] font-mono text-gray-400">{d.group}</span>
                  <span class="text-[11px] font-mono text-gray-600">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Volume sparkline */}
        <div class="stat-card">
          <div class="stat-label mb-2">Volume — last 14 days</div>
          <Sparkline data={volumeByDay} />
          <div class="flex justify-between mt-1">
            <span class="text-[10px] font-mono text-gray-700">{volumeByDay[0]?.day ?? ""}</span>
            <span class="text-[10px] font-mono text-gray-700">
              {volumeByDay[volumeByDay.length - 1]?.day ?? ""}
            </span>
          </div>
        </div>

        {/* Method distribution */}
        <div class="stat-card">
          <div class="stat-label mb-3">Methods</div>
          <div class="flex flex-col gap-2">
            {methodDist.slice(0, 5).map((m) => {
              const pct = (m.count / maxMethodCount) * 100;
              const color = METHOD_COLORS[m.method] || "#64748b";
              return (
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-mono text-gray-400 w-14 text-right shrink-0">
                    {m.method}
                  </span>
                  <div class="flex-1 rounded-full h-1.5 overflow-hidden" style="background:rgba(255,255,255,0.05)">
                    <div
                      class="h-full rounded-full"
                      style={`width:${pct.toFixed(1)}%;background:${color};`}
                    />
                  </div>
                  <span class="text-[10px] font-mono text-gray-600 w-12 shrink-0">
                    {m.count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
