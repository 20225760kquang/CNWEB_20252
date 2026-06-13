"use client";

import React, { useEffect, useState } from "react";
import { useUsers } from "@/hooks/useUsers";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import type { UserResponse, UserCreate, UserUpdate, UserRole } from "@/types";

export default function UserManagementPage() {
  const { users, total, fetchUsers, createUser, updateUser, deleteUser, isLoading, error } = useUsers();
  
  const [page, setPage] = useState(1);
  const limit = 5;
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  
  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, userId: string, username: string}>({
    isOpen: false,
    userId: "",
    username: ""
  });
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "viewer" as UserRole,
    is_active: true
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
    fetchUsers((page - 1) * limit, limit, debouncedSearch);
  }, [page, debouncedSearch, fetchUsers]);

  const totalPages = Math.ceil(total / limit) || 1;

  const handleOpenModal = (user?: UserResponse) => {
    setFormError("");
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: "", // Leave blank for edit
        role: user.role,
        is_active: user.is_active
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: "",
        email: "",
        password: "",
        role: "viewer",
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    
    try {
      if (editingUser) {
        const updateData: UserUpdate = {
          username: formData.username,
          email: formData.email,
          role: formData.role,
          is_active: formData.is_active
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await updateUser(editingUser.id, updateData);
      } else {
        if (!formData.password) {
          setFormError("Mật khẩu là bắt buộc khi tạo người dùng");
          return;
        }
        await createUser({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.detail || "Đã xảy ra lỗi");
    }
  };

  const handleDeleteClick = (id: string, username: string) => {
    setDeleteConfirm({ isOpen: true, userId: id, username });
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteUser(deleteConfirm.userId);
      setDeleteConfirm({ isOpen: false, userId: "", username: "" });
    } catch (err: any) {
      setFormError(err.detail || "Không thể xóa người dùng này");
      alert(err.detail || "Không thể xóa người dùng này");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: "user",
      header: "Người dùng",
      render: (item: UserResponse) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase">
            {item.username.substring(0, 2)}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-on-surface">{item.username}</span>
            <span className="text-xs text-on-surface-variant">{item.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Vai trò",
      render: (item: UserResponse) => (
        <Badge variant={item.role === "admin" ? "primary" : "neutral"}>
          {item.role === "admin" ? "Admin" : "Viewer"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (item: UserResponse) => (
        <Badge variant={item.is_active ? "success" : "danger"}>
          {item.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Ngày tạo",
      render: (item: UserResponse) => new Date(item.created_at).toLocaleDateString("vi-VN"),
    },
    {
      key: "actions",
      header: "Thao tác",
      render: (item: UserResponse) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleOpenModal(item)}
            className="p-2 rounded-full hover:bg-surface-variant text-on-surface-variant transition-colors"
            title="Sửa"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button 
            onClick={() => handleDeleteClick(item.id, item.username)}
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
          <h2 className="text-xl font-bold text-on-surface mb-1">Danh sách người dùng</h2>
          <p className="text-sm text-on-surface-variant">Quản lý tài khoản và phân quyền truy cập hệ thống.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <SearchInput 
            placeholder="Tìm kiếm người dùng..." 
            className="w-full sm:w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button 
            variant="primary" 
            icon="add"
            onClick={() => handleOpenModal()}
          >
            Thêm người dùng
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 text-sm text-error bg-error-container/20 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-outline-variant/30 overflow-hidden">
        {isLoading && users.length === 0 ? (
          <div className="p-8 flex justify-center">
            <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
          </div>
        ) : (
          <Table
            columns={columns}
            data={users}
            keyExtractor={(item) => item.id}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-on-surface-variant">
          Hiển thị {total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)} của {total} người dùng
        </span>
        {total > limit && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? "Cập nhật người dùng" : "Thêm người dùng mới"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {formError && (
            <div className="p-3 text-sm text-error bg-error-container/20 rounded-lg">
              {formError}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Tên đăng nhập</label>
            <input
              type="text"
              required
              className="w-full bg-surface-variant/30 border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full bg-surface-variant/30 border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">
              Mật khẩu {editingUser && <span className="text-on-surface-variant text-xs font-normal">(Bỏ trống nếu không đổi)</span>}
            </label>
            <input
              type="password"
              required={!editingUser}
              className="w-full bg-surface-variant/30 border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Vai trò</label>
              <select
                className="w-full bg-surface-variant/30 border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
              >
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            {editingUser && (
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">Trạng thái</label>
                <select
                  className="w-full bg-surface-variant/30 border border-outline-variant rounded-xl px-4 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={formData.is_active ? "true" : "false"}
                  onChange={(e) => setFormData({...formData, is_active: e.target.value === "true"})}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>
              {editingUser ? "Cập nhật" : "Tạo mới"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, userId: "", username: "" })}
        title="Xác nhận xóa"
        maxWidth="sm"
      >
        <div className="py-2">
          <div className="flex items-center gap-4 text-error mb-4">
            <span className="material-symbols-outlined text-4xl">warning</span>
            <p className="text-on-surface">
              Bạn có chắc chắn muốn xóa người dùng <span className="font-bold">"{deleteConfirm.username}"</span>? 
              Hành động này không thể hoàn tác.
            </p>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/30">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirm({ isOpen: false, userId: "", username: "" })}
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
              Xóa người dùng
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
