"use client";

import React, { useEffect, useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { AIEvent } from "@/types";

function Toast({ event, onClose }: { event: AIEvent; onClose: () => void }) {
  // Tự động ẩn sau 5 giây
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="bg-surface border border-error/30 shadow-xl rounded-xl p-4 w-80 mb-3 animate-in slide-in-from-right-8 fade-in flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-error">
          <span className="material-symbols-outlined">warning</span>
          <h4 className="font-bold">Phát hiện đối tượng</h4>
        </div>
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
      
      <p className="text-sm text-on-surface-variant">
        Phát hiện người tại camera <span className="font-semibold text-on-surface">{event.camera_name}</span>.
      </p>
      
      {event.snapshot_url && (
        <div className="w-full h-32 rounded-lg overflow-hidden bg-black mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={event.snapshot_url} 
            alt="AI Snapshot" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="text-xs text-on-surface-variant mt-1 text-right">
        {new Date(event.created_at).toLocaleTimeString("vi-VN")}
      </div>
    </div>
  );
}

export default function NotificationToastManager() {
  const { latestEvent } = useNotifications();
  const [visibleEvents, setVisibleEvents] = useState<AIEvent[]>([]);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  // Khi có event mới, thêm vào danh sách hiển thị
  useEffect(() => {
    if (latestEvent && latestEvent.id !== lastEventId) {
      setLastEventId(latestEvent.id);
      setVisibleEvents((prev) => [latestEvent, ...prev].slice(0, 3)); // Hiện tối đa 3 popup cùng lúc
    }
  }, [latestEvent, lastEventId]);

  const removeToast = (id: string) => {
    setVisibleEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {visibleEvents.map((ev) => (
        <Toast key={ev.id} event={ev} onClose={() => removeToast(ev.id)} />
      ))}
    </div>
  );
}
