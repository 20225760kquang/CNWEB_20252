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

    let hls: Hls;

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

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDuration);

    if (Hls.isSupported()) {
      hls = new Hls({
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

      hls.loadSource(playlistUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setError(null);
        if (autoPlay) {
          video.play().catch((e) => {
            console.warn("Auto-play prevented", e);
            video.muted = true;
            video.play().catch(console.error);
          });
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        const hlsAny = hls as any;
        hlsAny.mediaErrorCount = 0;
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError("Lỗi mạng khi tải video");
              if (data.response && data.response.code === 401) {
                setTimeout(() => hls.startLoad(), 2000);
              } else {
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("HLS Media Error, attempting recovery...");
              const hlsAny = hls as any;
              if (!hlsAny.mediaErrorCount) hlsAny.mediaErrorCount = 0;
              hlsAny.mediaErrorCount++;
              
              if (hlsAny.mediaErrorCount === 1) {
                hls.recoverMediaError();
              } else if (hlsAny.mediaErrorCount === 2) {
                hls.swapAudioCodec();
                hls.recoverMediaError();
              } else {
                console.error("Cannot recover from media error");
                hls.destroy();
                setError("Trình duyệt không hỗ trợ định dạng video này (có thể là H.265). Vui lòng cấu hình lại luồng camera sang chuẩn H.264.");
              }
              break;
            default:
              hls.destroy();
              setError("Không thể phát video này");
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playlistUrl;
      video.addEventListener("loadedmetadata", () => {
        if (autoPlay) {
          video.play().catch(console.error);
        }
      });
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
          <span className="material-symbols-outlined text-4xl mb-2">play_disabled</span>
          <span className="text-sm">Chưa có nguồn phát</span>
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
