import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, RefreshCw, Layers } from "lucide-react";
import { api, StreamItem } from "../services/api";
import { WebRTCPlayer } from "../components/WebRTCPlayer";

export const MultiView: React.FC = () => {
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridLayout, setGridLayout] = useState<"auto" | "2x2" | "3x3">("auto");

  const fetchStreams = async () => {
    try {
      const res = await api.get("/streams");
      setStreams(res.data);
    } catch (err) {
      console.error("Failed to load streams for multiview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 6000);
    return () => clearInterval(interval);
  }, []);

  const liveStreams = streams.filter((s) => s.is_live);
  const displayStreams = liveStreams.length > 0 ? liveStreams : streams.slice(0, 6);

  const getGridClasses = () => {
    if (gridLayout === "2x2") return "grid-cols-1 md:grid-cols-2";
    if (gridLayout === "3x3") return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    // Auto
    if (displayStreams.length === 1) return "grid-cols-1 max-w-4xl mx-auto";
    if (displayStreams.length === 2) return "grid-cols-1 md:grid-cols-2";
    if (displayStreams.length <= 4) return "grid-cols-1 md:grid-cols-2";
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header & Layout Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <LayoutGrid className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Multi-View Live Wallboard
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              {liveStreams.length} Live Broadcasting
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simultaneous multi-screen drone surveillance and live operations monitoring.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Grid Layout Selector */}
          <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center space-x-1 text-xs font-semibold">
            <button
              onClick={() => setGridLayout("auto")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                gridLayout === "auto"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Auto
            </button>
            <button
              onClick={() => setGridLayout("2x2")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                gridLayout === "2x2"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              2 × 2 Grid
            </button>
            <button
              onClick={() => setGridLayout("3x3")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                gridLayout === "3x3"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              3 × 3 Grid
            </button>
          </div>

          <button
            onClick={fetchStreams}
            className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
            title="Refresh feeds"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multi-Stream Grid Display */}
      {loading ? (
        <div className="py-32 text-center text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-3" />
          Loading multi-feed grid...
        </div>
      ) : displayStreams.length === 0 ? (
        <div className="py-24 text-center bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl mt-8">
          <Layers className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Active Drone Streams</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Create a 5-digit stream channel in the Dashboard and start broadcasting.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow transition-colors"
          >
            Go to Channels Dashboard
          </Link>
        </div>
      ) : (
        <div className={`grid ${getGridClasses()} gap-5 mt-6`}>
          {displayStreams.map((stream) => (
            <div
              key={stream.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col"
            >
              {/* Tile Header */}
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[180px]">
                    {stream.name}
                  </span>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    #{stream.stream_key}
                  </span>
                </div>
                {stream.is_live ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500 text-white animate-pulse">
                    LIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Offline
                  </span>
                )}
              </div>

              {/* Video Tile */}
              <div className="flex-1 bg-black aspect-video">
                <WebRTCPlayer streamKey={stream.stream_key} showControls={true} />
              </div>

              {/* Tile Footer */}
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <Link
                  to={`/watch/${stream.stream_key}`}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                >
                  Open Solo View ➔
                </Link>
                <span className="text-slate-500 dark:text-slate-400 font-mono">
                  {stream.viewers_count} viewer(s)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
