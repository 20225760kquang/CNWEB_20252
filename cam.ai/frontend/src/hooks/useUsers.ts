import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { 
  UserResponse, 
  UserListResponse, 
  UserCreate, 
  UserUpdate, 
  UserDetailResponse,
  CameraPermission
} from "@/types";

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === "object" && "detail" in err) {
    return String((err as { detail?: string }).detail || fallback);
  }
  return fallback;
};

export function useUsers() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (skip = 0, limit = 20, search = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
      });
      if (search) queryParams.append("search", search);
      
      const data = await api.get<UserListResponse>(`/api/users?${queryParams.toString()}`);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Không thể tải danh sách người dùng"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createUser = async (data: UserCreate) => {
    setIsLoading(true);
    setError(null);
    try {
      const newUser = await api.post<UserResponse>("/api/users", data);
      setUsers(prev => [newUser, ...prev]);
      setTotal(prev => prev + 1);
      return newUser;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Không thể tạo người dùng"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (id: string, data: UserUpdate) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedUser = await api.put<UserResponse>(`/api/users/${id}`, data);
      setUsers(prev => prev.map(u => u.id === id ? updatedUser : u));
      return updatedUser;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Không thể cập nhật người dùng"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.delete(`/api/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Không thể xóa người dùng"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getUserDetail = async (id: string) => {
    return api.get<UserDetailResponse>(`/api/users/${id}`);
  };

  const assignCameras = async (userId: string, cameras: CameraPermission[]) => {
    await api.put(`/api/users/${userId}/cameras`, { cameras });
  };

  return {
    users,
    total,
    isLoading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserDetail,
    assignCameras
  };
}
