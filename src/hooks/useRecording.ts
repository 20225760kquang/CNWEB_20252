import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { 
  RecordingResponse, 
  RecordingListResponse, 
  PlaybackUrlResponse 
} from "@/types";

export function useRecording() {
  const [recordings, setRecordings] = useState<RecordingResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecordings = useCallback(async (cameraId?: string, skip = 0, limit = 50) => {
    setIsLoading(true);
    setError(null);
    try {
      let url = cameraId 
        ? `/api/cameras/${cameraId}/recordings?skip=${skip}&limit=${limit}&hours=6`
        : `/api/cameras/all/recordings?skip=${skip}&limit=${limit}&hours=6`; // Fallback, though API expects camera_id
      const data = await api.get<RecordingListResponse>(url);
      setRecordings(data.recordings);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.detail || "Không thể tải danh sách bản ghi");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPlaybackUrl = async (recordingId: string) => {
    try {
      return await api.get<PlaybackUrlResponse>(`/api/recordings/${recordingId}/playback`);
    } catch (err: any) {
      throw err;
    }
  };

  return {
    recordings,
    total,
    isLoading,
    error,
    fetchRecordings,
    getPlaybackUrl,
  };
}
