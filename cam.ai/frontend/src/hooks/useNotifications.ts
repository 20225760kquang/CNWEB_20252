import { useState, useEffect, useCallback, useRef } from "react";
import { WS_BASE_URL, API_BASE_URL } from "@/lib/api";
import { AIEvent } from "@/types";

export interface NotificationItem {
  id: string;
  event_id: string;
  camera_name: string;
  camera_location: string;
  event_text: string;
  is_read: boolean;
  created_at: string | null;
}

const MAX_VISIBLE_NOTIFICATIONS = 50;

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestEvent, setLatestEvent] = useState<AIEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${WS_BASE_URL}/api/ws/notifications?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (process.env.NODE_ENV === "development") {
        console.info("[WS] Connected for notifications");
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Convert WS event to NotificationItem format
        const newNotif: NotificationItem = {
          id: `temp-${data.id || Date.now()}`,
          event_id: data.id,
          camera_name: data.camera_name || "Unknown",
          camera_location: data.camera_location || "",
          event_text: data.event_type === "person_detected" ? "Phát hiện có người" : "Sự kiện",
          is_read: false,
          created_at: data.created_at,
        };

        setNotifications((prev) => {
          const updated = [newNotif, ...prev];
          return updated.slice(0, MAX_VISIBLE_NOTIFICATIONS);
        });
        
        setUnreadCount((prev) => prev + 1);
        setLatestEvent(data as AIEvent);
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => {
      console.warn("[WS] Error:", err);
      // Next.js overlay is triggered by console.error. 
      // We use console.warn to avoid the full-screen red error in dev mode when React Strict Mode aborts connections.
    };

    wsRef.current = ws;
  }, []);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications((data.notifications || []).slice(0, MAX_VISIBLE_NOTIFICATIONS));
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, fetchNotifications]);

  const markAllAsRead = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const markAsRead = async (id: string) => {
    if (id.startsWith("temp-")) return; // Temporary UI-only notification from WS, just skip API call or fetch full
    
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  return { notifications, unreadCount, markAllAsRead, markAsRead, fetchNotifications, latestEvent };
}
