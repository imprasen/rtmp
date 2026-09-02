import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, Lock, Globe, Video, Trash2, Eye } from "lucide-react";
import { StreamItem } from "../services/api";

interface StreamCardProps {
  stream: StreamItem;
  isAdmin: boolean;
  onDelete: (id: number) => void;
}

export const StreamCard: React.FC<StreamCardProps> = ({ stream, isAdmin, onDelete }) => {
  const [copiedRtmp, setCopiedRtmp] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const [copiedServer, setCopiedServer] = useState(false);

  const copyServer = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedServer(true);
    setTimeout(() => setCopiedServer(false), 2000);
  };

  const obsServerUrl = stream.obs_server || "rtmp://live.dhanushuav.in:1935/live";
  const fullRtmpUrl = stream.domain_rtmp || stream.rtmp_url;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/50 dark:hover:border-slate-700 transition-all shadow-lg hover:shadow-xl group">
      {/* Header Banner */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {stream.name}
            </h3>
            {stream.is_public ? (
              <span className="flex items-center gap-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <Globe className="w-3 h-3" /> Public
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" /> Private
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md text-emerald-700 dark:text-emerald-300">
              Key: {stream.stream_key}
            </span>
            <button
              onClick={() => copyToClipboard(stream.stream_key, false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Copy 5-digit key"
            >
              {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Live Status Badge */}
        {stream.is_live ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-lg shadow-rose-900/40 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            LIVE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Offline
          </span>
        )}
      </div>

      {/* Body Details */}
      <div className="p-5 space-y-4">
        {/* Ingest URL Box */}
        <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5">
          {/* OBS Server Field */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">OBS Server:</span>
              <button
                onClick={() => copyServer(obsServerUrl)}
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-mono transition-colors text-[11px] font-semibold"
              >
                {copiedServer ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedServer ? "Copied!" : "Copy Server"}
              </button>
            </div>
            <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 select-all">
              {obsServerUrl}
            </p>
          </div>

          {/* OBS Stream Key Field */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Stream Key:</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(stream.stream_key);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-mono transition-colors text-[11px] font-semibold"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? "Copied!" : "Copy Key"}
              </button>
            </div>
            <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 select-all">
              {stream.stream_key}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
            <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">Auto-Record</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {stream.auto_record ? "✅ Active" : "❌ Off"}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
            <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">Flight VODs</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{stream.recordings_count} recorded</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <Link
          to={`/watch/${stream.stream_key}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Watch Live Feed
        </Link>

        <div className="flex items-center space-x-2">
          <Link
            to={`/recordings?stream_id=${stream.stream_key}`}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="View Flight Recordings"
          >
            <Video className="w-4 h-4" />
          </Link>
          {isAdmin && (
            <button
              onClick={() => onDelete(stream.id)}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Delete Channel"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
