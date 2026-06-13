"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";
import NotificationToastManager from "@/components/NotificationToastManager";
import "@/lib/i18n";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fa] text-on-surface h-screen overflow-hidden flex w-full">
        <DashboardSidebar 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        <div className="flex-1 bg-[#f8f9fa] h-full relative flex flex-col w-full min-w-0">
          <DashboardHeader 
            onMenuClick={() => setIsMobileMenuOpen(true)} 
          />
          <main className="flex-1 overflow-y-auto w-full relative">
            <div className="p-4 sm:p-8 w-full mx-auto min-h-full">
              {children}
            </div>
          </main>
        </div>
        <NotificationToastManager />
      </div>
  );
}
