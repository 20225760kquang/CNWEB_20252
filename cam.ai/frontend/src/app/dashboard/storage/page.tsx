"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE_URL } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface ClipExport {
  id: string;
  camera_name: string;
  clip_start: string;
  clip_end: string;
  status: "processing" | "ready" | "expired";
  created_at: string;
  download_url: string | null;
}

interface ClipsResponse {
  clips: ClipExport[];
  total: number;
}

const PAGE_LIMIT = 10;

const statusMeta: Record<ClipExport["status"], { label: string; variant: "success" | "warning" | "danger"; icon?: string }> = {
  ready: { label: "Sẵn sàng", variant: "success" },
  processing: { label: "Đang xử lý...", variant: "warning", icon: "sync" },
  expired: { label: "Lỗi/Hết hạn", variant: "danger" },
};

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === "object" && "detail" in err) {
    return String((err as { detail?: string }).detail || fallback);
  }
  return fallback;
};

export default function StoragePage() {
  const [clips, setClips] = useState<ClipExport[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const hasProcessing = useRef(false);

  const [page, setPage] = useState(1);

  // Modals state
  const [deleteClipId, setDeleteClipId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null);

  // Authentication token for direct download endpoint
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";

  const getDownloadUrl = useCallback((clipId: string) => {
    return `${API_BASE_URL}/api/clips/${clipId}/download?token=${token}`;
  }, [token]);

  const fetchClips = useCallback(async (pageIndex: number) => {
    setIsLoading(true);
    setError("");
    try {
      const skip = (pageIndex - 1) * PAGE_LIMIT;
      const res = await api.get<ClipsResponse>(`/api/clips?skip=${skip}&limit=${PAGE_LIMIT}`);
      setClips(res.clips);
      setTotal(res.total);
      hasProcessing.current = res.clips.some(c => c.status === "processing");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Không thể tải danh sách video đã lưu."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteClick = (clipId: string) => {
    setDeleteClipId(clipId);
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteClipId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/clips/${deleteClipId}`);
      setDeleteClipId(null);
      fetchClips(page);
    } catch (err: unknown) {
      setErrorModalMessage(getErrorMessage(err, "Không thể xóa video."));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteClipId, fetchClips, page]);

  useEffect(() => {
    fetchClips(page);
  }, [fetchClips, page]);

  // Auto-refresh only when there are processing clips
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasProcessing.current) {
        fetchClips(page);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchClips, page]);

  const totalPages = Math.ceil(total / PAGE_LIMIT) || 1;
  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === deleteClipId),
    [clips, deleteClipId]
  );

  const getDuration = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = Math.max(0, e - s);
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}p ${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-on-surface mb-1">Quản lý Lưu trữ (Video đã xuất)</h2>
          <p className="text-sm text-on-surface-variant">Xem và tải xuống các video clip đã được trích xuất từ camera.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-error bg-error-container/20 rounded-xl">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-2xl border border-outline-variant/30 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-4">progress_activity</span>
          <p>Đang tải dữ liệu...</p>
        </div>
      ) : clips.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-2xl border border-outline-variant/30 text-on-surface-variant">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-50">movie</span>
          <p className="text-lg font-medium mb-2">Chưa có video nào được xuất</p>
          <p className="text-sm opacity-70">Vào trang <strong>Xem lại</strong>, chọn camera rồi nhấn biểu tượng <span className="material-symbols-outlined text-[14px] align-middle">content_cut</span> để cắt clip.</p>
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-xl border border-outline-variant/30 overflow-hidden shadow-ambient">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="border-b border-outline-variant/50 bg-surface-variant/20">
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tên Camera</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Thời gian xuất</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Đoạn video</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Thời lượng</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Trạng thái</th>
                    <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {clips.map((item) => (
                    <tr key={item.id} className="group hover:bg-surface-variant/10 transition-colors">
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-surface-variant/50 flex items-center justify-center text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm">videocam</span>
                          </div>
                          <span className="font-semibold text-on-surface text-sm">{item.camera_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-6 text-sm text-on-surface">{new Date(item.created_at).toLocaleString("vi-VN")}</td>
                      <td className="py-3 px-6 text-sm text-on-surface-variant">
                        {new Date(item.clip_start).toLocaleTimeString("vi-VN")} - {new Date(item.clip_end).toLocaleTimeString("vi-VN")}
                      </td>
                      <td className="py-3 px-6 font-mono text-sm text-on-surface-variant">{getDuration(item.clip_start, item.clip_end)}</td>
                      <td className="py-3 px-6">
                        <Badge variant={statusMeta[item.status].variant} icon={statusMeta[item.status].icon}>
                          {statusMeta[item.status].label}
                        </Badge>
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2">
                           {item.status === "ready" ? (
                            <a
                              href={getDownloadUrl(item.id)}
                              download={`clip_${item.camera_name}.mp4`}
                              className="p-2 rounded-full hover:bg-primary/10 text-primary transition-colors flex items-center"
                              title="Tải xuống"
                            >
                              <span className="material-symbols-outlined text-[18px]">download</span>
                            </a>
                          ) : (
                            <button type="button" aria-label="Video chưa sẵn sàng để tải" className="p-2 rounded-full text-on-surface-variant/50 cursor-not-allowed flex items-center" disabled>
                              <span className="material-symbols-outlined text-[18px]">download</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(item.id)}
                            className="p-2 rounded-full hover:bg-error/10 text-error/70 hover:text-error transition-colors flex items-center"
                            title="Xóa video"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {total > PAGE_LIMIT && (
            <div className="flex justify-end">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={deleteClipId !== null}
        onClose={() => setDeleteClipId(null)}
        title="Xác nhận xóa video"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDeleteClipId(null)}
              disabled={isDeleting}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              isLoading={isDeleting}
            >
              Xóa video
            </Button>
          </>
        }
      >
        <p className="text-on-surface-variant text-sm">
          Bạn có chắc chắn muốn xóa video {selectedClip ? `"${selectedClip.camera_name}"` : "này"} không? Thao tác này sẽ xóa tệp vĩnh viễn khỏi lưu trữ đám mây và không thể khôi phục lại.
        </p>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalMessage !== null}
        onClose={() => setErrorModalMessage(null)}
        title="Có lỗi xảy ra"
        footer={
          <Button
            variant="primary"
            onClick={() => setErrorModalMessage(null)}
          >
            Đóng
          </Button>
        }
      >
        <p className="text-on-surface-variant text-sm">
          {errorModalMessage}
        </p>
      </Modal>
    </div>
  );
}
