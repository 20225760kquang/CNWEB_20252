"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Quản lý người dùng", path: "/dashboard/admin/users" },
  { label: "Quản lý camera", path: "/dashboard/admin/cameras" },
  { label: "Phân quyền truy cập", path: "/dashboard/admin/access" },
];

export default function AdminTabNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-8 border-b border-outline-variant/30 mb-6">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.path);
        
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`relative pb-3 text-sm font-semibold transition-colors ${
              isActive ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
            {isActive && (
              <div className="absolute -bottom-px left-0 w-full h-1 bg-primary rounded-t-full"></div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
