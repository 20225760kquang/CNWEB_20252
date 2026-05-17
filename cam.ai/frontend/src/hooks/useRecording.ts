import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { 
  RecordingResponse, 
  RecordingListResponse, 
  PlaybackUrlResponse 
} from "@/types";

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === "object" && "detail" in err) {
    return String((err as { detail?: string }).detail || fallback);
  }
  return fallback;
};

export function useRecording() {
  const [recordings, setRecordings] = useState<RecordingResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecordings = useCallback(async (cameraId?: string, skip = 0, limit = 50) => {
    if (!cameraId) {
      setRecordings([]);
      setTotal(0);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/cameras/${cameraId}/recordings?skip=${skip}&limit=${limit}&hours=6`;
      const data = await api.get<RecordingListResponse>(url);
      setRecordings(data.recordings);
      setTotal(data.total);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Không thể tải danh sách bản ghi"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPlaybackUrl = async (recordingId: string) => {
    return api.get<PlaybackUrlResponse>(`/api/recordings/${recordingId}/playback`);
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
