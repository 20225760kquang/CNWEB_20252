"use client";

import React, { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import { useRouter } from "next/navigation";
import { useCamera } from "@/hooks/useCamera";
import { api } from "@/lib/api";
import { AIEvent } from "@/types";

export default function UserHomePage() {
  const router = useRouter();
  const { cameras, fetchCameras, isLoading: isLoadingCameras } = useCamera();
  const [events, setEvents] = useState<AIEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  useEffect(() => {
    fetchCameras(0, 100, "");
    
    const fetchEvents = async () => {
      try {
        const res = await api.get<{events: AIEvent[], total: number}>("/api/events?skip=0&limit=10");
        setEvents(res.events || []);
      } catch (err) {
        console.error("Failed to fetch events", err);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    
    fetchEvents();
  }, [fetchCameras]);

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-8rem)] animate-in fade-in duration-300">
      {/* Left: Notifications Panel */}
      <section className="bg-surface rounded-2xl p-6 shadow-ambient flex flex-col xl:w-80 shrink-0">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/30">
          <h2 className="text-lg font-semibold text-on-surface">Thông báo gần đây</h2>
          <Badge variant="primary">{events.length}</Badge>
        </div>
        <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
          {isLoadingEvents ? (
            <div className="flex justify-center p-4"><span className="material-symbols-outlined animate-spin text-primary">progress_activity</span></div>
          ) : events.length === 0 ? (
            <div className="text-center text-on-surface-variant p-4">Không có thông báo nào</div>
          ) : events.map((notif) => (
            <div key={notif.id} className="p-3 bg-surface-variant/20 rounded-xl border border-outline-variant/30 hover:bg-surface-variant/40 transition-colors cursor-pointer">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs text-on-surface-variant">{new Date(notif.created_at).toLocaleTimeString("vi-VN")}</span>
                {/* <div className="w-1.5 h-1.5 bg-accent-blue rounded-full"></div> */}
              </div>
              <h3 className="font-semibold text-sm text-on-surface mb-1">
                {notif.event_type === "person_detected" ? "Phát hiện có người" : 
                 notif.event_type === "camera_offline" ? "Mất kết nối" : "Sự kiện AI"}
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Camera {notif.camera_name} vào lúc {new Date(notif.created_at).toLocaleString("vi-VN")}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Right: Devices Panel */}
      <section className="bg-surface rounded-2xl p-6 shadow-ambient flex flex-col flex-1">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/30">
          <h2 className="text-xl font-semibold text-on-surface">Thiết bị của tôi</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoadingCameras ? (
             <div className="flex justify-center p-4"><span className="material-symbols-outlined animate-spin text-primary">progress_activity</span></div>
          ) : cameras.length === 0 ? (
             <div className="text-center text-on-surface-variant p-4">Bạn chưa được cấp quyền truy cập thiết bị nào.</div>
          ) : (
            <>
              {/* Group by DVR or just list them. We'll list them since we don't have DVR grouping in model yet */}
              <div className="space-y-2">
                {cameras.map((device) => (
                  <div 
                    key={device.id} 
                    onClick={() => router.push(`/dashboard/live?cameraId=${device.id}`)}
                    className="group flex items-center justify-between p-3 rounded-xl hover:bg-surface-variant/30 transition-colors cursor-pointer border border-transparent hover:border-outline-variant/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-variant/50 flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-lg">videocam</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-on-surface">{device.name}</span>
                        <span className="text-xs flex items-center gap-1 mt-0.5 text-on-surface-variant">
                          <span className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-error'}`}></span>
                          {device.status === 'online' ? 'Trực tuyến' : 'Ngoại tuyến'}
                        </span>
                      </div>
                    </div>
                    <button className="material-symbols-outlined text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      arrow_forward_ios
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
