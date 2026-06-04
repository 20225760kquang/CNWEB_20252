"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCamera } from "@/hooks/useCamera";
import { useRecording } from "@/hooks/useRecording";
import { API_BASE_URL } from "@/lib/api";
import HLSPlayer from "@/components/camera/HLSPlayer";
import type { HLSPlayerHandle } from "@/components/camera/HLSPlayer";
import Timeline from "@/components/camera/Timeline";
import ClipExportModal from "@/components/camera/ClipExportModal";
import { useTranslation } from "react-i18next";

export default function PlaybackIndexPage() {
  const { t } = useTranslation();
  const { cameras, fetchCameras } = useCamera();
  const { recordings, fetchRecordings, isLoading: isLoadingRecordings } = useRecording();

  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState<Date | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Clip export modal state
  const [isClipModalOpen, setIsClipModalOpen] = useState(false);

  // HLS player ref for snapshot
  const hlsPlayerRef = useRef<HLSPlayerHandle>(null);

  const captureSnapshot = useCallback(() => {
    const handle = hlsPlayerRef.current;
    if (!handle) return;
    const video = handle.getVideoElement();
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const camName = cameras.find(c => c.id === selectedCameraId)?.name || "camera";
    const ts = new Date().toLocaleString("vi-VN").replace(/[/:, ]/g, "_");
    const link = document.createElement("a");
    link.download = `snapshot_${camName}_${ts}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [cameras, selectedCameraId]);

  // Load cameras on mount
  useEffect(() => {
    fetchCameras(0, 100, "");
  }, [fetchCameras]);

  // Select first camera automatically if none selected
  useEffect(() => {
    if (cameras.length > 0 && !selectedCameraId) {
      setSelectedCameraId(cameras[0].id);
    }
  }, [cameras, selectedCameraId]);

  // Fetch recordings when camera changes and auto-refresh
  useEffect(() => {
    if (selectedCameraId) {
      fetchRecordings(selectedCameraId, 0, 100);
      setCurrentRecordingId(null);
      setPlaybackTime(null);

      // Auto refresh every 30 seconds to fetch new recording status
      const interval = setInterval(() => {
        fetchRecordings(selectedCameraId, 0, 100);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [selectedCameraId, fetchRecordings]);

  const [seekTarget, setSeekTarget] = useState<number | undefined>(undefined);

  // Handle timeline seek
  const handleSeek = (time: Date, recordingId: string | null) => {
    setPlaybackTime(time);
    
    if (recordingId) {
      const rec = recordings.find(r => r.id === recordingId);
      if (rec) {
        const offsetSeconds = (time.getTime() - new Date(rec.start_time).getTime()) / 1000;
        
        if (recordingId !== currentRecordingId) {
          setCurrentRecordingId(recordingId);
        }
        setSeekTarget(Math.max(0, offsetSeconds));
      }
    } else {
      setCurrentRecordingId(null);
    }
  };

  const handleTimeUpdate = (timeInSeconds: number) => {
    if (currentRecordingId) {
      const rec = recordings.find(r => r.id === currentRecordingId);
      if (rec) {
        const newTime = new Date(new Date(rec.start_time).getTime() + timeInSeconds * 1000);
        setPlaybackTime(newTime);
      }
    }
  };

  const playlistUrl = currentRecordingId ? `${API_BASE_URL}/api/recordings/${currentRecordingId}/playlist.m3u8` : "";

  const currentRecording = currentRecordingId ? recordings.find(r => r.id === currentRecordingId) || null : null;
  const selectedCamera = cameras.find(c => c.id === selectedCameraId);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300 gap-6">
      {/* Top Bar: Camera Selection + Clip button */}
      <div className="bg-surface rounded-2xl shadow-ambient border border-outline-variant/30 p-4 flex items-center justify-between shrink-0">
        <h2 className="text-xl font-bold text-on-surface">Xem lại</h2>
        
        <div className="flex items-center gap-3">
          {/* Clip export button */}
          <button
            onClick={() => setIsClipModalOpen(true)}
            disabled={!currentRecordingId}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              currentRecordingId
                ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
                : "bg-surface-variant/30 text-on-surface-variant/50 cursor-not-allowed border border-outline-variant/30"
            }`}
            title="Cắt video clip"
          >
            <span className="material-symbols-outlined text-[20px]">content_cut</span>
            <span className="hidden sm:inline">Cắt clip</span>
          </button>

          {/* Snapshot button */}
          <button
            onClick={captureSnapshot}
            disabled={!currentRecordingId}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              currentRecordingId
                ? "bg-surface-variant/40 text-on-surface hover:bg-surface-variant/60 border border-outline-variant/50"
                : "bg-surface-variant/30 text-on-surface-variant/50 cursor-not-allowed border border-outline-variant/30"
            }`}
            title="Chụp ảnh màn hình"
          >
            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
            <span className="hidden sm:inline">Chụp ảnh</span>
          </button>

          {/* Camera selector */}
          <div className="relative w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-sm">search</span>
            <select 
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="w-full pl-9 pr-10 py-2 bg-surface-variant/20 text-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface appearance-none cursor-pointer"
            >
              <option value="" disabled>Tìm kiếm camera...</option>
              {cameras.map(cam => (
                <option key={cam.id} value={cam.id}>{cam.name}</option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant pointer-events-none">expand_more</span>
          </div>
        </div>
      </div>

      {/* Main Video Player */}
      <div className="flex-1 bg-black rounded-2xl shadow-ambient overflow-hidden border border-outline-variant/30 relative">
        {playlistUrl ? (
          <HLSPlayer 
            ref={hlsPlayerRef}
            playlistUrl={playlistUrl}
            autoPlay={true}
            onTimeUpdate={handleTimeUpdate}
            seekToSeconds={seekTarget}
            className="w-full h-full"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">history</span>
            <p>Chọn một mốc thời gian trên thước để xem lại</p>
          </div>
        )}
      </div>

      {/* Timeline Control */}
      <div className="shrink-0">
        <Timeline 
          recordings={recordings}
          windowHours={6}
          currentPlaybackTime={playbackTime}
          onSeek={handleSeek}
        />
      </div>

      {/* Clip Export Modal */}
      <ClipExportModal
        isOpen={isClipModalOpen}
        onClose={() => setIsClipModalOpen(false)}
        recording={currentRecording}
        cameraName={selectedCamera?.name || ""}
        currentTime={playbackTime}
      />
    </div>
  );
}
