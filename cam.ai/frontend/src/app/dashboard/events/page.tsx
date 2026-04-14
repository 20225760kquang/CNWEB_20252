"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AIEvent } from "@/types";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import { useTranslation } from "react-i18next";

interface EventsResponse {
  events: AIEvent[];
  total: number;
}

export default function EventsPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<AIEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [page, setPage] = useState(1);
  const limit = 12;

  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchEvents = async (pageIndex: number) => {
    setIsLoading(true);
    setError("");
    try {
      const skip = (pageIndex - 1) * limit;
      let url = `/api/events?skip=${skip}&limit=${limit}&event_type=person_detected`;
      if (startTime) {
        url += `&start_time=${new Date(startTime).toISOString()}`;
      }
      if (endTime) {
        url += `&end_time=${new Date(endTime).toISOString()}`;
      }
      const res = await api.get<EventsResponse>(url);
      setEvents(res.events);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.detail || "Không thể tải danh sách sự kiện");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(page);
  }, [page]);

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa vĩnh viễn sự kiện này không? (Bao gồm cả ảnh trên MinIO)")) return;
    
    setIsDeleting(true);
    try {
      await api.delete(`/api/events/${id}`);
      fetchEvents(page);
    } catch (err: any) {
      alert(err.detail || "Không thể xóa sự kiện");
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface mb-1">{t('events.title')}</h2>
          <p className="text-sm text-on-surface-variant">{t('events.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-surface p-3 rounded-xl border border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-on-surface">Từ:</span>
            <input 
              type="datetime-local" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="text-sm bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-on-surface">Đến:</span>
            <input 
              type="datetime-local" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="text-sm bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button 
            onClick={() => { if (page === 1) fetchEvents(1); else setPage(1); }}
            className="bg-primary text-on-primary px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Lọc
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-error bg-error-container/20 rounded-xl">
          {error}
        </div>
      )}

      {isLoading && events.length === 0 ? (
        <div className="flex justify-center p-12">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-2xl border border-outline-variant/30 text-on-surface-variant">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-50">event_note</span>
          <p>{t('events.noEvents')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {events.map((ev) => (
              <div key={ev.id} className="bg-surface rounded-2xl border border-outline-variant/30 overflow-hidden hover:border-primary/50 transition-colors shadow-sm group">
                <div 
                  className="aspect-video bg-black relative cursor-pointer overflow-hidden"
                  onClick={() => ev.snapshot_url && setSelectedImage(ev.snapshot_url)}
                >
                  {ev.snapshot_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={ev.snapshot_url} 
                      alt="Snapshot" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-3xl">image_not_supported</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-error text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-md">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    {t('events.detectPerson')}
                  </div>
                  <div className="absolute top-2 left-2 z-10">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                      disabled={isDeleting}
                      className="bg-surface hover:bg-error hover:text-white text-on-surface-variant hover:text-white p-1.5 rounded-md transition-colors shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="Xóa sự kiện"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-sm">videocam</span>
                    <span className="font-semibold text-on-surface text-sm truncate">{ev.camera_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {new Date(ev.created_at).toLocaleString("vi-VN")}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-surface p-4 rounded-xl border border-outline-variant/30 mt-6">
            <span className="text-sm text-on-surface-variant">
              {t('events.showing', { start: (page - 1) * limit + 1, end: Math.min(page * limit, total), total })}
            </span>
            {total > limit && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </div>
        </>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <Modal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          title={t('events.imageDetails')}
          maxWidth="4xl"
        >
          <div className="mt-2 rounded-xl overflow-hidden bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImage} alt="Full size" className="w-full h-auto max-h-[70vh] object-contain" />
          </div>
        </Modal>
      )}
    </div>
  );
}
