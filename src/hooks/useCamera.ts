import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { 
  CameraResponse, 
  CameraListResponse, 
  CameraCreate, 
  CameraUpdate, 
  StreamUrlResponse
} from "@/types";

export function useCamera() {
  const [cameras, setCameras] = useState<CameraResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCameras = useCallback(async (skip = 0, limit = 50, search = "") => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
      });
      if (search) queryParams.append("search", search);

      const data = await api.get<CameraListResponse>(`/api/cameras?${queryParams.toString()}`);
      setCameras(data.cameras);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.detail || "Không thể tải danh sách camera");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCamera = async (id: string) => {
    try {
      return await api.get<CameraResponse>(`/api/cameras/${id}`);
    } catch (err: any) {
      throw err;
    }
  };

  const createCamera = async (data: CameraCreate) => {
    setIsLoading(true);
    setError(null);
    try {
      const newCamera = await api.post<CameraResponse>("/api/cameras", data);
      setCameras(prev => [newCamera, ...prev]);
      setTotal(prev => prev + 1);
      return newCamera;
    } catch (err: any) {
      setError(err.detail || "Không thể thêm camera");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCamera = async (id: string, data: CameraUpdate) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedCamera = await api.put<CameraResponse>(`/api/cameras/${id}`, data);
      setCameras(prev => prev.map(c => c.id === id ? updatedCamera : c));
      return updatedCamera;
    } catch (err: any) {
      setError(err.detail || "Không thể cập nhật camera");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCamera = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.delete(`/api/cameras/${id}`);
      setCameras(prev => prev.filter(c => c.id !== id));
      setTotal(prev => prev - 1);
    } catch (err: any) {
      setError(err.detail || "Không thể xóa camera");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getStreamUrl = async (id: string, quality: "hd" | "sd" = "hd") => {
    try {
      return await api.get<StreamUrlResponse>(`/api/cameras/${id}/stream/${quality}`);
    } catch (err: any) {
      throw err;
    }
  };

  return {
    cameras,
    total,
    isLoading,
    error,
    fetchCameras,
    getCamera,
    createCamera,
    updateCamera,
    deleteCamera,
    getStreamUrl
  };
}
