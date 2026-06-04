"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import type { RecordingResponse } from "@/types";

interface ClipExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recording: RecordingResponse | null;
  cameraName: string;
  currentTime: Date | null;
}

const MAX_CLIP_SECONDS = 10 * 60;

function formatTime(date: Date): string {
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m} phút ${s < 10 ? "0" : ""}${s} giây`;
}

export default function ClipExportModal({
  isOpen,
  onClose,
  recording,
  cameraName,
  currentTime,
}: ClipExportModalProps) {
  const router = useRouter();

  const recStart = recording ? new Date(recording.start_time).getTime() : 0;
  const recEnd = recording
    ? recording.end_time
      ? new Date(recording.end_time).getTime()
      : Date.now()
    : 0;
  const recDuration = recEnd - recStart;

  const [clipStartOff, setClipStartOff] = useState(0);
  const [clipEndOff, setClipEndOff] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);

  // State refs for use in document-level event handlers (avoid stale closures)
  const clipStartRef = useRef(clipStartOff);
  const clipEndRef = useRef(clipEndOff);
  clipStartRef.current = clipStartOff;
  clipEndRef.current = clipEndOff;

  const draggingRef = useRef<"start" | "end" | "range" | null>(null);
  const dragOriginX = useRef(0);
  const dragOriginStartOff = useRef(0);
  const dragOriginEndOff = useRef(0);
  const recDurationRef = useRef(recDuration);
  recDurationRef.current = recDuration;

  // Initialize clip range when modal opens or recording changes
  useEffect(() => {
    if (!isOpen || !recording) {
      setInitialized(false);
      return;
    }

    const rStart = new Date(recording.start_time).getTime();
    const rEnd = recording.end_time ? new Date(recording.end_time).getTime() : Date.now();
    const dur = rEnd - rStart;

    let center = dur / 2;
    if (currentTime) {
      center = Math.max(0, Math.min(dur, currentTime.getTime() - rStart));
    }

    const halfClip = Math.min((MAX_CLIP_SECONDS * 1000) / 2, dur / 2);
    const s = Math.max(0, center - halfClip);
    const e = Math.min(dur, center + halfClip);
    setClipStartOff(s);
    setClipEndOff(e);
    setSubmitMsg(null);
    setInitialized(true);
  }, [isOpen, recording?.id]); // Only depend on isOpen and recording identity

  const clipDurationSec = (clipEndOff - clipStartOff) / 1000;
  const isTooLong = clipDurationSec > MAX_CLIP_SECONDS;

  // Document-level pointer move/up handlers (registered only during drag)
  const handleDocPointerMove = useCallback((e: PointerEvent) => {
    if (!draggingRef.current || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const dx = e.clientX - dragOriginX.current;
    const dxOff = (dx / rect.width) * recDurationRef.current;
    const dur = recDurationRef.current;
    const type = draggingRef.current;

    if (type === "start") {
      let newStart = Math.max(0, dragOriginStartOff.current + dxOff);
      const currentEnd = clipEndRef.current;
      newStart = Math.min(newStart, currentEnd - 1000);
      if (currentEnd - newStart > MAX_CLIP_SECONDS * 1000) {
        newStart = currentEnd - MAX_CLIP_SECONDS * 1000;
      }
      setClipStartOff(Math.max(0, newStart));
    } else if (type === "end") {
      let newEnd = Math.min(dur, dragOriginEndOff.current + dxOff);
      const currentStart = clipStartRef.current;
      newEnd = Math.max(newEnd, currentStart + 1000);
      if (newEnd - currentStart > MAX_CLIP_SECONDS * 1000) {
        newEnd = currentStart + MAX_CLIP_SECONDS * 1000;
      }
      setClipEndOff(Math.min(dur, newEnd));
    } else if (type === "range") {
      const rangeDur = dragOriginEndOff.current - dragOriginStartOff.current;
      let newStart = dragOriginStartOff.current + dxOff;
      newStart = Math.max(0, Math.min(dur - rangeDur, newStart));
      setClipStartOff(newStart);
      setClipEndOff(newStart + rangeDur);
    }
  }, []);

  const handleDocPointerUp = useCallback(() => {
    draggingRef.current = null;
    document.removeEventListener("pointermove", handleDocPointerMove);
    document.removeEventListener("pointerup", handleDocPointerUp);
  }, [handleDocPointerMove]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "start" | "end" | "range") => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = type;
      dragOriginX.current = e.clientX;
      dragOriginStartOff.current = clipStartRef.current;
      dragOriginEndOff.current = clipEndRef.current;

      document.addEventListener("pointermove", handleDocPointerMove);
      document.addEventListener("pointerup", handleDocPointerUp);
    },
    [handleDocPointerMove, handleDocPointerUp]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("pointermove", handleDocPointerMove);
      document.removeEventListener("pointerup", handleDocPointerUp);
    };
  }, [handleDocPointerMove, handleDocPointerUp]);

  const handleSubmit = async () => {
    if (!recording) return;
    setIsSubmitting(true);
    setSubmitMsg(null);
    try {
      await api.post("/api/clips", {
        recording_id: recording.id,
        clip_start: new Date(recStart + clipStartOff).toISOString(),
        clip_end: new Date(recStart + clipEndOff).toISOString(),
      });
      setSubmitMsg("success");
    } catch (err: any) {
      setSubmitMsg(err.detail || "Có lỗi xảy ra khi tạo clip.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tickCount = 6;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const t = recStart + (recDuration / tickCount) * i;
    return new Date(t);
  });

  const startPct = recDuration > 0 ? (clipStartOff / recDuration) * 100 : 0;
  const endPct = recDuration > 0 ? (clipEndOff / recDuration) * 100 : 100;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cắt Video Clip"
      maxWidth="lg"
      footer={
        submitMsg === "success" ? (
          <div className="flex items-center gap-3 w-full">
            <span className="material-symbols-outlined text-green-500">check_circle</span>
            <span className="text-sm text-on-surface flex-1">Đã gửi yêu cầu! Video đang được xử lý.</span>
            <Button
              variant="primary"
              icon="archive"
              onClick={() => {
                onClose();
                router.push("/dashboard/storage");
              }}
            >
              Đi đến phần tải về
            </Button>
          </div>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button
              variant="primary"
              icon="content_cut"
              onClick={handleSubmit}
              disabled={isSubmitting || !recording || isTooLong}
            >
              {isSubmitting ? "Đang xử lý..." : "Cắt video"}
            </Button>
          </>
        )
      }
    >
      {!recording ? (
        <p className="text-on-surface-variant text-sm text-center py-8">
          Vui lòng chọn một đoạn ghi hình trên thước thời gian trước.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3 bg-surface-variant/20 p-3 rounded-xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-primary">videocam</span>
            <span className="font-semibold text-on-surface text-sm">{cameraName}</span>
          </div>

          <div className="text-center space-y-1">
            <p className="text-on-surface font-medium">
              Kéo thanh trượt trên dòng thời gian để cắt video.
            </p>
            <p className="text-sm text-on-surface-variant">
              Chúng tôi khuyến cáo chọn video độ dài dưới 10 phút.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="bg-surface-variant/30 px-6 py-3 rounded-2xl border border-outline-variant/30">
              <span className="font-mono text-lg font-bold text-on-surface">
                {formatTime(new Date(recStart + clipStartOff))}
              </span>
              <span className="mx-3 text-on-surface-variant font-bold">—</span>
              <span className="font-mono text-lg font-bold text-on-surface">
                {formatTime(new Date(recStart + clipEndOff))}
              </span>
            </div>
          </div>

          <div className="text-center">
            <span className={`text-sm font-medium ${isTooLong ? "text-error" : "text-on-surface-variant"}`}>
              Thời lượng: {formatDuration(clipDurationSec)}
              {isTooLong && " (vượt quá 10 phút)"}
            </span>
          </div>

          {/* Timeline slider */}
          <div className="px-2">
            <div
              ref={trackRef}
              className="relative h-12 bg-surface-variant/30 rounded-xl border border-outline-variant/50 select-none touch-none overflow-hidden"
            >
              <div className="absolute inset-0 bg-surface-variant/20" />

              {/* Dimmed left */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-black/20 rounded-l-xl"
                style={{ width: `${startPct}%` }}
              />

              {/* Dimmed right */}
              <div
                className="absolute top-0 bottom-0 right-0 bg-black/20 rounded-r-xl"
                style={{ width: `${100 - endPct}%` }}
              />

              {/* Selected range (draggable) */}
              <div
                className="absolute top-0 bottom-0 bg-primary/25 border-y-2 border-primary/50 cursor-grab active:cursor-grabbing"
                style={{
                  left: `${startPct}%`,
                  width: `${endPct - startPct}%`,
                }}
                onPointerDown={(e) => handlePointerDown(e, "range")}
              />

              {/* Left handle */}
              <div
                className="absolute top-0 bottom-0 w-5 cursor-ew-resize z-10 flex items-center justify-center group"
                style={{ left: `calc(${startPct}% - 10px)` }}
                onPointerDown={(e) => handlePointerDown(e, "start")}
              >
                <div className="w-1.5 h-8 bg-primary rounded-full shadow-md group-hover:scale-125 transition-transform" />
              </div>

              {/* Right handle */}
              <div
                className="absolute top-0 bottom-0 w-5 cursor-ew-resize z-10 flex items-center justify-center group"
                style={{ left: `calc(${endPct}% - 10px)` }}
                onPointerDown={(e) => handlePointerDown(e, "end")}
              >
                <div className="w-1.5 h-8 bg-primary rounded-full shadow-md group-hover:scale-125 transition-transform" />
              </div>
            </div>

            {/* Time ticks */}
            <div className="relative h-5 mt-1">
              {ticks.map((t, i) => (
                <span
                  key={i}
                  className="absolute text-[10px] text-on-surface-variant font-mono -translate-x-1/2"
                  style={{ left: `${(i / tickCount) * 100}%` }}
                >
                  {formatTime(t)}
                </span>
              ))}
            </div>
          </div>

          {typeof submitMsg === "string" && submitMsg !== "success" && (
            <div className="p-3 text-sm text-error bg-error-container/20 rounded-xl text-center">
              {submitMsg}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
