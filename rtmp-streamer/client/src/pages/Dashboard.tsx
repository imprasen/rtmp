import React, { useEffect, useState } from "react";
import { Plus, Radio, RefreshCw, X, Shield, Key } from "lucide-react";
import { api, StreamItem, UserState } from "../services/api";
import { StreamCard } from "../components/StreamCard";

interface DashboardProps {
  userState: UserState;
}

export const Dashboard: React.FC<DashboardProps> = ({ userState }) => {
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCustomKey, setFormCustomKey] = useState("");
  const [formIsPublic, setFormIsPublic] = useState(true);
  const [formAutoRecord, setFormAutoRecord] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStreams = async () => {
    try {
      const res = await api.get("/streams");
      setStreams(res.data);
    } catch (err) {
      console.error("Failed to load streams:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);
    setError(null);

    try {
      await api.post("/streams", {
        name: formName.trim(),
        custom_key: formCustomKey.trim() || undefined,
        is_public: formIsPublic,
        auto_record: formAutoRecord,
      });
      setShowModal(false);
      setFormName("");
      setFormCustomKey("");
      fetchStreams();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create channel");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this stream channel?")) return;
    try {
      await api.delete(`/streams/${id}`);
      fetchStreams();
    } catch (err) {
      console.error("Failed to delete stream:", err);
    }
  };

  const liveCount = streams.filter((s) => s.is_live).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            Drone Flight Operations
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              {liveCount} Live Now
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time RTMP live streaming, drone fleet monitoring, and automated flight recording.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchStreams}
            className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
            title="Refresh streams"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {userState.authenticated && (
            <button
              onClick={() => {
                const array = new Uint32Array(1);
                window.crypto.getRandomValues(array);
                setFormCustomKey((10000 + (array[0] % 90000)).toString());
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" /> New Channel (5-Digit Key)
            </button>
          )}
        </div>
      </div>

      {/* Stream Cards Grid */}
      {loading ? (
        <div className="py-32 text-center text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-3" />
          Loading drone channels...
        </div>
      ) : streams.length === 0 ? (
        <div className="py-24 text-center bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl mt-8">
          <Radio className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Channels Configured</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Create your first 5-digit drone channel to begin live broadcasting.
          </p>
          {userState.authenticated && (
            <button
              onClick={() => {
                const array = new Uint32Array(1);
                window.crypto.getRandomValues(array);
                setFormCustomKey((10000 + (array[0] % 90000)).toString());
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow transition-colors"
            >
              <Plus className="w-4 h-4" /> Create 5-Digit Channel
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {streams.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              isAdmin={userState.authenticated}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Channel Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Create Drone Channel
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nagpur Drone Alpha"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Auto-Generated 5-Digit Stream Key
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 58291"
                  value={formCustomKey}
                  onChange={(e) => setFormCustomKey(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-wider focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  5-digit numeric key only (e.g. 10000 - 99999).
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPublic}
                    onChange={(e) => setFormIsPublic(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Public Stream (No Login Required)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Anyone with the URL can watch the live drone feed.
                    </span>
                  </div>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoRecord}
                    onChange={(e) => setFormAutoRecord(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Auto-Record Flights
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Automatically record all flights to VOD storage.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition-colors"
                >
                  {creating ? "Creating..." : "Save Channel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
