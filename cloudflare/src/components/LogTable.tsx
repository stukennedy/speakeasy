import type { FC } from "hono/jsx";
import type { HttpLog } from "@/types";
import { MethodBadge, statusColor } from "./MethodBadge";

export const LogTable: FC<{ logs: HttpLog[]; total: number }> = ({ logs, total }) => (
  <div id="log-table" class="bg-[#111827]/80 border border-gray-700/40 rounded-lg overflow-hidden fade-in">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-700/40">
          <th scope="col" class="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20">Method</th>
          <th scope="col" class="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20">Status</th>
          <th scope="col" class="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-40">Domain</th>
          <th scope="col" class="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Path</th>
          <th scope="col" class="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-24">Duration</th>
          <th scope="col" class="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-36">Timestamp</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-800/40">
        {logs.length === 0 ? (
          <tr>
            <td colspan={6} class="px-4 py-12 text-center text-gray-500">
              <div class="flex flex-col items-center gap-2">
                <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>No logs match the current filters</span>
              </div>
            </td>
          </tr>
        ) : (
          logs.map((log) => (
            <tr class="log-row">
              <td class="px-4 py-2.5"><MethodBadge method={log.method} /></td>
              <td class={`px-4 py-2.5 font-mono text-xs ${statusColor(log.status_code)}`}>{log.status_code}</td>
              <td class="px-4 py-2.5 text-gray-400 font-mono text-xs">{log.domain}</td>
              <td class="px-4 py-2.5 text-gray-300 font-mono text-xs">{log.path}</td>
              <td class="px-4 py-2.5 text-gray-400 font-mono text-xs">
                {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
              </td>
              <td class="px-4 py-2.5 text-gray-400 text-xs">
                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
    <div class="px-4 py-2 border-t border-gray-700/40 text-xs text-gray-400">
      {total} {total === 1 ? "result" : "results"}
    </div>
  </div>
);
