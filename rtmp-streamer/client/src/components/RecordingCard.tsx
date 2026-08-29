import React from "react";
import { Link } from "react-router-dom";
import { Play, Download, Trash2, ShieldCheck, Clock, HardDrive } from "lucide-react";
import { RecordingItem } from "../services/api";

interface RecordingCardProps {
  recording: RecordingItem;
  isAdmin: boolean;
  onToggleKeep: (id: number) => void;
  onDelete: (id: number) => void;
}

export const RecordingCard: React.FC<RecordingCardProps> = ({
  recording,
  isAdmin,
  onToggleKeep,
  onDelete,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/40 dark:hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between">
      <div>
        {/* Header Title */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex items-start justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[200px]" title={recording.filename}>
              {recording.filename}
            </h4>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
              Channel: {recording.stream_name} (#{recording.stream_key})
            </p>
          </div>

          {/* Retention Badge */}
          {recording.is_kept ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
              <ShieldCheck className="w-3.5 h-3.5" /> Kept (Do Not Delete)
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                (recording.days_until_expiry || 7) <= 2
                  ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30"
                  : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {recording.days_until_expiry !== null
                ? `Expires in ${recording.days_until_expiry}d`
                : "7-Day Auto-Delete"}
            </span>
          )}
        </div>

        {/* Video Metadata */}
        <div className="p-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" /> File Size:
            </span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{recording.file_size_formatted}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Flight Recorded:
            </span>
            <span className="text-slate-700 dark:text-slate-200">
              {new Date(recording.created_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <Link
          to={`/recordings/${recording.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-current" /> Watch VOD
        </Link>

        <div className="flex items-center space-x-1.5">
          {isAdmin && (
            <button
              onClick={() => onToggleKeep(recording.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                recording.is_kept
                  ? "bg-emerald-600 text-white border-emerald-600 shadow"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-500"
              }`}
              title={recording.is_kept ? "Click to set back to auto-delete" : "Click to Keep / Do Not Delete"}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {recording.is_kept ? "Kept ✓" : "Keep / Do Not Delete"}
            </button>
          )}

          <a
            href={recording.download_url}
            download
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Download MP4"
          >
            <Download className="w-4 h-4" />
          </a>

          {isAdmin && (
            <button
              onClick={() => onDelete(recording.id)}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Delete Recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
