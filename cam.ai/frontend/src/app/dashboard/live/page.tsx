"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import WebRTCPlayer from "@/components/camera/WebRTCPlayer";
import type { WebRTCPlayerHandle } from "@/components/camera/WebRTCPlayer";
import GridLayoutSelector from "@/components/camera/GridLayoutSelector";
import { useCamera } from "@/hooks/useCamera";
import { useTranslation } from "react-i18next";
import offlineCameraImg from "@/assets/offline_camera.webp";

export default function LiveViewPage() {
  const { t } = useTranslation();
  const { cameras, total, fetchCameras, isLoading } = useCamera();
  const [layout, setLayout] = useState<1 | 4 | 9>(4);
  const [gridPage, setGridPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 100;

  // Refs for WebRTC players (keyed by camera id)
  const playerRefs = useRef<Record<string, WebRTCPlayerHandle | null>>({});

  const captureSnapshot = useCallback((cameraId: string, cameraName: string) => {
    const handle = playerRefs.current[cameraId];
    if (!handle) return;
    const video = handle.getVideoElement();
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const link = document.createElement("a");
    const ts = new Date().toLocaleString("vi-VN").replace(/[/:, ]/g, "_");
    link.download = `snapshot_${cameraName}_${ts}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const searchParams = useSearchParams();
  const cameraIdFromUrl = searchParams.get("cameraId");

  useEffect(() => {
    fetchCameras(0, limit, searchQuery);
  }, [fetchCameras, searchQuery]);

  // Handle URL cameraId param
  useEffect(() => {
    if (cameras.length > 0 && cameraIdFromUrl) {
      const idx = cameras.findIndex((c) => c.id === cameraIdFromUrl);
      if (idx !== -1) {
        setLayout(1);
        setGridPage(idx + 1);
      }
    } else if (cameras.length > 0 && !cameraIdFromUrl && gridPage === 1) {
       // Only reset grid page if we are not handling URL param
    }
  }, [cameras, cameraIdFromUrl]);

  const handleFullscreen = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen();
      }
    }
  };

  const handleCameraClick = (idx: number) => {
    const newPage = Math.floor(idx / layout) + 1;
    setGridPage(newPage);
  };

  const totalGridPages = Math.ceil(cameras.length / layout) || 1;
  const displayedCameras = cameras.slice((gridPage - 1) * layout, gridPage * layout);
  const onlineCamerasCount = cameras.filter(c => c.status === "online").length;

  // Make sure gridPage is valid if cameras change
  useEffect(() => {
    if (gridPage > totalGridPages && totalGridPages > 0) {
      setGridPage(totalGridPages);
    }
  }, [totalGridPages, gridPage]);

  return (
    <div className="flex flex-col xl:flex-row gap-6 xl:h-[calc(100vh-8rem)] animate-in fade-in duration-300">
      {/* Left: Device Tree Sidebar */}
      <section className="bg-surface rounded-2xl shadow-ambient flex flex-col w-full xl:w-72 shrink-0 overflow-hidden border border-outline-variant/30 order-2 xl:order-1 h-[40vh] xl:h-auto">
        <div className="p-4 border-b border-outline-variant/30 bg-surface-variant/20">
          <h2 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">video_camera_front</span>
            {t('live.cameraList')}
          </h2>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-sm">search</span>
            <input 
              type="text" 
              placeholder={t('live.searchPlaceholder')} 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setGridPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-surface text-sm rounded-xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface placeholder-on-surface-variant"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
            </div>
          ) : (
            cameras.map((cam, idx) => {
              const isCurrentlyDisplayed = displayedCameras.some(c => c.id === cam.id);
              return (
                <div 
                  key={cam.id}
                  onClick={() => handleCameraClick(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors mb-1 ${
                    isCurrentlyDisplayed 
                      ? "bg-primary/10 border border-primary/20" 
                      : "hover:bg-surface-variant/30 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${cam.status === "online" ? "bg-green-500" : "bg-error"}`}></div>
                    <span className={`text-sm truncate ${isCurrentlyDisplayed ? "font-semibold text-primary" : "text-on-surface"}`}>
                      {cam.name}
                    </span>
                  </div>
                  {isCurrentlyDisplayed && (
                    <span className="material-symbols-outlined text-primary text-sm shrink-0">visibility</span>
                  )}
                </div>
              );
            })
          )}
        </div>
        {/* Pagination controls on sidebar removed, moved to grid */}
      </section>

      {/* Right: Video Grid Canvas */}
      <section className="flex-1 flex flex-col min-w-0 order-1 xl:order-2 min-h-[50vh] xl:min-h-0">
        <GridLayoutSelector 
          currentLayout={layout} 
          onLayoutChange={(l) => {
            setLayout(l);
            setGridPage(1);
          }}
          activeCameraCount={onlineCamerasCount}
        />

        <div className="flex-1 bg-black rounded-2xl shadow-ambient overflow-hidden border border-outline-variant/30 relative p-1">
          {displayedCameras.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
              <span className="material-symbols-outlined text-6xl mb-4 opacity-50">videocam_off</span>
              <p>{t('live.noCameraSelected')}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col w-full h-full p-1 relative">
              <div 
                className={`w-full h-full grid gap-1 ${
                  layout === 1 ? "grid-cols-1" : 
                  layout === 4 ? "grid-cols-2 grid-rows-2" : 
                  "grid-cols-3 grid-rows-3"
                }`}
              >
                {/* Render selected cameras */}
                {displayedCameras.map((cam, idx) => (
                  <div id={`camera-container-${cam.id}`} key={`${cam.id}-${idx}`} className="relative bg-surface-variant/10 rounded-xl overflow-hidden group">
                    <WebRTCPlayer 
                      ref={(el) => { playerRefs.current[cam.id] = el; }}
                      whepUrl={cam.stream_hd || cam.stream_sd || ""}
                      className="w-full h-full"
                    />
                    
                    {/* Overlay Info */}
                    <div className="absolute top-0 left-0 w-full p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <div className="flex items-center gap-2 text-white">
                        <span className={`w-2 h-2 rounded-full ${cam.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-error'}`}></span>
                        <span className="text-sm font-medium text-shadow-sm">{cam.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleFullscreen(`camera-container-${cam.id}`)}
                          className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-primary transition-colors backdrop-blur-sm" 
                          title="Fullscreen"
                        >
                          <span className="material-symbols-outlined text-[18px]">fullscreen</span>
                        </button>
                        <button 
                          onClick={() => captureSnapshot(cam.id, cam.name)}
                          className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-primary transition-colors backdrop-blur-sm" 
                          title={t('live.snapshot')}
                        >
                          <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Empty slots */}
                {Array.from({ length: layout - displayedCameras.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-surface-variant/10 rounded-xl flex flex-col items-center justify-center border border-dashed border-outline-variant/30 opacity-60">
                    <Image src={offlineCameraImg} alt="Empty slot" className="w-16 h-16 object-contain mb-2 opacity-30" />
                    <span className="text-on-surface-variant/50 text-sm font-medium">Chưa gán camera</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid Pagination Controls */}
          {totalGridPages > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-surface/90 backdrop-blur border border-outline-variant/30 px-4 py-2 rounded-full shadow-ambient z-20">
              <button 
                disabled={gridPage === 1}
                onClick={() => setGridPage(p => p - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">arrow_back_ios_new</span>
              </button>
              <span className="text-sm font-semibold text-on-surface min-w-[3rem] text-center">
                {gridPage} / {totalGridPages}
              </span>
              <button 
                disabled={gridPage === totalGridPages}
                onClick={() => setGridPage(p => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">arrow_forward_ios</span>
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
