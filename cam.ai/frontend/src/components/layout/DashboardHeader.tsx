"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import logoImg from "@/assets/logo-camai.png";
import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useNotifications } from "@/hooks/useNotifications";

const getPageTitle = (pathname: string, t: any) => {
  if (pathname === "/dashboard") return t('common.dashboardTitle');
  if (pathname.startsWith("/dashboard/statistics")) return t('common.statisticsTitle');
  if (pathname.startsWith("/dashboard/live")) return t('common.liveTitle');
  if (pathname.startsWith("/dashboard/playback")) return t('common.playbackTitle');
  if (pathname.startsWith("/dashboard/storage")) return t('common.storageTitle');
  if (pathname.startsWith("/dashboard/settings")) return t('common.settingsTitle');
  if (pathname.startsWith("/dashboard/admin")) return t('common.adminTitle');
  if (pathname.startsWith("/dashboard/events")) return t('common.events');
  return "cam.ai";
};

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

export default function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const title = getPageTitle(pathname, t);
  const language = i18n.language;
  
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();
  const router = useRouter();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isNotiDropdownOpen, setIsNotiDropdownOpen] = useState(false);

  const notiRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiDropdownOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotiClick = (notif: any) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    router.push("/dashboard/events");
    setIsNotiDropdownOpen(false);
  };

  return (
    <>
      {/* Mobile Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-outline-variant/30 md:hidden flex justify-between items-center h-20 px-4 sm:px-8">
        <div className="flex items-center">
          <Image src={logoImg} alt="cam.ai logo" className="h-10 w-auto object-contain" priority />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="material-symbols-outlined text-gray-500 p-1 hover:bg-surface-variant rounded-full transition-colors">menu</button>
        </div>
      </header>

      {/* Desktop Header */}
      <div className="hidden md:flex h-20 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-outline-variant/30 justify-between items-center px-8 w-full">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        
        <div className="flex items-center gap-6">
          {/* Notifications */}
          <div className="relative" ref={notiRef}>
            <div 
              className="cursor-pointer relative"
              onClick={() => setIsNotiDropdownOpen(!isNotiDropdownOpen)}
            >
              <span className="material-symbols-outlined text-gray-500 hover:text-gray-900 transition-colors">
                notifications
              </span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-error text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            
            {isNotiDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 max-h-[400px] overflow-y-auto bg-surface rounded-xl shadow-xl border border-outline-variant/30 py-2 z-50 flex flex-col">
                <div className="flex justify-between items-center px-4 py-2 border-b border-outline-variant/20 sticky top-0 bg-surface/90 backdrop-blur-sm z-10">
                  <span className="font-semibold text-gray-900">{t('common.notifications') || 'Thông báo'}</span>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Đánh dấu tất cả đã đọc
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      Không có thông báo nào.
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id}
                        onClick={() => handleNotiClick(notif)}
                        className={`px-4 py-3 border-b border-outline-variant/10 cursor-pointer transition-colors hover:bg-surface-variant/30 ${!notif.is_read ? 'bg-primary/5' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-primary' : 'bg-transparent'}`}></div>
                          <div>
                            <p className="text-sm text-gray-900 font-medium">
                              Camera "{notif.camera_location ? `${notif.camera_name} - ${notif.camera_location}` : notif.camera_name}"
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">{notif.event_text}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {notif.created_at ? new Date(notif.created_at).toLocaleString('vi-VN') : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Language Switcher */}
          <div className="relative border-l border-outline-variant/30 pl-6" ref={langRef}>
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            >
              {language === "vi" ? (
                <>
                  <div className="w-5 h-4 bg-red-500 flex items-center justify-center relative overflow-hidden rounded-sm shadow-sm">
                    <span className="text-yellow-400 text-[10px] absolute">★</span>
                  </div>
                  <span className="font-semibold text-sm text-gray-700">Tiếng Việt</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-4 bg-blue-700 flex flex-col items-center justify-center relative overflow-hidden rounded-sm shadow-sm">
                    <div className="absolute top-0 left-0 w-2 h-2 bg-white"></div>
                    <div className="absolute w-full h-[2px] bg-red-600 top-1/2 -translate-y-1/2"></div>
                    <div className="absolute w-[2px] h-full bg-red-600 left-1/2 -translate-x-1/2"></div>
                  </div>
                  <span className="font-semibold text-sm text-gray-700">English</span>
                </>
              )}
              <span className="material-symbols-outlined text-gray-400 text-sm">expand_more</span>
            </div>

            {isLangDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-surface rounded-xl shadow-lg border border-outline-variant/20 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-surface-variant transition-colors flex items-center gap-2"
                  onClick={() => {
                    i18n.changeLanguage("vi");
                    setIsLangDropdownOpen(false);
                  }}
                >
                  Tiếng Việt
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-surface-variant transition-colors flex items-center gap-2"
                  onClick={() => {
                    i18n.changeLanguage("en");
                    setIsLangDropdownOpen(false);
                  }}
                >
                  English (US)
                </button>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative border-l border-outline-variant/30 pl-6 ml-2" ref={profileRef}>
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="w-8 h-8 rounded-full border-2 border-accent-blue bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                {user?.username?.substring(0, 2) || "U"}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-gray-900 leading-none">
                  {user?.username || "Loading..."}
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                  {user?.role === "admin" ? "Super Admin" : "Viewer"}
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-sm">
                expand_more
              </span>
            </div>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-surface rounded-xl shadow-lg border border-outline-variant/20 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <Link 
                  href="/dashboard/settings"
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-surface-variant transition-colors flex items-center gap-2"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  {t('common.account')}
                </Link>
                <div className="h-px bg-outline-variant/20 my-1"></div>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error/5 transition-colors flex items-center gap-2"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    logout();
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  {t('common.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
