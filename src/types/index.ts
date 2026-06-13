// ============================================================
// Entity Types — Mirrors backend Pydantic schemas / DB models
// ============================================================

// ---- Enums ----

export type UserRole = "admin" | "viewer";

export type CameraStatus = "online" | "offline" | "error";

export type RecordingStatus = "recording" | "completed" | "expired";

export type ExportStatus = "processing" | "ready" | "expired";

export type EventType = "person_detected" | "camera_offline";

// ---- Auth ----

export interface UserBrief {
  id: string;
  username: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserBrief;
}

export interface TokenRefreshResponse {
  access_token: string;
  token_type: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

// ---- User ----

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface UserUpdate {
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface CameraPermission {
  camera_id: string;
  can_playback?: boolean;
  can_export?: boolean;
}

export interface UserCameraAssign {
  cameras: CameraPermission[];
}

export interface CameraAccessResponse {
  camera_id: string;
  camera_name: string;
  can_playback: boolean;
  can_export: boolean;
  granted_at: string;
}

export interface UserDetailResponse extends UserResponse {
  camera_access: CameraAccessResponse[];
}

// ---- Camera ----

export interface CameraResponse {
  id: string;
  name: string;
  rtsp_url_hd: string;
  rtsp_url_sd?: string | null;
  location?: string | null;
  status: CameraStatus;
  recording_enabled: boolean;
  ai_enabled: boolean;
  stream_hd?: string | null;
  stream_sd?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CameraListResponse {
  cameras: CameraResponse[];
  total: number;
}

export interface CameraCreate {
  name: string;
  rtsp_url_hd: string;
  rtsp_url_sd?: string;
  location?: string;
  recording_enabled?: boolean;
  ai_enabled?: boolean;
}

export interface CameraUpdate {
  name?: string;
  rtsp_url_hd?: string;
  rtsp_url_sd?: string;
  location?: string;
  status?: CameraStatus;
  recording_enabled?: boolean;
  ai_enabled?: boolean;
}

export interface StreamUrlResponse {
  camera_id: string;
  camera_name: string;
  webrtc_url: string;
  quality: string;
}

// ---- Recording ----

export interface RecordingResponse {
  id: string;
  camera_id: string;
  start_time: string;
  end_time?: string | null;
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  status: RecordingStatus;
  minio_playlist_key: string;
  created_at: string;
}

export interface RecordingListResponse {
  recordings: RecordingResponse[];
  total: number;
}

export interface PlaybackUrlResponse {
  recording_id: string;
  camera_id: string;
  playlist_url: string;
  start_time: string;
  end_time?: string | null;
  status: RecordingStatus;
}

export interface RecordingStatusResponse {
  active_cameras: number;
  cameras: Record<string, unknown>[];
}

// ---- Events (Sprint 4) ----

export interface EventResponse {
  id: string;
  camera_id: string;
  camera_name?: string;
  event_type: EventType;
  snapshot_minio_key?: string | null;
  snapshot_url?: string | null;
  created_at: string;
}

export type AIEvent = EventResponse;

// ---- Snapshot (Sprint 5) ----

export interface SnapshotResponse {
  id: string;
  camera_id: string;
  user_id?: string | null;
  captured_at: string;
  minio_key: string;
  source: "live" | "playback";
  created_at: string;
}

// ---- Clip Export (Sprint 5) ----

export interface ClipExportResponse {
  id: string;
  user_id?: string | null;
  recording_id: string;
  clip_start: string;
  clip_end: string;
  minio_key?: string | null;
  status: ExportStatus;
  created_at: string;
}

// ---- WebSocket Notification (Sprint 4) ----

export interface WsNotification {
  event_type: EventType;
  camera_id: string;
  camera_name: string;
  timestamp: string;
  snapshot_url?: string;
}

// ---- Generic API Error ----

export interface ApiError {
  detail: string;
}
