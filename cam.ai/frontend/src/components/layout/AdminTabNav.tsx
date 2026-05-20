"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Quản lý người dùng", icon: "group", path: "/dashboard/admin/users" },
  { label: "Quản lý camera", icon: "videocam", path: "/dashboard/admin/cameras" },
  { label: "Phân quyền truy cập", icon: "admin_panel_settings", path: "/dashboard/admin/access" },
];

export default function AdminTabNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Quản trị" className="flex items-center gap-2 sm:gap-8 overflow-x-auto border-b border-outline-variant/30 mb-6">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.path);
        
        return (
          <Link
            key={tab.path}
            href={tab.path}
            aria-current={isActive ? "page" : undefined}
            className={`relative pb-3 text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap ${
              isActive ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
            {isActive && (
              <span aria-hidden="true" className="absolute -bottom-px left-0 w-full h-1 bg-primary rounded-t-full"></span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
