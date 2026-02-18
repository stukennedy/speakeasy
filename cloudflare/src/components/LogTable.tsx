import type { FC } from "hono/jsx";
import type { HttpLog } from "@/types";
import { MethodBadge, statusColor } from "./MethodBadge";

export const LogTable: FC<{ logs: HttpLog[]; total: number }> = ({ logs, total }) => (
  <div
    id="log-table"
    class="rounded-lg overflow-hidden fade-in"
    style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)"
  >
    <table class="w-full text-sm">
      <thead>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
          <th
            scope="col"
            class="px-4 py-3 text-left w-20"
            style="font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#374151;font-family:'IBM Plex Mono',monospace"
          >
            Method
          </th>
          <th
            scope="col"
            class="px-4 py-3 text-left w-16"
            style="font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#374151;font-family:'IBM Plex Mono',monospace"
          >
            Status
          </th>
          <th
            scope="col"
            class="px-4 py-3 text-left w-44"
            style="font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#374151;font-family:'IBM Plex Mono',monospace"
          >
            Domain
          </th>
          <th
            scope="col"
            class="px-4 py-3 text-left"
            style="font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#374151;font-family:'IBM Plex Mono',monospace"
          >
            Path
          </th>
          <th
            scope="col"
            class="px-4 py-3 text-right w-24"
            style="font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#374151;font-family:'IBM Plex Mono',monospace"
          >
            Duration
          </th>
          <th
            scope="col"
            class="px-4 py-3 text-right w-32"
            style="font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:#374151;font-family:'IBM Plex Mono',monospace"
          >
            Time
          </th>
        </tr>
      </thead>
      <tbody>
        {logs.length === 0 ? (
          <tr>
            <td colspan={6} class="px-4 py-16 text-center">
              <div class="flex flex-col items-center gap-2">
                <svg
                  class="w-7 h-7"
                  style="color:#1e293b"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span
                  class="text-xs"
                  style="color:#334155;font-family:'IBM Plex Mono',monospace"
                >
                  No logs match the current filters
                </span>
              </div>
            </td>
          </tr>
        ) : (
          logs.map((log) => (
            <tr class="log-row" style="border-top:1px solid rgba(255,255,255,0.04)">
              <td class="px-4 py-2">
                <MethodBadge method={log.method} />
              </td>
              <td class={`px-4 py-2 text-xs font-mono font-semibold ${statusColor(log.status_code)}`}>
                {log.status_code}
              </td>
              <td
                class="px-4 py-2 text-xs font-mono truncate max-w-0 w-44"
                style="color:#64748b"
                title={log.domain}
              >
                {log.domain}
              </td>
              <td
                class="px-4 py-2 text-xs font-mono truncate max-w-xs"
                style="color:#94a3b8"
                title={log.path}
              >
                {log.path}
              </td>
              <td class="px-4 py-2 text-xs font-mono text-right" style="color:#475569">
                {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
              </td>
              <td class="px-4 py-2 text-xs font-mono text-right" style="color:#475569">
                {log.timestamp
                  ? new Date(log.timestamp).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "—"}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
    <div
      class="px-4 py-2.5 text-xs font-mono"
      style="border-top:1px solid rgba(255,255,255,0.05);color:#374151"
    >
      {total.toLocaleString()} {total === 1 ? "result" : "results"}
    </div>
  </div>
);
