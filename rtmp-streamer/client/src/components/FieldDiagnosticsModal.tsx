import React, { useEffect, useState } from "react";
import { X, RefreshCw, Trash2, CheckCircle, XCircle, Activity, Wifi } from "lucide-react";
import { api } from "../services/api";

interface FieldLogEntry {
  timestamp: string;
  action: string;
  rawPath: string;
  sanitizedKey: string;
  clientIp: string;
  callerIp: string;
  isInternalAllowed: boolean;
  dbMatched: boolean;
  streamName?: string;
  isActive?: boolean;
  decision: "ACCEPTED" | "REJECTED";
  statusCode: number;
  reason?: string;
  rawBody?: any;
}

interface FieldDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FieldDiagnosticsModal: React.FC<FieldDiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<FieldLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/hooks/field-logs?limit=50");
      if (res.data?.logs) {
        setLogs(res.data.logs);
      }
    } catch (err) {
      console.error("Failed to fetch field logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchLogs();

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, autoRefresh]);

  const handleClear = async () => {
    if (!window.confirm("Clear all field diagnostic logs?")) return;
    try {
      setClearing(true);
      await api.post("/hooks/field-logs/clear");
      setLogs([]);
    } catch (err) {
      console.error("Failed to clear logs:", err);
    } finally {
      setClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Field RTMP Diagnostics
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                  Live Monitor
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Captures every incoming DJI drone / remote RTMP connection attempt and authentication decision
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-500 dark:text-slate-400 font-mono">
              Total Recorded: <strong className="text-slate-700 dark:text-slate-300">{logs.length}</strong>
            </span>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              Auto-refresh (3s)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleClear}
              disabled={clearing || logs.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Logs
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Wifi className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No connection attempts recorded yet</p>
              <p className="text-xs mt-1">
                When you initiate live streaming on your DJI remote controller, the attempt will appear here immediately.
              </p>
            </div>
          ) : (
            logs.map((log, idx) => {
              const isAccepted = log.decision === "ACCEPTED";
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border text-xs font-mono transition-all ${
                    isAccepted
                      ? "bg-emerald-500/5 border-emerald-500/20 text-slate-800 dark:text-slate-200"
                      : "bg-rose-500/5 border-rose-500/20 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {isAccepted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px]">
                          <CheckCircle className="w-3 h-3" /> ACCEPTED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold uppercase text-[10px]">
                          <XCircle className="w-3 h-3" /> REJECTED ({log.statusCode})
                        </span>
                      )}
                      <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-sans">
                      Client IP: <strong className="text-slate-700 dark:text-slate-300 font-mono">{log.clientIp}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400">Raw Path: </span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {log.rawPath || "/"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Resolved Key: </span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {log.sanitizedKey || "NONE"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="text-slate-400 font-sans">Diagnostic Reason: </span>
                      <span className={isAccepted ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400 font-semibold"}>
                        {log.reason}
                      </span>
                    </div>
                    {log.streamName && (
                      <span className="text-slate-500 font-sans">
                        Channel: <strong className="text-slate-700 dark:text-slate-300">{log.streamName}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Logs are persisted on Server 0149 at <code>/opt/rtmp/rtmp-streamer/logs/auth-hook.log</code></span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready for Field Test</span>
        </div>
      </div>
    </div>
  );
};
