import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export interface StreamItem {
  id: number;
  name: string;
  stream_key: string;
  is_active: boolean;
  is_public: boolean;
  auto_record: boolean;
  created_at: string;
  is_live: boolean;
  viewers_count: number;
  recordings_count: number;
  rtmp_url: string;
  rtsp_url: string;
  webrtc_url: string;
  hls_url: string;
  domain_rtmp: string;
  domain_hls: string;
  domain_webrtc: string;
}

export interface RecordingItem {
  id: number;
  stream_id: number;
  stream_name: string;
  stream_key: string;
  filename: string;
  duration_s: number;
  file_size: number;
  file_size_formatted: string;
  is_kept: boolean;
  expires_at: string | null;
  days_until_expiry: number | null;
  created_at: string;
  stream_url: string;
  download_url: string;
}

export interface StorageStats {
  total_recordings: number;
  total_bytes: number;
  total_gb: string;
  kept_count: number;
  expiring_count: number;
  retention_days: number;
}

export interface UserState {
  authenticated: boolean;
  guest: boolean;
  user: {
    id: number;
    username: string;
    role: string;
  } | null;
}
