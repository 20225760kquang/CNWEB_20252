"use client";

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import AdminHomePage from "@/components/dashboard/AdminHomePage";
import UserHomePage from "@/components/dashboard/UserHomePage";

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === "admin") {
    return <AdminHomePage />;
  }

  return <UserHomePage />;
}
