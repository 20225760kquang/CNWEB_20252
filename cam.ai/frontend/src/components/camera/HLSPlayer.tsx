"use client";

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import Hls from "hls.js";

interface HLSPlayerProps {
  playlistUrl: string;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  onTimeUpdate?: (time: number) => void;
  onDuration?: (duration: number) => void;
  seekToSeconds?: number;
}

export interface HLSPlayerHandle {
  getVideoElement: () => HTMLVideoElement | null;
}

const HLSPlayer = forwardRef<HLSPlayerHandle, HLSPlayerProps>(({
  playlistUrl,
  autoPlay = true,
  muted = false,
  className = "",
  onTimeUpdate,
  onDuration,
  seekToSeconds,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationRef = useRef(onDuration);

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }));

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onDurationRef.current = onDuration;
  }, [onTimeUpdate, onDuration]);

  useEffect(() => {
    if (seekToSeconds !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekToSeconds;
    }
  }, [seekToSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playlistUrl) return;

    let hls: Hls | null = null;
    let mediaErrorCount = 0;
    setError(null);
    setIsLoading(true);

    const handleTimeUpdate = () => {
      if (onTimeUpdateRef.current && video.currentTime) {
        onTimeUpdateRef.current(video.currentTime);
      }
    };

    const handleDuration = () => {
      if (onDurationRef.current && video.duration) {
        onDurationRef.current(video.duration);
      }
    };

    const playVideo = () => {
      video.play().catch((e) => {
        console.warn("Auto-play prevented", e);
        video.muted = true;
        video.play().catch((playError) => {
          console.warn("Muted auto-play failed", playError);
        });
      });
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDuration);

    if (Hls.isSupported()) {
      const hlsInstance = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        xhrSetup: (xhr, url) => {
          if (url.includes("/api/")) {
            const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
            if (token) {
              xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            }
          }
        },
      });
      hls = hlsInstance;

      hlsInstance.loadSource(playlistUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        setError(null);
        setIsLoading(false);
        if (autoPlay) {
          playVideo();
        }
      });

      hlsInstance.on(Hls.Events.FRAG_BUFFERED, () => {
        mediaErrorCount = 0;
      });

      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setIsLoading(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError("Lỗi mạng khi tải video");
              if (data.response && data.response.code === 401) {
                setTimeout(() => hlsInstance.startLoad(), 2000);
              } else {
                hlsInstance.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("HLS Media Error, attempting recovery...");
              mediaErrorCount += 1;
              
              if (mediaErrorCount === 1) {
                hlsInstance.recoverMediaError();
              } else if (mediaErrorCount === 2) {
                hlsInstance.swapAudioCodec();
                hlsInstance.recoverMediaError();
              } else {
                console.warn("Cannot recover from media error");
                hlsInstance.destroy();
                setError("Trình duyệt không hỗ trợ định dạng video này (có thể là H.265). Vui lòng cấu hình lại luồng camera sang chuẩn H.264.");
              }
              break;
            default:
              hlsInstance.destroy();
              setError("Không thể phát video này");
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playlistUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        if (autoPlay) {
          playVideo();
        }
      });
    } else {
      setIsLoading(false);
      setError("Trình duyệt không hỗ trợ phát HLS.");
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDuration);
      if (hls) {
        hls.destroy();
      }
    };
  }, [playlistUrl, autoPlay]);

  return (
    <div className={`relative bg-black flex items-center justify-center overflow-hidden ${className}`}>
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-error bg-black/80 z-10 p-4 text-center">
          <span className="material-symbols-outlined text-3xl mb-2">error</span>
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      {!playlistUrl && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 z-10">
          <span aria-hidden="true" className="material-symbols-outlined text-4xl mb-2">play_disabled</span>
          <span className="text-sm">Chưa có nguồn phát</span>
        </div>
      )}

      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 bg-black/40 z-10">
          <span aria-hidden="true" className="material-symbols-outlined animate-spin text-4xl mb-2">progress_activity</span>
          <span className="text-sm">Đang tải video...</span>
        </div>
      )}

      <video
        ref={videoRef}
        muted={muted}
        controls
        playsInline
        className="w-full h-full object-contain"
      />
    </div>
  );
});

HLSPlayer.displayName = "HLSPlayer";

export default HLSPlayer;
