import React from "react";

interface GridLayoutSelectorProps {
  currentLayout: 1 | 4 | 9;
  onLayoutChange: (layout: 1 | 4 | 9) => void;
  activeCameraCount?: number;
}

export default function GridLayoutSelector({
  currentLayout,
  onLayoutChange,
  activeCameraCount = 0,
}: GridLayoutSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface rounded-2xl p-4 shadow-ambient mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-on-surface">Camera</h2>
        <span className="px-3 py-1 bg-warning/10 text-warning text-xs font-bold rounded-full flex items-center gap-1.5">
          {activeCameraCount} Camera hoạt động
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1"></span>
        </span>
      </div>
      
      <div className="flex items-center gap-1 bg-surface-variant/30 p-1 rounded-xl">
        <button
          onClick={() => onLayoutChange(1)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            currentLayout === 1
              ? "bg-surface text-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
          title="1 Camera"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: currentLayout === 1 ? "'FILL' 1" : "'FILL' 0" }}>crop_square</span>
        </button>
        <button
          onClick={() => onLayoutChange(4)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            currentLayout === 4
              ? "bg-surface text-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
          title="4 Camera"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: currentLayout === 4 ? "'FILL' 1" : "'FILL' 0" }}>grid_view</span>
        </button>
        <button
          onClick={() => onLayoutChange(9)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            currentLayout === 9
              ? "bg-surface text-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
          title="9 Camera"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: currentLayout === 9 ? "'FILL' 1" : "'FILL' 0" }}>grid_on</span>
        </button>
      </div>
    </div>
  );
}
