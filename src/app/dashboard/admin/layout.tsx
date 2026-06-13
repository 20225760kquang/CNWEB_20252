"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AdminTabNav from "@/components/layout/AdminTabNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading || user?.role !== "admin") {
    return null; // Or a loading spinner
  }

  return (
    <div className="bg-surface rounded-2xl p-6 shadow-ambient min-h-[calc(100vh-8rem)] animate-in fade-in duration-300">
      <AdminTabNav />
      {children}
    </div>
  );
}
