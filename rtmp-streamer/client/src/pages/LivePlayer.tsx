import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Radio, Zap, Globe, Lock, Copy, Check, Video } from "lucide-react";
import { api, StreamItem } from "../services/api";
import { WebRTCPlayer } from "../components/WebRTCPlayer";
import { HLSPlayer } from "../components/HLSPlayer";

export const LivePlayer: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [stream, setStream] = useState<StreamItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerMode, setPlayerMode] = useState<"webrtc" | "hls">("hls");
  const [copiedRtmp, setCopiedRtmp] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const fetchStream = async () => {
    if (!key) return;
    try {
      const res = await api.get(`/streams/${key}`);
      setStream(res.data);
    } catch (err) {
      console.error("Failed to load stream details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStream();
    const interval = setInterval(fetchStream, 5000);
    return () => clearInterval(interval);
  }, [key]);

  const copyToClipboard = (text: string, isRtmp: boolean) => {
    navigator.clipboard.writeText(text);
    if (isRtmp) {
      setCopiedRtmp(true);
      setTimeout(() => setCopiedRtmp(false), 2000);
    } else {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  if (loading && !stream) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center text-slate-400">
        Loading live player...
      </div>
    );
  }

  const streamKey = key || "";
  const shareUrl = window.location.href;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Link & Protocol Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Channels Dashboard
        </Link>

        <div className="flex items-center space-x-3">
          <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center space-x-1 text-xs font-semibold">
            <button
              onClick={() => setPlayerMode("webrtc")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                playerMode === "webrtc"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" /> WebRTC (&lt;500ms)
            </button>
            <button
              onClick={() => setPlayerMode("hls")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                playerMode === "hls"
                  ? "bg-amber-600 text-white shadow"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5" /> LL-HLS (2-4s)
            </button>
          </div>
        </div>
      </div>

      {/* Main Video Player */}
      <div className="mt-6">
        {playerMode === "webrtc" ? (
          <WebRTCPlayer streamKey={streamKey} onError={() => setPlayerMode("hls")} />
        ) : (
          <HLSPlayer streamKey={streamKey} />
        )}
      </div>

      {/* Live Stream Metadata Banner */}
      <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {stream ? stream.name : `Channel #${streamKey}`}
              </h2>
              {stream?.is_public ? (
                <span className="flex items-center gap-1 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  <Globe className="w-3 h-3" /> Public Channel
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> Private Channel
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              Stream Key: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{streamKey}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => copyToClipboard(stream?.domain_rtmp || `rtmp://localhost:1935/ingest/${streamKey}`, true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            >
              {copiedRtmp ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copiedRtmp ? "RTMP URL Copied" : "Copy RTMP Ingest"}
            </button>

            <button
              onClick={() => copyToClipboard(shareUrl, false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition-colors"
            >
              {copiedShare ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedShare ? "Link Copied" : "Share Watch URL"}
            </button>

            <Link
              to={`/recordings?stream_id=${streamKey}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <Video className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> View Flight VODs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
