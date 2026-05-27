"use client";

import React, { useMemo, useState } from "react";
import offlineCamera from "@/assets/offline_camera.webp";
import PageHeader from "@/components/ui/PageHeader";
import SegmentedControl from "@/components/ui/SegmentedControl";

type SnapshotSource = "Tất cả" | "Trực tiếp" | "Xem lại" | "Sự kiện AI";

const snapshots = [
  { id: 1, camera: "Sảnh chính", source: "Trực tiếp", time: "Hôm nay, 10:42", tag: "Đã đánh dấu" },
  { id: 2, camera: "Bãi xe A", source: "Sự kiện AI", time: "Hôm nay, 09:18", tag: "Phát hiện người" },
  { id: 3, camera: "Hành lang 2", source: "Xem lại", time: "Hôm qua, 22:05", tag: "Thủ công" },
  { id: 4, camera: "Kho thiết bị", source: "Sự kiện AI", time: "Hôm qua, 18:31", tag: "Phát hiện người" },
  { id: 5, camera: "Cổng phụ", source: "Trực tiếp", time: "12/06/2026, 16:20", tag: "Thủ công" },
  { id: 6, camera: "Phòng máy", source: "Xem lại", time: "11/06/2026, 14:08", tag: "Đã đánh dấu" },
];

export default function SnapshotsPage() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SnapshotSource>("Tất cả");
  const [selected, setSelected] = useState<(typeof snapshots)[number] | null>(null);
  const filtered = useMemo(
    () => snapshots.filter((item) => item.camera.toLowerCase().includes(query.toLowerCase()) && (source === "Tất cả" || item.source === source)),
    [query, source],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        eyebrow="Kho hình ảnh"
        title="Ảnh chụp từ camera"
        description="Tìm kiếm và quản lý ảnh chụp từ xem trực tiếp, xem lại và sự kiện AI."
      />

      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-outline-variant/30 md:flex-row">
        <label className="flex flex-1 items-center gap-3 rounded-xl bg-surface-variant/40 px-4">
          <span className="material-symbols-outlined text-on-surface-variant">search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên camera..." className="w-full bg-transparent py-3 text-sm outline-none" />
        </label>
        <SegmentedControl
          value={source}
          onChange={setSource}
          ariaLabel="Lọc ảnh theo nguồn"
          options={[
            { value: "Tất cả", label: "Tất cả" },
            { value: "Trực tiếp", label: "Trực tiếp" },
            { value: "Xem lại", label: "Xem lại" },
            { value: "Sự kiện AI", label: "Sự kiện AI" },
          ]}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-on-surface-variant"><strong className="text-on-surface">{filtered.length}</strong> ảnh được tìm thấy</p>
        <button className="flex items-center gap-2 text-sm font-semibold text-primary"><span className="material-symbols-outlined text-lg">download</span>Tải nhiều ảnh</button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <article key={item.id} className="group overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-outline-variant/30">
            <button onClick={() => setSelected(item)} className="relative block aspect-video w-full overflow-hidden bg-surface-variant text-left">
              <img src={offlineCamera.src} alt={`Ảnh từ ${item.camera}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{item.source}</span>
              <span className="material-symbols-outlined absolute inset-0 grid place-items-center text-4xl text-white opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">zoom_in</span>
            </button>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-on-surface">{item.camera}</h3><p className="mt-1 text-xs text-on-surface-variant">{item.time}</p></div><button className="material-symbols-outlined text-on-surface-variant hover:text-primary">more_vert</button></div>
              <div className="mt-4 flex items-center justify-between"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{item.tag}</span><button className="material-symbols-outlined text-lg text-on-surface-variant hover:text-primary">download</button></div>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && <div className="rounded-2xl bg-surface p-16 text-center ring-1 ring-outline-variant/30"><span className="material-symbols-outlined text-5xl text-outline">image_search</span><h3 className="mt-3 font-semibold">Không tìm thấy ảnh</h3><p className="mt-1 text-sm text-on-surface-variant">Thử đổi từ khóa hoặc nguồn ảnh.</p></div>}

      {selected && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-surface shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-outline-variant/30 p-4"><div><h3 className="font-semibold">{selected.camera}</h3><p className="text-xs text-on-surface-variant">{selected.time}</p></div><button onClick={() => setSelected(null)} className="material-symbols-outlined rounded-full p-2 hover:bg-surface-variant">close</button></div>
            <img src={offlineCamera.src} alt={`Ảnh lớn từ ${selected.camera}`} className="max-h-[70vh] w-full bg-black object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
