import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertCircle, RefreshCw, Volume2, VolumeX, Maximize2, Radio } from "lucide-react";

interface HLSPlayerProps {
  streamKey: string;
}

export const HLSPlayer: React.FC<HLSPlayerProps> = ({ streamKey }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<"loading" | "playing" | "error">("loading");
  const [isMuted, setIsMuted] = useState(true);

  const initHls = () => {
    if (!videoRef.current || !streamKey) return;
    setStatus("loading");

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Use relative URL through Nginx reverse proxy (works on both HTTP and HTTPS)
    const src = `/hls/live/${streamKey}/index.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
        enableWorker: true,
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus("playing");
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn("[HLS] Fatal error:", data);
          setStatus("error");
        }
      });
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = src;
      videoRef.current.addEventListener("loadedmetadata", () => {
        setStatus("playing");
        videoRef.current?.play().catch(() => {});
      });
      videoRef.current.addEventListener("error", () => {
        setStatus("error");
      });
    }
  };

  useEffect(() => {
    initHls();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamKey]);

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-contain bg-black"
      />

      <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/90 text-white shadow-lg backdrop-blur">
          <Radio className="w-3.5 h-3.5" /> LL-HLS Playback (2–4s latency)
        </span>
      </div>

      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
          <RefreshCw className="w-10 h-10 text-amber-400 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-200">Buffering HLS stream...</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center z-20">
          <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
          <h4 className="text-base font-semibold text-white mb-1">Waiting for HLS Buffer</h4>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            HLS is generating video segments. Click Retry to connect.
          </p>
          <button
            onClick={initHls}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry HLS
          </button>
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = !videoRef.current.muted;
                setIsMuted(videoRef.current.muted);
              }
            }}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg backdrop-blur"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            onClick={initHls}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg backdrop-blur"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={() => {
            if (videoRef.current) {
              if (!document.fullscreenElement) {
                videoRef.current.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }
          }}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg backdrop-blur"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
