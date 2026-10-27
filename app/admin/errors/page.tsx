"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Search,
  Loader2,
  RefreshCw,
  X,
  FileCode,
} from "lucide-react";
import { getErrorLogsAction, type ErrorLogItem } from "@/app/actions/errors";

export default function AdminErrorLogsPage() {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const [searchRef, setSearchRef] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ErrorLogItem | null>(null);

  async function loadLogs(ref?: string) {
    setLoading(true);
    const res = await getErrorLogsAction(ref);
    if (res.ok) {
      setLogs(res.data.logs);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLogs(searchRef);
  }, [searchRef]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">System Error Logs</h1>
          <p className="text-xs sm:text-sm text-[var(--mute)] font-medium mt-1">
            Lookup user incident reference IDs and inspect server stack traces without exposing them to users
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadLogs(searchRef)}
            disabled={loading}
            className="w-10 h-10 rounded-full flex items-center justify-center soft-button cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[var(--acc)]" : "text-[var(--ink)]"}`} />
          </button>
        </div>
      </div>

      {/* Search Bar (Soft UI Inset) */}
      <div className="soft-card p-4 sm:p-5">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[var(--mute)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchRef}
            onChange={(e) => setSearchRef(e.target.value)}
            placeholder="Search by Reference ID (e.g. 7A9B2F)..."
            className="soft-input w-full pl-10 pr-4 py-2.5 text-xs font-bold uppercase font-mono"
          />
        </div>
      </div>

      {/* Logs Card */}
      <div className="soft-card overflow-hidden">
        {loading && (
          <div className="p-16 text-center text-[var(--mute)]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--acc)] mb-2" />
            <p className="text-xs font-bold">Fetching error logs from database...</p>
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="p-16 text-center text-[var(--mute)]">
            <FileCode className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-base font-bold text-[var(--ink)]">No error logs recorded</p>
            <p className="text-xs text-[var(--mute)] mt-1">
              {searchRef
                ? `No logs matched the reference ID "${searchRef}".`
                : "The server is running smoothly without recorded exceptions."}
            </p>
          </div>
        )}

        {!loading && logs.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--lo)] text-xs font-bold text-[var(--mute)] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Reference ID</th>
                    <th className="px-6 py-4">Action / Route</th>
                    <th className="px-6 py-4">Error Message</th>
                    <th className="px-6 py-4">Logged At</th>
                    <th className="px-6 py-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--lo)]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--lo)]/10 transition">
                      <td className="px-6 py-4">
                        <span
                          className="font-mono text-xs font-black px-3 py-1 rounded-full inline-block"
                          style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
                        >
                          {log.ref_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-[var(--acc2)]">
                        {log.route || "global"}
                      </td>
                      <td className="px-6 py-4 font-bold text-[var(--ink)] max-w-md truncate">
                        {log.message}
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--mute)] font-medium">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="soft-button text-xs !py-1 !px-3 font-bold cursor-pointer"
                        >
                          Inspect Stack
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden divide-y divide-[var(--lo)]">
              {logs.map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="font-mono text-xs font-black px-2.5 py-0.5 rounded-full inline-block"
                      style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
                    >
                      {log.ref_id}
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--acc2)]">
                      {log.route || "global"}
                    </span>
                  </div>
                  <p className="font-bold text-xs text-[var(--ink)] line-clamp-2">
                    {log.message}
                  </p>
                  <div className="flex items-center justify-between text-xs text-[var(--mute)] pt-1">
                    <span>{new Date(log.created_at).toLocaleDateString()}</span>
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="soft-button text-xs !py-1 !px-2.5 font-bold cursor-pointer"
                    >
                      Stack
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Details & Stack Trace Modal (Soft UI) */}
      {selectedLog && (
        <div className="soft-modal-overlay p-4">
          <div className="soft-modal-content max-w-2xl w-full p-6 sm:p-8 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--lo)]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-black text-[var(--ink)]">
                  Incident Log: Ref #{selectedLog.ref_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center soft-button cursor-pointer text-[var(--mute)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 text-xs pr-1">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl" style={{ boxShadow: "var(--press)" }}>
                <div>
                  <span className="text-[var(--mute)] font-bold uppercase text-[10px]">Route / Action</span>
                  <p className="font-mono text-[var(--ink)] font-bold mt-0.5">{selectedLog.route || "N/A"}</p>
                </div>
                <div>
                  <span className="text-[var(--mute)] font-bold uppercase text-[10px]">Timestamp</span>
                  <p className="text-[var(--ink)] font-medium mt-0.5">{new Date(selectedLog.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <span className="text-[var(--mute)] font-bold uppercase text-[10px]">Internal Message:</span>
                <p className="p-3 rounded-xl font-mono text-xs mt-1 text-red-500" style={{ boxShadow: "var(--press)" }}>
                  {selectedLog.message}
                </p>
              </div>

              {selectedLog.stack && (
                <div>
                  <span className="text-[var(--mute)] font-bold uppercase text-[10px]">Server Stack Trace:</span>
                  <pre
                    className="p-4 rounded-xl font-mono text-[11px] mt-1 overflow-x-auto max-h-64"
                    style={{ boxShadow: "var(--press)", background: "var(--bg)", color: "var(--acc)" }}
                  >
                    {selectedLog.stack}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--lo)] flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="soft-button cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
