import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Video, RefreshCw, HardDrive, ShieldCheck, Clock, Trash2, Filter } from "lucide-react";
import { api, RecordingItem, StorageStats, UserState } from "../services/api";
import { RecordingCard } from "../components/RecordingCard";

interface RecordingsProps {
  userState: UserState;
}

export const Recordings: React.FC<RecordingsProps> = ({ userState }) => {
  const [searchParams] = useSearchParams();
  const streamFilter = searchParams.get("stream_id") || "";

  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterKeptOnly, setFilterKeptOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    try {
      const [recRes, statRes] = await Promise.all([
        api.get("/recordings", {
          params: {
            stream_id: streamFilter || undefined,
            kept_only: filterKeptOnly ? "true" : undefined,
            search: searchTerm || undefined,
          },
        }),
        api.get("/recordings/stats"),
      ]);
      setRecordings(recRes.data);
      setStats(statRes.data);
    } catch (err) {
      console.error("Failed to load recordings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [streamFilter, filterKeptOnly, searchTerm]);

  const handleToggleKeep = async (id: number) => {
    try {
      await api.patch(`/recordings/${id}/keep`, {});
      fetchData();
    } catch (err) {
      console.error("Failed to toggle keep:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this flight video?")) return;
    try {
      await api.delete(`/recordings/${id}`);
      fetchData();
    } catch (err) {
      console.error("Failed to delete recording:", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            Drone Flight VODs & Recordings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Recorded flight archives with automatic 7-day retention and "Keep / Do Not Delete" protection.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl self-start sm:self-center transition-colors"
          title="Refresh recordings"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Video className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Total Flights
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
              {stats.total_recordings}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow">
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <HardDrive className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Storage Used
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
              {stats.total_gb} GB
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow">
            <span className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Kept Forever
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {stats.kept_count} videos
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow">
            <span className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Auto-Expiring
            </span>
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">
              {stats.expiring_count} videos
            </span>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by flight / channel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 w-full sm:w-64"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setFilterKeptOnly(!filterKeptOnly)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              filterKeptOnly
                ? "bg-emerald-600 text-white border-emerald-600 shadow"
                : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-500"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {filterKeptOnly ? "Showing: Kept Only" : "Filter: All Flights"}
          </button>
        </div>
      </div>

      {/* Recordings Grid */}
      {loading ? (
        <div className="py-32 text-center text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-3" />
          Loading flight recordings...
        </div>
      ) : recordings.length === 0 ? (
        <div className="py-24 text-center bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl mt-8">
          <Video className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Recordings Available</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            When a drone stream starts broadcasting, it is automatically captured into full-length MP4 flight video.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {recordings.map((rec) => (
            <RecordingCard
              key={rec.id}
              recording={rec}
              isAdmin={userState.authenticated}
              onToggleKeep={handleToggleKeep}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
