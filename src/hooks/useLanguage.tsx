"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "vi" | "en";

export const translations = {
  vi: {
    dashboardTitle: "Dashboard Tổng quan",
    statisticsTitle: "Thống kê",
    liveTitle: "Xem trực tiếp",
    playbackTitle: "Xem lại",
    storageTitle: "Lưu trữ",
    settingsTitle: "Cài đặt",
    adminTitle: "Quản trị hệ thống",
    home: "Trang chủ",
    statistics: "Thống kê",
    live: "Xem trực tiếp",
    playback: "Xem lại",
    storage: "Lưu trữ",
    settings: "Cài đặt",
    admin: "Quản trị",
    account: "Tài khoản",
    logout: "Đăng xuất",
  },
  en: {
    dashboardTitle: "Dashboard Overview",
    statisticsTitle: "Statistics",
    liveTitle: "Live View",
    playbackTitle: "Playback",
    storageTitle: "Storage",
    settingsTitle: "Settings",
    adminTitle: "System Admin",
    home: "Home",
    statistics: "Statistics",
    live: "Live View",
    playback: "Playback",
    storage: "Storage",
    settings: "Settings",
    admin: "Admin",
    account: "Account",
    logout: "Logout",
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.vi) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("vi");

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem("app_language") as Language;
    if (stored && (stored === "vi" || stored === "en")) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app_language", lang);
  };

  const t = (key: keyof typeof translations.vi) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
