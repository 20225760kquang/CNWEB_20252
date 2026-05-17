import React from "react";

interface GridLayoutSelectorProps {
  currentLayout: 1 | 4 | 9;
  onLayoutChange: (layout: 1 | 4 | 9) => void;
  activeCameraCount?: number;
}

const layoutOptions = [
  { value: 1, icon: "crop_square", title: "1 Camera", label: "Một khung hình" },
  { value: 4, icon: "grid_view", title: "4 Camera", label: "Lưới 2 x 2" },
  { value: 9, icon: "grid_on", title: "9 Camera", label: "Lưới 3 x 3" },
] as const;

export default function GridLayoutSelector({
  currentLayout,
  onLayoutChange,
  activeCameraCount = 0,
}: GridLayoutSelectorProps) {
  const activeLabel = `${activeCameraCount} camera hoạt động`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface rounded-2xl p-4 shadow-ambient mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-on-surface">Camera</h2>
        <span
          aria-label={activeLabel}
          className="px-3 py-1 bg-warning/10 text-warning text-xs font-bold rounded-full flex items-center gap-1.5"
        >
          {activeLabel}
          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1"></span>
        </span>
      </div>
      
      <div className="flex items-center gap-1 bg-surface-variant/30 p-1 rounded-xl" aria-label="Chọn bố cục camera">
        {layoutOptions.map((option) => {
          const isActive = currentLayout === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onLayoutChange(option.value)}
              aria-pressed={isActive}
              aria-label={option.label}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                isActive
                  ? "bg-surface text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
              title={option.title}
            >
              <span
                aria-hidden="true"
                className="material-symbols-outlined"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {option.icon}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
