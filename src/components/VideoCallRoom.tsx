"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WebRTCCall } from "@/lib/webrtc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Monitor, MonitorOff, Maximize2, Minimize2,
  Wifi, WifiOff, Signal, AlertCircle, Stethoscope
} from "lucide-react";

interface VideoCallRoomProps {
  callId: string;
  role: "caller" | "callee";
  remoteName: string;
  remoteSpecialty?: string;
  onEnd: () => void;
}

export function VideoCallRoom({
  callId,
  role,
  remoteName,
  remoteSpecialty,
  onEnd,
}: VideoCallRoomProps) {
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcRef      = useRef<WebRTCCall | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [audioEnabled, setAudioEnabled]         = useState(true);
  const [videoEnabled, setVideoEnabled]         = useState(true);
  const [isScreenSharing, setIsScreenSharing]   = useState(false);
  const [isFullscreen, setIsFullscreen]         = useState(false);
  const [connected, setConnected]               = useState(false);
  const [connectionState, setConnectionState]   = useState<string>("initializing");
  const [callDuration, setCallDuration]         = useState(0);
  const [showControls, setShowControls]         = useState(true);
  const [error, setError]                       = useState<string | null>(null);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  useEffect(() => {
    const call = new WebRTCCall(callId, role);
    webrtcRef.current = call;

    call.onRemoteStream = (stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        setConnected(true);
        timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
      }
    };

    call.onConnectionStateChange = (state) => setConnectionState(state);

    call.onCallEnded = () => {
      call.cleanup();
      onEnd();
    };

    call
      .initialize(true, true)
      .then((localStream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        setConnectionState("connecting");
      })
      .catch((err) => {
        console.error("WebRTC init error:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Camera and microphone access was denied. Please allow permissions in your browser settings and try again.");
        } else if (err.name === "NotFoundError") {
          setError("No camera or microphone found. Please connect a device and try again.");
        } else {
          setError(`Could not start video call: ${err.message}`);
        }
      });

    resetHideTimer();

    return () => {
      if (timerRef.current)    clearInterval(timerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      call.cleanup();
    };
  }, [callId, role, onEnd, resetHideTimer]);

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    webrtcRef.current?.toggleAudio(next);
    resetHideTimer();
  };

  const toggleVideo = () => {
    const next = !videoEnabled;
    setVideoEnabled(next);
    webrtcRef.current?.toggleVideo(next);
    resetHideTimer();
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      const stream = await webrtcRef.current?.shareScreen();
      setIsScreenSharing(!!stream);
    } else {
      setIsScreenSharing(false);
    }
    resetHideTimer();
  };

  const handleEndCall = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await webrtcRef.current?.endCall();
    onEnd();
  };

  const connBadge = () => {
    switch (connectionState) {
      case "connected":
        return <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold"><Wifi className="w-3 h-3" /> HD · E2E Encrypted</span>;
      case "connecting":
        return <span className="flex items-center gap-1 text-amber-400 text-[10px] font-bold animate-pulse"><Signal className="w-3 h-3" /> Connecting…</span>;
      case "failed":
      case "disconnected":
        return <span className="flex items-center gap-1 text-rose-400 text-[10px] font-bold"><WifiOff className="w-3 h-3" /> Poor connection</span>;
      default:
        return <span className="flex items-center gap-1 text-white/40 text-[10px] font-bold"><Signal className="w-3 h-3" /> Initializing…</span>;
    }
  };

  /* ─── Error state ─── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-72 space-y-5 text-center p-6">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-full">
          <AlertCircle className="w-10 h-10 text-rose-500" />
        </div>
        <div className="space-y-1">
          <h3 className="font-black text-lg text-foreground">Video Unavailable</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">{error}</p>
        </div>
        <Button variant="outline" onClick={onEnd} className="rounded-xl font-bold text-xs">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full bg-zinc-950 rounded-2xl overflow-hidden select-none ${isFullscreen ? "fixed inset-0 z-[9999] rounded-none" : ""}`}
      style={isFullscreen ? {} : { aspectRatio: "16 / 9" }}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
    >
      {/* ─── Remote video feed ─── */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* ─── Connecting overlay ─── */}
      <AnimatePresence>
        {!connected && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/98 backdrop-blur space-y-6 z-10"
          >
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                <Stethoscope className="w-10 h-10 text-primary" />
              </div>
              <span className="absolute inset-0 rounded-full border-4 border-primary/25 animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-black text-lg">
                {role === "caller" ? `Calling ${remoteName}…` : `Connecting to ${remoteName}…`}
              </p>
              <p className="text-white/40 text-xs font-medium">
                {remoteSpecialty ? `${remoteSpecialty} · ` : ""}E2E Encrypted · WebRTC
              </p>
            </div>
            <div className="flex space-x-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Local PiP ─── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-20 right-3 w-32 h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-10 cursor-pointer group"
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {!videoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/95">
            <VideoOff className="w-6 h-6 text-white/30" />
          </div>
        )}
        {!audioEnabled && (
          <div className="absolute top-1.5 right-1.5 bg-rose-500 rounded-full p-0.5">
            <MicOff className="w-2.5 h-2.5 text-white" />
          </div>
        )}
        <div className="absolute bottom-1.5 left-0 right-0 text-center">
          <span className="text-[8px] text-white/50 font-bold">You</span>
        </div>
      </motion.div>

      {/* ─── Top bar (auto-hides) ─── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[8px] bg-red-500 text-white font-black tracking-widest px-2 py-0.5 rounded uppercase animate-pulse">
                  LIVE
                </span>
                {connected && (
                  <span className="text-white font-bold text-sm">{remoteName}</span>
                )}
              </div>
              {remoteSpecialty && connected && (
                <p className="text-white/50 text-xs font-medium">{remoteSpecialty}</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
                <span className="text-white text-xs font-mono font-bold tracking-wider">
                  {fmt(callDuration)}
                </span>
              </div>
              {connBadge()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Bottom controls (auto-hides) ─── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 p-5 flex justify-center items-center gap-3 z-20"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}
          >
            {/* Mute */}
            <button
              onClick={toggleAudio}
              title={audioEnabled ? "Mute" : "Unmute"}
              className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                audioEnabled
                  ? "bg-white/15 border-white/20 text-white hover:bg-white/25"
                  : "bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-500/30"
              }`}
            >
              {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            {/* Screen share */}
            <button
              onClick={toggleScreenShare}
              title={isScreenSharing ? "Stop sharing" : "Share screen"}
              className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                isScreenSharing
                  ? "bg-primary border-primary/70 text-white shadow-lg shadow-primary/30"
                  : "bg-white/15 border-white/20 text-white hover:bg-white/25"
              }`}
            >
              {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>

            {/* End call — largest button */}
            <button
              onClick={handleEndCall}
              title="End call"
              className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 border-2 border-rose-600/50 flex items-center justify-center text-white shadow-xl shadow-rose-500/40 transition-all duration-200 hover:scale-105"
            >
              <PhoneOff className="w-5 h-5" />
            </button>

            {/* Toggle camera */}
            <button
              onClick={toggleVideo}
              title={videoEnabled ? "Turn off camera" : "Turn on camera"}
              className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                videoEnabled
                  ? "bg-white/15 border-white/20 text-white hover:bg-white/25"
                  : "bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-500/30"
              }`}
            >
              {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen((f) => !f)}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="w-11 h-11 rounded-full flex items-center justify-center border-2 bg-white/15 border-white/20 text-white hover:bg-white/25 transition-all duration-200"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Connection quality indicator (always visible) ─── */}
      {connected && !showControls && (
        <div className="absolute top-3 right-3 z-20 opacity-50">
          <Wifi className="w-3 h-3 text-emerald-400" />
        </div>
      )}
    </div>
  );
}
