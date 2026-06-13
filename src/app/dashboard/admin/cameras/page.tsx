"use client";

import React, { useEffect, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import type { CameraResponse, CameraCreate, CameraUpdate, CameraStatus } from "@/types";

export default function CameraManagementPage() {
  const { cameras, total, fetchCameras, createCamera, updateCamera, deleteCamera, isLoading, error } = useCamera();
  
  const [page, setPage] = useState(1);
  const limit = 5;
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CameraResponse | null>(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, name: string}>({
    isOpen: false,
    id: "",
    name: ""
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<CameraCreate & { status?: CameraStatus }>({
    name: "",
    location: "",
    rtsp_url_hd: "",
    rtsp_url_sd: "",
    recording_enabled: false,
    ai_enabled: false,
  });
  
  const [formError, setFormError] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchCameras((page - 1) * limit, limit, debouncedSearch);
  }, [page, debouncedSearch, fetchCameras]);

  const totalPages = Math.ceil(total / limit) || 1;

  const handleOpenModal = (camera?: CameraResponse) => {
    setFormError("");
    if (camera) {
      setEditingCamera(camera);
      setFormData({
        name: camera.name,
        location: camera.location || "",
        rtsp_url_hd: camera.rtsp_url_hd,
        rtsp_url_sd: camera.rtsp_url_sd || "",
        recording_enabled: camera.recording_enabled,
        ai_enabled: camera.ai_enabled,
        status: camera.status, // only for edit
      });
    } else {
      setEditingCamera(null);
      setFormData({
        name: "",
        location: "",
        rtsp_url_hd: "",
        rtsp_url_sd: "",
        recording_enabled: false,
        ai_enabled: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    
    try {
      if (editingCamera) {
        const updateData: CameraUpdate = {
          name: formData.name,
          location: formData.location,
          rtsp_url_hd: formData.rtsp_url_hd,
          rtsp_url_sd: formData.rtsp_url_sd,
          recording_enabled: formData.recording_enabled,
          ai_enabled: formData.ai_enabled,
          status: formData.status
        };
        await updateCamera(editingCamera.id, updateData);
      } else {
        await createCamera({
          name: formData.name,
          location: formData.location,
          rtsp_url_hd: formData.rtsp_url_hd,
          rtsp_url_sd: formData.rtsp_url_sd,
          recording_enabled: formData.recording_enabled,
          ai_enabled: formData.ai_enabled
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.detail || "Đã xảy ra lỗi");
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteCamera(deleteConfirm.id);
      setDeleteConfirm({ isOpen: false, id: "", name: "" });
    } catch (err: any) {
      setFormError(err.detail || "Không thể xóa camera này");
      alert(err.detail || "Không thể xóa camera này");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: "camera",
      header: "Camera",
      render: (item: CameraResponse) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center text-on-surface">
            <span className="material-symbols-outlined">videocam</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-on-surface">{item.name}</span>
            <span className="text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              {item.location || "Chưa xác định"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (item: CameraResponse) => {
        let variant: "success" | "danger" | "warning" = "warning";
        let label = "Đang tải";
        
        if (item.status === "online") {
          variant = "success";
          label = "Online";
        } else if (item.status === "offline") {
          variant = "danger";
          label = "Offline";
        } else if (item.status === "error") {
          variant = "danger";
          label = "Lỗi kết nối";
        }

        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      key: "features",
      header: "Tính năng",
      render: (item: CameraResponse) => (
        <div className="flex gap-2">
          <Badge variant={item.recording_enabled ? "primary" : "neutral"} className="text-xs">
            <span className="material-symbols-outlined text-[14px] mr-1"></span>
            Ghi hình
          </Badge>
          <Badge variant={item.ai_enabled ? "primary" : "neutral"} className="text-xs">
            <span className="material-symbols-outlined text-[14px] mr-1"></span>
            AI
          </Badge>
        </div>
      ),
    },
    {
      key: "rtsp",
      header: "Nguồn phát",
      render: (item: CameraResponse) => (
        <div className="flex flex-col gap-1 max-w-[200px]">
          <div className="text-xs text-on-surface-variant truncate" title={item.rtsp_url_hd}>
            <span className="font-semibold mr-1">HD:</span>
            {item.rtsp_url_hd}
          </div>
          {item.rtsp_url_sd && (
            <div className="text-xs text-on-surface-variant truncate" title={item.rtsp_url_sd}>
              <span className="font-semibold mr-1">SD:</span>
              {item.rtsp_url_sd}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      render: (item: CameraResponse) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleOpenModal(item)}
            className="p-2 rounded-full hover:bg-surface-variant text-on-surface-variant transition-colors"
            title="Sửa"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button 
            onClick={() => handleDeleteClick(item.id, item.name)}
            className="p-2 rounded-full hover:bg-error-container text-error transition-colors"
            title="Xóa"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-on-surface mb-1">Quản lý Camera</h2>
          <p className="text-sm text-on-surface-variant">Thêm mới, cấu hình RTSP và các tính năng của camera.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <SearchInput 
            placeholder="Tìm kiếm camera..." 
            className="w-full sm:w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button 
            variant="primary" 
            icon="add"
            onClick={() => handleOpenModal()}
          >
            Thêm camera
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 text-sm text-error bg-error-container/20 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-outline-variant/30 overflow-hidden">
        {isLoading && cameras.length === 0 ? (
          <div className="p-8 flex justify-center">
            <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
          </div>
        ) : (
          <Table
            columns={columns}
            data={cameras}
            keyExtractor={(item) => item.id}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-on-surface-variant">
          Hiển thị {total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)} của {total} camera
        </span>
        {total > limit && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCamera ? "Cập nhật camera" : "Thêm camera mới"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {formError && (
            <div className="p-3 text-sm text-error bg-error-container/20 rounded-lg">
              {formError}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Tên camera</label>
            <input
              type="text"
              required
              // placeholder="VD: Camera Sảnh chính"
              className="w-full bg-surface-variant/30 border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Vị trí đặt</label>
            <input
              type="text"
              // placeholder="VD: Tầng 1, Khu A"
              className="w-full bg-surface-variant/30 border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Đường dẫn RTSP HD (Luồng chính)</label>
            <input
              type="text"
              required
              placeholder="rtsp://admin:pass@ip:554/cam/realmonitor?channel=1&subtype=0"
              className="w-full bg-surface-variant/30 border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
              value={formData.rtsp_url_hd}
              onChange={(e) => setFormData({...formData, rtsp_url_hd: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Đường dẫn RTSP SD (Luồng phụ)</label>
            <input
              type="text"
              placeholder="rtsp://admin:pass@ip:554/cam/realmonitor?channel=1&subtype=1"
              className="w-full bg-surface-variant/30 border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
              value={formData.rtsp_url_sd}
              onChange={(e) => setFormData({...formData, rtsp_url_sd: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-4 bg-surface-variant/30 border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-variant/50 transition-colors">
              <input 
                type="checkbox" 
                className="w-5 h-5 accent-primary" 
                checked={formData.recording_enabled}
                onChange={(e) => setFormData({...formData, recording_enabled: e.target.checked})}
              />
              <div className="flex flex-col">
                {/* <span className="text-sm font-medium text-on-surface">Lưu trữ video</span> */}
                <span className="text-xs text-on-surface-variant">Cho phép ghi hình</span>
              </div>
            </label>
            
            <label className="flex items-center gap-3 p-4 bg-surface-variant/30 border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-variant/50 transition-colors">
              <input 
                type="checkbox" 
                className="w-5 h-5 accent-primary" 
                checked={formData.ai_enabled}
                onChange={(e) => setFormData({...formData, ai_enabled: e.target.checked})}
              />
              <div className="flex flex-col">
                {/* <span className="text-sm font-medium text-on-surface">AI Phân tích</span> */}
                <span className="text-xs text-on-surface-variant">Tích hợp AI</span>
              </div>
            </label>
          </div>



          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>
              {editingCamera ? "Cập nhật" : "Tạo mới"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: "", name: "" })}
        title="Xác nhận xóa"
        maxWidth="sm"
      >
        <div className="py-2">
          <div className="flex items-center gap-4 text-error mb-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="text-on-surface">
              Bạn có chắc chắn muốn xóa camera <span className="font-bold">"{deleteConfirm.name}"</span>? 
              Hành động này sẽ xóa toàn bộ dữ liệu video đã ghi hình của camera này!
            </p>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/30">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirm({ isOpen: false, id: "", name: "" })}
              disabled={isDeleting}
            >
              Hủy
            </Button>
            <Button 
              variant="primary" 
              onClick={executeDelete} 
              isLoading={isDeleting}
              className="!bg-error hover:!bg-error/90 !text-white border-none"
            >
              Xóa camera
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
