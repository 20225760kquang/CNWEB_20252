"use client";

import React, { useEffect, forwardRef, useImperativeHandle } from "react";
import Image from "next/image";
import { useWebRTC } from "@/hooks/useWebRTC";
import offlineCameraImg from "@/assets/offline_camera.webp";

interface WebRTCPlayerProps {
  whepUrl: string;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  onStateChange?: (state: string) => void;
}

export interface WebRTCPlayerHandle {
  getVideoElement: () => HTMLVideoElement | null;
}

const WebRTCPlayer = forwardRef<WebRTCPlayerHandle, WebRTCPlayerProps>(({
  whepUrl,
  autoPlay = true,
  muted = true,
  className = "",
  onStateChange,
}, ref) => {
  const { videoRef, connectionState, error, connect, disconnect } = useWebRTC();

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }));

  useEffect(() => {
    if (whepUrl) {
      connect(whepUrl);
    }
    return () => disconnect();
  }, [whepUrl, connect, disconnect]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange(connectionState);
    }
  }, [connectionState, onStateChange]);

  return (
    <div className={`relative bg-black flex items-center justify-center overflow-hidden ${className}`}>
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-error bg-black/80 z-10 p-4 text-center">
          <Image src={offlineCameraImg} alt="Error" className="w-20 h-20 object-contain mb-3 opacity-60" />
          <span className="text-sm font-medium">Lỗi kết nối WebRTC</span>
          <span className="text-xs text-error/70 mt-1">{error}</span>
          <button 
            onClick={() => connect(whepUrl)}
            className="mt-4 px-4 py-2 bg-surface-variant text-on-surface-variant rounded-full text-xs font-semibold hover:bg-surface transition-colors"
          >
            Thử lại
          </button>
        </div>
      ) : connectionState === "connecting" || connectionState === "new" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 z-10">
          <span className="material-symbols-outlined animate-spin text-3xl mb-2">progress_activity</span>
          <span className="text-xs font-mono tracking-wider">CONNECTING...</span>
        </div>
      ) : null}

      <video
        ref={videoRef}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        className="w-full h-full object-contain"
      />
    </div>
  );
});

WebRTCPlayer.displayName = "WebRTCPlayer";

export default WebRTCPlayer;
