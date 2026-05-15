"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import logoImg from "@/assets/logo-camai.png";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";

const adminNavItems = [
  { translationKey: "home", icon: "home", path: "/dashboard", roles: ["admin", "viewer"] },
  { translationKey: "statistics", icon: "monitoring", path: "/dashboard/statistics", roles: ["admin", "viewer"] },
  { translationKey: "live", icon: "videocam", path: "/dashboard/live", roles: ["admin", "viewer"] },
  { translationKey: "playback", icon: "replay", path: "/dashboard/playback", roles: ["admin", "viewer"] },
  { translationKey: "events", icon: "event_note", path: "/dashboard/events", roles: ["admin", "viewer"] },
  { translationKey: "snapshots", icon: "photo_library", path: "/dashboard/snapshots", roles: ["admin", "viewer"] },
  { translationKey: "storage", icon: "archive", path: "/dashboard/storage", roles: ["admin", "viewer"] },
  { translationKey: "settings", icon: "settings", path: "/dashboard/settings", roles: ["admin", "viewer"] },
  { translationKey: "help", icon: "help", path: "/dashboard/help", roles: ["admin", "viewer"] },
  { translationKey: "admin", icon: "group", path: "/dashboard/admin/users", roles: ["admin"] },
];

interface DashboardSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function DashboardSidebar({ isOpen = false, onClose }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const role = user?.role || "viewer";
  
  // Filter items by role
  const navItems = adminNavItems.filter(item => item.roles.includes(role));

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    // For admin sub-routes, highlight the Quản trị tab
    if (path === "/dashboard/admin/users" && pathname.startsWith("/dashboard/admin")) {
      return true;
    }
    return pathname.startsWith(path);
  };

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity animate-in fade-in"
          onClick={onClose}
        ></div>
      )}

      <nav 
        className={`fixed inset-y-0 left-0 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:translate-x-0 transition duration-200 ease-in-out md:flex flex-col w-sidebar_width h-full bg-white border-r border-outline-variant/30 z-50 shrink-0 shadow-xl md:shadow-none`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 shrink-0 mb-4">
          <Link href="/dashboard" className="flex items-center" onClick={handleLinkClick}>
            <Image src={logoImg} alt="cam.ai logo" className="h-10 w-auto object-contain" priority />
          </Link>
          <div className="md:hidden">
            <button onClick={onClose} className="material-symbols-outlined text-gray-500 hover:bg-surface-variant p-1 rounded-full transition-colors">
              close
            </button>
          </div>
        </div>

      {/* Scrollable Nav */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-4 custom-scrollbar">
        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={handleLinkClick}
                className={`px-4 py-3 rounded-xl flex items-center gap-4 transition-colors group ${
                  active
                    ? "bg-accent-blue text-gray-900"
                    : "text-gray-500 hover:bg-surface-variant/50 hover:text-gray-900"
                }`}
              >
                <span
                  className={`material-symbols-outlined transition-colors ${
                    active ? "" : "group-hover:text-gray-900"
                  }`}
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span
                  className={`font-label-bold text-sm transition-colors ${
                    active ? "" : "group-hover:text-gray-900"
                  }`}
                >
                  {t(`common.${item.translationKey}` as any)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      </nav>
    </>
  );
}
