export type ExpiryOption = '5m' | '1h' | '24h' | '3d' | '7d' | '30d' | 'permanent' | 'custom';

export type DownloadLimitOption = 1 | 3 | 5 | 10 | 0; // 0 = unlimited

export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  senderNote?: string;
  createdAt: number;
  expiresAt: number | null; // null = permanent
  downloadLimit: number; // 0 = unlimited
  downloadCount: number;
}

export interface ShareLinkData {
  fileId: string;
  deleteToken: string;
  originalName: string;
  size: number;
  expiresAt: number | null;
  downloadLimit: number;
  createdAt: number;
  shareUrl: string;
}

export interface UploadProgressState {
  stage: 'idle' | 'uploading' | 'completed' | 'error';
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  speedBps: number;
  etaSeconds: number;
  errorMessage?: string;
}

export interface DownloadProgressState {
  stage: 'idle' | 'downloading' | 'completed' | 'error';
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  speedBps: number;
  etaSeconds: number;
  errorMessage?: string;
}

export interface MyTransferItem {
  id: string;
  originalName: string;
  size: number;
  createdAt: number;
  expiresAt: number | null;
  downloadLimit: number;
  deleteToken: string;
  shareUrl: string;
}
