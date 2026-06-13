"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import { RecordingResponse } from "@/types";

interface TimelineProps {
  recordings: RecordingResponse[];
  windowHours: number;
  currentPlaybackTime: Date | null;
  onSeek: (time: Date, recordingId: string | null) => void;
}

export default function Timeline({
  recordings,
  windowHours,
  currentPlaybackTime,
  onSeek,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());

  // Update 'now' every 10s so the timeline end doesn't drift too far
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute boundaries (handle server/client clock skew by ensuring endTimeMs covers the latest recording)
  const maxRecordingTime = recordings.reduce((max, rec) => {
    const rStart = new Date(rec.start_time).getTime();
    const rEnd = rec.end_time ? new Date(rec.end_time).getTime() : rStart;
    return Math.max(max, rStart, rEnd);
  }, now.getTime());

  const endTimeMs = maxRecordingTime;
  const startTimeMs = endTimeMs - windowHours * 60 * 60 * 1000;
  const totalDurationMs = endTimeMs - startTimeMs;

  // Generate hour markers (e.g., 15:00, 15:30, 16:00...)
  const markers = useMemo(() => {
    const marks = [];
    // Start from the next clean 30-minute interval after startTime
    const startObj = new Date(startTimeMs);
    startObj.setMinutes(startObj.getMinutes() >= 30 ? 60 : 30, 0, 0);
    
    let currentMark = startObj.getTime();
    while (currentMark <= endTimeMs) {
      marks.push(new Date(currentMark));
      currentMark += 30 * 60 * 1000; // +30 minutes
    }
    return marks;
  }, [startTimeMs, endTimeMs]);

  // Handle click on timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    
    const clickedTimeMs = startTimeMs + clickRatio * totalDurationMs;
    const clickedDate = new Date(clickedTimeMs);

    // Find if click falls within a valid recording
    const clickedRecording = recordings.find(rec => {
      // Filter out ghost recordings
      if (rec.status === "completed" && (!rec.file_size_bytes || rec.file_size_bytes === 0)) {
        return false;
      }

      const rStart = new Date(rec.start_time).getTime();
      const rEnd = rec.end_time ? new Date(rec.end_time).getTime() : now.getTime();
      return clickedTimeMs >= rStart && clickedTimeMs <= rEnd;
    });

    onSeek(clickedDate, clickedRecording ? clickedRecording.id : null);
  };

  const cursorLeft = currentPlaybackTime 
    ? Math.max(0, Math.min(100, ((currentPlaybackTime.getTime() - startTimeMs) / totalDurationMs) * 100))
    : -10; // Hide off-screen if null

  return (
    <div className="w-full bg-surface-variant/10 border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
      {/* Timeline track container */}
      <div 
        className="relative h-12 bg-surface-variant/30 rounded-lg cursor-pointer overflow-hidden group"
        ref={containerRef}
        onClick={handleTimelineClick}
      >
        {/* Render valid recordings as green blocks */}
        {recordings.map((rec) => {
          // Skip ghost recordings
          if (rec.status === "completed" && (!rec.file_size_bytes || rec.file_size_bytes === 0)) {
            return null;
          }

          const rStart = new Date(rec.start_time).getTime();
          const rEnd = rec.end_time ? new Date(rec.end_time).getTime() : now.getTime();
          
          // Skip if completely outside window
          if (rEnd < startTimeMs || rStart > endTimeMs) return null;

          const startRatio = Math.max(0, (rStart - startTimeMs) / totalDurationMs);
          const endRatio = Math.min(1, (rEnd - startTimeMs) / totalDurationMs);
          
          const leftPercent = startRatio * 100;
          const widthPercent = (endRatio - startRatio) * 100;

          return (
            <div 
              key={rec.id}
              className="absolute top-2 bottom-2 bg-green-500 rounded-md opacity-80 hover:opacity-100 transition-opacity"
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
              title={`Recording: ${new Date(rec.start_time).toLocaleTimeString()}`}
            />
          );
        })}

        {/* Hover overlay (optional: can add mouse move to show tooltip time) */}
        <div className="absolute inset-0 hover:bg-black/5 transition-colors pointer-events-none" />

        {/* Playhead Cursor (Red Line) */}
        {currentPlaybackTime && cursorLeft >= 0 && cursorLeft <= 100 && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-error z-10"
            style={{ left: `${cursorLeft}%` }}
          >
            {/* Tooltip for current time */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-surface border border-error/30 text-on-surface text-xs font-bold py-1 px-2 rounded shadow-sm whitespace-nowrap">
              {currentPlaybackTime.toLocaleTimeString('en-US', { hour12: false })}
            </div>
            {/* Cursor triangle */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-error rotate-45 -mt-1.5" />
          </div>
        )}
      </div>

      {/* Axis / Time Markers */}
      <div className="relative h-6 mt-2">
        {markers.map((mark, idx) => {
          const markRatio = (mark.getTime() - startTimeMs) / totalDurationMs;
          const leftPercent = markRatio * 100;
          const isHour = mark.getMinutes() === 0;

          return (
            <div 
              key={idx}
              className="absolute top-0 flex flex-col items-center -translate-x-1/2"
              style={{ left: `${leftPercent}%` }}
            >
              <div className={`w-px bg-outline-variant ${isHour ? 'h-3' : 'h-1.5'}`} />
              <span className="text-[10px] text-on-surface-variant mt-1 font-medium">
                {mark.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
