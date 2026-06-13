"use client";

import React, { useState, useEffect, useMemo } from "react";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import { useUsers } from "@/hooks/useUsers";
import { useCamera } from "@/hooks/useCamera";
import type { CameraPermission, CameraResponse } from "@/types";

export default function AccessControlPage() {
  const { users, fetchUsers, getUserDetail, assignCameras } = useUsers();
  const { cameras, fetchCameras } = useCamera();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{type: "success"|"error", message: string} | null>(null);
  
  // Map of cameraId -> CameraPermission
  const [accessMap, setAccessMap] = useState<Record<string, CameraPermission>>({});
  
  // Camera counts for each viewer
  const [cameraCounts, setCameraCounts] = useState<Record<string, number>>({});

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch users (only viewers) & all cameras on mount or search
  useEffect(() => {
    fetchUsers(0, 100, debouncedSearch);
    fetchCameras(0, 100);
  }, [debouncedSearch, fetchUsers, fetchCameras]);

  // Filter out admins (only viewers can have specific camera access)
  const viewers = useMemo(() => users.filter(u => u.role === "viewer"), [users]);

  // Select first user automatically if none selected
  useEffect(() => {
    if (!selectedUserId && viewers.length > 0) {
      setSelectedUserId(viewers[0].id);
    }
  }, [viewers, selectedUserId]);

  // Fetch camera counts for all viewers
  useEffect(() => {
    if (viewers.length > 0) {
      let isMounted = true;
      const fetchCounts = async () => {
        const counts: Record<string, number> = {};
        await Promise.all(
          viewers.map(async (u) => {
            try {
              const detail = await getUserDetail(u.id);
              if (isMounted) {
                counts[u.id] = detail.camera_access.length;
              }
            } catch (e) {
              if (isMounted) counts[u.id] = 0;
            }
          })
        );
        if (isMounted) {
          setCameraCounts(prev => ({ ...prev, ...counts }));
        }
      };
      fetchCounts();
      return () => { isMounted = false; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewers]);

  // Fetch user detail when selected user changes
  useEffect(() => {
    async function loadDetail() {
      if (!selectedUserId) return;
      setIsFetchingDetail(true);
      try {
        const detail = await getUserDetail(selectedUserId);
        const newAccessMap: Record<string, CameraPermission> = {};
        detail.camera_access.forEach(acc => {
          newAccessMap[acc.camera_id] = {
            camera_id: acc.camera_id,
            can_playback: acc.can_playback,
            can_export: acc.can_export
          };
        });
        setAccessMap(newAccessMap);
      } catch (err) {
        console.error("Failed to load user detail", err);
      } finally {
        setIsFetchingDetail(false);
      }
    }
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  // Group cameras by location
  const groupedCameras = useMemo(() => {
    const groups: Record<string, CameraResponse[]> = {};
    cameras.forEach(cam => {
      const loc = cam.location || "Chưa xác định";
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(cam);
    });
    return groups;
  }, [cameras]);

  const handleToggleCamera = (cameraId: string) => {
    setAccessMap(prev => {
      const next = { ...prev };
      if (next[cameraId]) {
        delete next[cameraId];
      } else {
        next[cameraId] = { camera_id: cameraId, can_playback: true, can_export: false }; // Default permissions
      }
      return next;
    });
  };

  const handleToggleGroup = (location: string) => {
    const groupCams = groupedCameras[location] || [];
    const allChecked = groupCams.every(c => !!accessMap[c.id]);
    
    setAccessMap(prev => {
      const next = { ...prev };
      if (allChecked) {
        // Uncheck all
        groupCams.forEach(c => delete next[c.id]);
      } else {
        // Check all
        groupCams.forEach(c => {
          next[c.id] = { camera_id: c.id, can_playback: true, can_export: false };
        });
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      await assignCameras(selectedUserId, Object.values(accessMap));
      setCameraCounts(prev => ({ ...prev, [selectedUserId]: Object.keys(accessMap).length }));
      setSaveStatus({ type: "success", message: "Đã lưu quyền thành công!" });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus({ type: "error", message: err.detail || "Có lỗi xảy ra khi lưu quyền." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reload detail to reset
    const temp = selectedUserId;
    setSelectedUserId(null);
    setTimeout(() => setSelectedUserId(temp), 0);
  };

  const selectedUserObj = viewers.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-on-surface mb-1">Phân quyền truy cập</h2>
          <p className="text-sm text-on-surface-variant">Quản lý quyền xem camera của từng người dùng trong hệ thống.</p>
        </div>
        <SearchInput 
          placeholder="Tìm kiếm người dùng để phân quyền..." 
          className="w-full sm:w-80"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: User List */}
        <div className="lg:col-span-5 space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2">
          {viewers.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">
              Không tìm thấy người dùng nào.
            </div>
          ) : (
            viewers.map((u) => (
              <div 
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  selectedUserId === u.id 
                    ? "border-primary bg-surface shadow-sm" 
                    : "border-outline-variant/30 bg-surface-variant/10 hover:border-outline-variant"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold uppercase ${
                      selectedUserId === u.id ? "bg-primary/20 text-primary" : "bg-surface-variant text-on-surface-variant"
                    }`}>
                      {u.username.substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface">{u.username}</span>
                      <span className="text-xs text-on-surface-variant mb-1">{u.email}</span>
                      <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full w-max">
                        Được truy cập vào {cameraCounts[u.id] !== undefined ? cameraCounts[u.id] : "..."} camera
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Permission Editor */}
        <div className="lg:col-span-7 bg-surface-variant/20 rounded-3xl p-6 border border-outline-variant/30 flex flex-col max-h-[800px]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">tune</span>
              <h3 className="text-xl font-bold text-on-surface truncate max-w-[200px] sm:max-w-[300px]">
                Cấp quyền: {selectedUserObj?.username || "..."}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {saveStatus && (
                <span className={`text-sm font-medium mr-2 animate-in fade-in zoom-in duration-200 ${saveStatus.type === "success" ? "text-primary" : "text-error"}`}>
                  {saveStatus.message}
                </span>
              )}
              <button 
                onClick={handleCancel}
                disabled={isSaving || isFetchingDetail}
                className="text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <Button 
                variant="primary" 
                onClick={handleSave} 
                isLoading={isSaving}
                disabled={isFetchingDetail || !selectedUserId}
                className="rounded-full shadow-sm"
              >
                Lưu thay đổi
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-on-surface-variant mb-6">Chọn các camera cho phép người dùng này xem trực tiếp và xem lại.</p>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
            {isFetchingDetail ? (
              <div className="flex justify-center p-8">
                <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
              </div>
            ) : Object.keys(groupedCameras).length === 0 ? (
              <div className="text-center text-on-surface-variant p-8">Chưa có camera nào trong hệ thống.</div>
            ) : (
              Object.entries(groupedCameras).map(([location, groupCams]) => {
                const checkedCount = groupCams.filter(c => !!accessMap[c.id]).length;
                const isAllChecked = checkedCount === groupCams.length;
                const isPartiallyChecked = checkedCount > 0 && !isAllChecked;

                return (
                  <div key={location}>
                    <div 
                      className="flex items-center gap-3 mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleToggleGroup(location)}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        isAllChecked ? "bg-primary text-on-primary" : 
                        isPartiallyChecked ? "bg-primary/50 text-on-primary" : 
                        "border-2 border-outline-variant"
                      }`}>
                        {(isAllChecked || isPartiallyChecked) && (
                          <span className="material-symbols-outlined text-[14px]">
                            {isAllChecked ? "check" : "remove"}
                          </span>
                        )}
                      </div>
                      <span className={`font-semibold ${isAllChecked || isPartiallyChecked ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {location} ({checkedCount}/{groupCams.length})
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8">
                      {groupCams.map((cam) => {
                        const isChecked = !!accessMap[cam.id];
                        return (
                          <div 
                            key={cam.id} 
                            className={`flex flex-col p-3 rounded-xl transition-colors ${
                              isChecked 
                                ? "bg-surface-variant/50 border border-primary/20" 
                                : "bg-surface border border-outline-variant/30 opacity-70 hover:opacity-100"
                            }`}
                          >
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="hidden"
                                checked={isChecked}
                                onChange={() => handleToggleCamera(cam.id)}
                              />
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                isChecked ? "bg-primary text-on-primary" : "border-2 border-outline-variant"
                              }`}>
                                {isChecked && <span className="material-symbols-outlined text-[14px]">check</span>}
                              </div>
                              <span className={`text-sm font-medium truncate ${
                                isChecked ? "text-on-surface" : "text-on-surface-variant"
                              }`}>
                                {cam.name}
                              </span>
                            </label>
                            
                            {isChecked && (
                              <div className="mt-3 ml-8 flex flex-col gap-2 border-t border-outline-variant/30 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                                    checked={accessMap[cam.id]?.can_playback || false}
                                    onChange={(e) => setAccessMap(prev => ({
                                      ...prev,
                                      [cam.id]: { ...prev[cam.id], can_playback: e.target.checked }
                                    }))}
                                  />
                                  <span className="text-xs text-on-surface-variant font-medium">Quyền xem lại (Playback)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                                    checked={accessMap[cam.id]?.can_export || false}
                                    onChange={(e) => setAccessMap(prev => ({
                                      ...prev,
                                      [cam.id]: { ...prev[cam.id], can_export: e.target.checked }
                                    }))}
                                  />
                                  <span className="text-xs text-on-surface-variant font-medium">Quyền tải xuống (Export)</span>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
