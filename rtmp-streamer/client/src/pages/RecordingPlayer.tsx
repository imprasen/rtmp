import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, ShieldCheck, Clock, Trash2, HardDrive, AlertCircle, Gauge, RotateCcw, RotateCw, Repeat } from "lucide-react";
import { api, RecordingItem, UserState } from "../services/api";

interface RecordingPlayerProps {
  userState: UserState;
}

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const RecordingPlayer: React.FC<RecordingPlayerProps> = ({ userState }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [recording, setRecording] = useState<RecordingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState<number>(7);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  const handleToggleLoop = () => {
    setIsLooping((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.loop = next;
      }
      return next;
    });
  };

  const fetchRecording = async () => {
    try {
      const res = await api.get(`/recordings/${id}`);
      setRecording(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load recording");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecording();
  }, [id]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleSeek = (offsetSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + offsetSeconds);
    }
  };

  // Keyboard navigation for playback speed and seeking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/select
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "]" || e.key === ">") {
        const nextSpeed = SPEED_PRESETS.find((s) => s > playbackRate) || SPEED_PRESETS[SPEED_PRESETS.length - 1];
        handleSpeedChange(nextSpeed);
      } else if (e.key === "[" || e.key === "<") {
        const prevSpeed = [...SPEED_PRESETS].reverse().find((s) => s < playbackRate) || SPEED_PRESETS[0];
        handleSpeedChange(prevSpeed);
      } else if (e.key === "0") {
        handleSpeedChange(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playbackRate]);

  const handleToggleKeep = async () => {
    if (!recording) return;
    try {
      await api.patch(`/recordings/${recording.id}/keep`, {});
      fetchRecording();
    } catch (err) {
      console.error("Failed to toggle keep:", err);
    }
  };

  const handleSetCustomDays = async (days: number) => {
    if (!recording) return;
    try {
      await api.patch(`/recordings/${recording.id}/keep`, { retention_days: days });
      fetchRecording();
    } catch (err) {
      console.error("Failed to set retention days:", err);
    }
  };

  const handleDelete = async () => {
    if (!recording || !window.confirm("Are you sure you want to permanently delete this flight video?")) return;
    try {
      await api.delete(`/recordings/${recording.id}`);
      navigate("/recordings");
    } catch (err) {
      console.error("Failed to delete recording:", err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center text-slate-400">
        Loading flight recording player...
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center shadow-xl">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Recording Not Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{error || "The requested video does not exist."}</p>
        <Link
          to="/recordings"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Recordings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button & Title */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <Link
          to="/recordings"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to VOD Recordings
        </Link>

        {/* Retention Status Badge */}
        {recording.is_kept ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
            <ShieldCheck className="w-4 h-4" /> Kept (Do Not Delete)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
            <Clock className="w-4 h-4" />
            {recording.days_until_expiry !== null
              ? `Auto-deletes in ${recording.days_until_expiry} days`
              : "7-Day Auto-Delete"}
          </span>
        )}
      </div>

      {/* Video Player Card */}
      <div className="mt-6 relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800 aspect-video group">
        {/* Floating Speed Indicator Badge */}
        {playbackRate !== 1 && (
          <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur border border-emerald-500/50 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-xl pointer-events-none">
            <Gauge className="w-3.5 h-3.5" />
            <span>{playbackRate}x Speed</span>
          </div>
        )}

        <video
          ref={videoRef}
          controls
          autoPlay
          loop={isLooping}
          preload="auto"
          playsInline
          className="w-full h-full object-contain bg-black"
          src={recording.stream_url}
          onLoadedMetadata={(e) => {
            (e.target as HTMLVideoElement).playbackRate = playbackRate;
          }}
        >
          Your browser does not support HTML5 MP4 video playback.
        </video>
      </div>

      {/* Playback Speed & Fast Flight Navigation Control Bar */}
      <div className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 px-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        {/* Playback Speed Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Speed:
          </span>
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {SPEED_PRESETS.map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  playbackRate === speed
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800/60"
                }`}
                title={`Play video at ${speed}x speed`}
              >
                {speed === 1 ? "1.0x (Normal)" : `${speed}x`}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Skip Buttons (-10s / +10s) & Loop Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSeek(-10)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> -10s
          </button>
          <button
            onClick={() => handleSeek(10)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            title="Skip forward 10 seconds"
          >
            +10s <RotateCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </button>
          <button
            onClick={handleToggleLoop}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
              isLooping
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30"
                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
            }`}
            title={isLooping ? "Looping enabled (Click to disable)" : "Looping disabled (Click to enable)"}
          >
            <Repeat className="w-3.5 h-3.5" /> {isLooping ? "Loop: ON" : "Loop"}
          </button>
        </div>
      </div>

      {/* Flight Video Metadata & Actions Bar */}
      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{recording.filename}</h2>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              Flight Channel: {recording.stream_name} (#{recording.stream_key})
            </p>

            <div className="flex items-center gap-6 mt-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="w-4 h-4 text-slate-400" /> Size:{" "}
                <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold">
                  {recording.file_size_formatted}
                </span>
              </span>

              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-slate-400" /> Recorded:{" "}
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  {new Date(
                    recording.created_at.includes("Z") || recording.created_at.includes("+")
                      ? recording.created_at
                      : recording.created_at.replace(" ", "T") + "Z"
                  ).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "medium",
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">IST</span>
                </span>
              </span>
            </div>
          </div>

          {/* Retention Options & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {userState.authenticated && (
              <>
                <button
                  onClick={handleToggleKeep}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    recording.is_kept
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-900/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-emerald-500"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  {recording.is_kept ? "Protected (Kept Forever)" : "Keep / Do Not Delete"}
                </button>

                {/* Custom Retention Dropdown */}
                <select
                  value={recording.is_kept ? "kept" : customDays}
                  onChange={(e) => {
                    if (e.target.value === "kept") {
                      handleToggleKeep();
                    } else {
                      const days = parseInt(e.target.value, 10);
                      setCustomDays(days);
                      handleSetCustomDays(days);
                    }
                  }}
                  className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value={7}>Keep for 7 Days</option>
                  <option value={14}>Keep for 14 Days</option>
                  <option value={30}>Keep for 30 Days</option>
                  <option value={90}>Keep for 90 Days</option>
                  <option value="kept">Keep Forever (Do Not Delete)</option>
                </select>
              </>
            )}

            <a
              href={recording.download_url}
              download
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Download MP4
            </a>

            {userState.authenticated && (
              <button
                onClick={handleDelete}
                className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors"
                title="Delete recording permanently"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
