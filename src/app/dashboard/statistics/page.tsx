"use client";

import React, { useMemo, useState } from "react";
import MetricCard from "@/components/ui/MetricCard";
import PageHeader from "@/components/ui/PageHeader";
import SegmentedControl from "@/components/ui/SegmentedControl";

const chartData = {
  "7d": [42, 56, 48, 73, 64, 89, 76],
  "30d": [35, 58, 44, 70, 52, 81, 65, 92, 74, 88, 61, 79],
  "90d": [28, 45, 62, 50, 72, 83, 66, 91, 78, 86, 69, 95],
};

const cameras = [
  { name: "Sảnh chính", location: "Tầng 1", uptime: "99.8%", events: 46, status: "Ổn định" },
  { name: "Bãi xe A", location: "Khu ngoài trời", uptime: "98.4%", events: 31, status: "Ổn định" },
  { name: "Hành lang 2", location: "Tầng 2", uptime: "96.7%", events: 18, status: "Cần kiểm tra" },
  { name: "Kho thiết bị", location: "Tầng hầm", uptime: "99.2%", events: 12, status: "Ổn định" },
];

export default function StatisticsPage() {
  const [range, setRange] = useState<keyof typeof chartData>("7d");
  const values = chartData[range];
  const points = useMemo(
    () => values.map((value, index) => `${(index / (values.length - 1)) * 100},${100 - value}`).join(" "),
    [values],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Báo cáo hệ thống</p>
          <h2 className="mt-1 text-2xl font-bold text-on-surface">Tổng quan vận hành camera</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Theo dõi hiệu suất, dung lượng và sự kiện AI trong một màn hình.</p>
        </div>
        <div className="flex rounded-xl bg-surface p-1 shadow-sm ring-1 ring-outline-variant/30">
          {(["7d", "30d", "90d"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                range === item ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-variant/50"
              }`}
            >
              {item === "7d" ? "7 ngày" : item === "30d" ? "30 ngày" : "90 ngày"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["videocam", "Camera trực tuyến", "12 / 13", "+1 tuần này", "text-primary", "bg-primary/10"],
          ["person_alert", "Sự kiện AI", "148", "+12.6%", "text-error", "bg-error/10"],
          ["cloud_done", "Thời gian hoạt động", "99.2%", "+0.4%", "text-green-700", "bg-green-100"],
          ["hard_drive", "Dung lượng đã dùng", "1.84 TB", "72% tổng", "text-amber-700", "bg-amber-100"],
        ].map(([icon, label, value, trend, color, background]) => (
          <section key={label} className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-outline-variant/30">
            <div className="flex items-start justify-between">
              <span className={`material-symbols-outlined rounded-xl p-2.5 ${color} ${background}`}>{icon}</span>
              <span className="text-xs font-semibold text-on-surface-variant">{trend}</span>
            </div>
            <p className="mt-5 text-sm text-on-surface-variant">{label}</p>
            <p className="mt-1 text-2xl font-bold text-on-surface">{value}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-outline-variant/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-on-surface">Lưu lượng sự kiện</h3>
              <p className="text-sm text-on-surface-variant">Số lượt phát hiện người theo thời gian</p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Hoạt động tốt</span>
          </div>
          <div className="mt-8 h-64 rounded-xl bg-gradient-to-b from-primary/5 to-transparent p-4">
            <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" preserveAspectRatio="none" aria-label="Biểu đồ sự kiện">
              {[20, 40, 60, 80].map((y) => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" className="text-outline-variant/50" strokeWidth="0.4" />
              ))}
              <polygon points={`0,100 ${points} 100,100`} className="fill-primary/10" />
              <polyline points={points} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="mt-3 flex justify-between text-xs text-on-surface-variant">
            <span>Bắt đầu kỳ</span><span>Giữa kỳ</span><span>Hiện tại</span>
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-outline-variant/30">
          <h3 className="font-semibold text-on-surface">Phân bổ lưu trữ</h3>
          <p className="text-sm text-on-surface-variant">Tổng dung lượng 2.5 TB</p>
          <div className="mx-auto my-7 grid h-40 w-40 place-items-center rounded-full bg-[conic-gradient(#4f378a_0_58%,#ff5722_58%_72%,#e6e0e9_72%)]">
            <div className="grid h-28 w-28 place-items-center rounded-full bg-surface text-center">
              <div><strong className="text-2xl text-on-surface">72%</strong><p className="text-xs text-on-surface-variant">đã sử dụng</p></div>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-on-surface-variant">Bản ghi camera</span><strong>1.45 TB</strong></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">Clip đã xuất</span><strong>350 GB</strong></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">Còn trống</span><strong>700 GB</strong></div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-outline-variant/30">
        <div className="border-b border-outline-variant/30 px-6 py-5">
          <h3 className="font-semibold text-on-surface">Hiệu suất theo camera</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-surface-variant/30 text-xs uppercase text-on-surface-variant">
              <tr><th className="px-6 py-3">Camera</th><th className="px-6 py-3">Vị trí</th><th className="px-6 py-3">Uptime</th><th className="px-6 py-3">Sự kiện</th><th className="px-6 py-3">Trạng thái</th></tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {cameras.map((camera) => (
                <tr key={camera.name} className="hover:bg-surface-variant/20">
                  <td className="px-6 py-4 font-semibold">{camera.name}</td><td className="px-6 py-4 text-on-surface-variant">{camera.location}</td>
                  <td className="px-6 py-4">{camera.uptime}</td><td className="px-6 py-4">{camera.events}</td>
                  <td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${camera.status === "Ổn định" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{camera.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
