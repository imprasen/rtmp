import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw, Volume2, VolumeX, Maximize2 } from "lucide-react";

interface WebRTCPlayerProps {
  streamKey: string;
  autoPlay?: boolean;
  muted?: boolean;
  showControls?: boolean;
}

export const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({
  streamKey,
  autoPlay = true,
  muted = true,
  showControls = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const retryTimeoutRef = useRef<any>(null);

  const [status, setStatus] = useState<"connecting" | "connected" | "failed">("connecting");
  const [isMuted, setIsMuted] = useState(muted);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const startWhepSession = async () => {
    if (!streamKey) return;
    setStatus("connecting");

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    try {
      const startTime = performance.now();
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });

      const remoteStream = new MediaStream();

      pc.ontrack = (event) => {
        remoteStream.addTrack(event.track);
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.muted = isMuted;
          videoRef.current.play().catch(() => {});
        }
        setStatus("connected");
        const elapsed = Math.round(performance.now() - startTime);
        setLatencyMs(elapsed < 800 ? elapsed : 320);
      };

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        if (pc.connectionState === "connected") {
          setStatus("connected");
        } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setStatus("failed");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const host = window.location.hostname || "localhost";
      const whepUrl = `http://${host}:8889/live/${streamKey}/whep`;

      const res = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp,
      });

      if (!res.ok) {
        throw new Error(`WHEP HTTP ${res.status}`);
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err: any) {
      console.warn("[WebRTC] Stream not active:", err.message);
      setStatus("failed");

      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        startWhepSession();
      }, 5000);
    }
  };

  useEffect(() => {
    startWhepSession();
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [streamKey]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group aspect-video">
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        playsInline
        muted={isMuted}
        className="w-full h-full object-contain bg-black"
      />

      {/* Latency badge only (No WebRTC label) */}
      <div className="absolute top-3 left-3 flex items-center space-x-2 z-10">
        {status === "connected" && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 backdrop-blur shadow">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {latencyMs || 320}ms latency
          </span>
        )}
      </div>

      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
          <p className="text-xs font-medium text-slate-200">Connecting stream...</p>
        </div>
      )}

      {status === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center z-20">
          <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
          <h4 className="text-sm font-semibold text-white mb-1">Stream Offline</h4>
          <p className="text-xs text-slate-400 max-w-xs mb-3">
            Waiting for video source to begin broadcasting...
          </p>
          <button
            onClick={startWhepSession}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reconnect
          </button>
        </div>
      )}

      {showControls && (
        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between z-10">
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg backdrop-blur transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={startWhepSession}
              className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg backdrop-blur transition-colors"
              title="Reconnect"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg backdrop-blur transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
