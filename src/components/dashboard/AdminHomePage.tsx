"use client";

import React, { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface Session {
  id: string;
  user: string;
  role: string;
  loginTime: string | null;
  initials: string;
  color: string;
  currentCamera: string;
}

interface AuditLog {
  id: string;
  timestamp: string | null;
  user: string;
  action: string;
  color: string;
}

interface DeviceEvent {
  id: string;
  timestamp: string | null;
  camera_name?: string;
  camera_location?: string;
  event_text?: string;
  message?: string;
  dot: string;
}

export default function AdminHomePage() {
  const { t } = useTranslation();
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  
  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilter, setAuditFilter] = useState<'day' | 'week' | ''>('');
  const [isAuditLoading, setIsAuditLoading] = useState(true);

  // Device Events
  const [deviceEvents, setDeviceEvents] = useState<DeviceEvent[]>([]);
  const [deviceTotal, setDeviceTotal] = useState(0);
  const [devicePage, setDevicePage] = useState(1);
  const [deviceFilter, setDeviceFilter] = useState<'day' | 'week' | ''>('');
  const [isDeviceLoading, setIsDeviceLoading] = useState(true);

  const ITEMS_PER_PAGE = 10;

  const fetchActiveSessions = async () => {
    try {
      const res = await api.get<{ sessions: Session[] }>("/api/system/active-sessions");
      setActiveSessions(res.sessions || []);
    } catch (error) {
      console.error("Failed to fetch active sessions:", error);
    }
  };

  const getStartTime = (filter: string) => {
    if (!filter) return "";
    const date = new Date();
    date.setHours(0, 0, 0, 0); // Midnight local time
    if (filter === "week") {
      date.setDate(date.getDate() - 7);
    }
    return date.toISOString();
  };

  const fetchAuditLogs = async () => {
    setIsAuditLoading(true);
    try {
      const skip = (auditPage - 1) * ITEMS_PER_PAGE;
      let url = `/api/system/audit-logs?skip=${skip}&limit=${ITEMS_PER_PAGE}`;
      
      const startTime = getStartTime(auditFilter);
      if (startTime) url += `&start_time=${startTime}`;
      
      const res = await api.get<{ logs: AuditLog[], total: number }>(url);
      setAuditLogs(res.logs || []);
      setAuditTotal(res.total || 0);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const fetchDeviceEvents = async () => {
    setIsDeviceLoading(true);
    try {
      const skip = (devicePage - 1) * ITEMS_PER_PAGE;
      let url = `/api/system/device-events?skip=${skip}&limit=${ITEMS_PER_PAGE}`;
      
      const startTime = getStartTime(deviceFilter);
      if (startTime) url += `&start_time=${startTime}`;
      
      const res = await api.get<{ events: DeviceEvent[], total: number }>(url);
      setDeviceEvents(res.events || []);
      setDeviceTotal(res.total || 0);
    } catch (error) {
      console.error("Failed to fetch device events:", error);
    } finally {
      setIsDeviceLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [auditPage, auditFilter]);

  useEffect(() => {
    fetchDeviceEvents();
  }, [devicePage, deviceFilter]);

  const sessionColumns = [
    {
      key: "user",
      header: t('adminDashboard.user'),
      render: (item: any) => (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${item.color}`}>
            {item.initials}
          </div>
          <span className="font-medium text-on-surface">{item.user}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: t('adminDashboard.role'),
      render: (item: any) => (
        <span className="capitalize text-on-surface-variant">
          {item.role === 'admin' ? t('adminDashboard.adminRole') : item.role}
        </span>
      ),
    },
    {
      key: "loginTime",
      header: t('adminDashboard.loginTime'),
      render: (item: any) => (
        <span className="font-mono font-semibold">{item.loginTime ? new Date(item.loginTime).toLocaleTimeString("vi-VN") : "N/A"}</span>
      )
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Section 1: Active Sessions */}
      <section className="bg-surface rounded-2xl p-6 shadow-ambient">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
            {t('adminDashboard.activeSessions')}
          </h2>
          <Badge variant="success" className="w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            {activeSessions.length} {t('adminDashboard.onlineCount')}
          </Badge>
        </div>
        <Table
          columns={sessionColumns}
          data={activeSessions}
          keyExtractor={(item) => item.id}
        />
      </section>

      {/* Section 2: Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: User Audit Logs */}
        <section className="bg-surface rounded-2xl p-6 shadow-ambient flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-on-surface">{t('adminDashboard.auditLogs')}</h2>
            <select 
              value={auditFilter} 
              onChange={(e) => { setAuditFilter(e.target.value as any); setAuditPage(1); }}
              className="text-sm bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">Tất cả</option>
              <option value="day">Hôm nay</option>
              <option value="week">7 ngày qua</option>
            </select>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {isAuditLoading && auditLogs.length === 0 ? (
              <div className="flex justify-center p-8"><span className="material-symbols-outlined animate-spin text-primary">progress_activity</span></div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center p-8 text-on-surface-variant">{t('adminDashboard.noAuditLogs')}</div>
            ) : auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-4">
                <div className="font-mono text-sm font-semibold text-on-surface-variant mt-1 shrink-0 w-12 text-center">
                  <div>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }) : ""}</div>
                  <div className="text-[10px] opacity-70 leading-tight">{log.timestamp ? new Date(log.timestamp).toLocaleDateString("vi-VN") : ""}</div>
                </div>
                <div className="flex-1 bg-surface-variant/20 p-3 rounded-xl border border-outline-variant/30">
                  <span className={`font-bold text-sm mr-2 ${log.color}`}>{log.user}:</span>
                  <span className="text-sm text-on-surface">{log.action}</span>
                </div>
              </div>
            ))}
          </div>
          
          {auditTotal > ITEMS_PER_PAGE && (
            <div className="mt-4 pt-4 border-t border-outline-variant/30 shrink-0">
              <Pagination 
                currentPage={auditPage}
                totalPages={Math.ceil(auditTotal / ITEMS_PER_PAGE)}
                onPageChange={setAuditPage}
              />
            </div>
          )}
        </section>

        {/* Right: Device Event Logs */}
        <section className="bg-surface rounded-2xl p-6 shadow-ambient flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-on-surface">{t('adminDashboard.deviceEvents')}</h2>
            <select 
              value={deviceFilter} 
              onChange={(e) => { setDeviceFilter(e.target.value as any); setDevicePage(1); }}
              className="text-sm bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">Tất cả</option>
              <option value="day">Hôm nay</option>
              <option value="week">7 ngày qua</option>
            </select>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {isDeviceLoading && deviceEvents.length === 0 ? (
              <div className="flex justify-center p-8"><span className="material-symbols-outlined animate-spin text-primary">progress_activity</span></div>
            ) : deviceEvents.length === 0 ? (
              <div className="text-center p-8 text-on-surface-variant">{t('adminDashboard.noDeviceEvents')}</div>
            ) : deviceEvents.map((event) => {
              const camName = event.camera_name || (event.message ? event.message.split(": ")[0] : "Unknown");
              const camLoc = event.camera_location || "";
              const eventTxt = event.event_text || (event.message ? event.message.split(": ").slice(1).join(": ") : "");
              
              return (
              <div key={event.id} className="flex items-start gap-4">
                <div className="font-mono text-sm font-semibold text-on-surface-variant mt-1 shrink-0 w-12 text-center">
                  <div>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }) : ""}</div>
                  <div className="text-[10px] opacity-70 leading-tight">{event.timestamp ? new Date(event.timestamp).toLocaleDateString("vi-VN") : ""}</div>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${event.dot}`}></div>
                <div className="flex-1 bg-surface-variant/20 p-2.5 rounded-xl border border-outline-variant/30 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary shrink-0">videocam</span>
                  <div className="text-sm">
                    <span className="font-semibold text-on-surface">
                      Camera &quot;{camLoc ? `${camName} - ${camLoc}` : camName}&quot;
                    </span>
                    <span className="text-on-surface mx-1">:</span>
                    <span className="text-on-surface-variant">{eventTxt}</span>
                  </div>
                </div>
              </div>
            )})}
          </div>
          
          {deviceTotal > ITEMS_PER_PAGE && (
            <div className="mt-4 pt-4 border-t border-outline-variant/30 shrink-0">
              <Pagination 
                currentPage={devicePage}
                totalPages={Math.ceil(deviceTotal / ITEMS_PER_PAGE)}
                onPageChange={setDevicePage}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
