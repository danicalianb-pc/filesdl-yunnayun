import React, { useEffect, useState, useRef } from 'react';
import {
  DownloadCloud,
  File as FileIcon,
  Clock,
  Download,
  AlertCircle,
  CheckCircle2,
  Calendar,
  MessageSquare,
  ArrowLeft,
  Eye,
  Zap,
  Info
} from 'lucide-react';
import { FileMetadata, DownloadProgressState } from '../types';
import { formatBytes, formatTimeRemaining } from '../utils/formatters';

interface DownloadViewProps {
  fileId: string;
  onBackToHome: () => void;
}

export const DownloadView: React.FC<DownloadViewProps> = ({ fileId, onBackToHome }) => {
  const [meta, setMeta] = useState<FileMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState<boolean>(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressState>({
    stage: 'idle',
    percent: 0,
    loadedBytes: 0,
    totalBytes: 0,
    speedBps: 0,
    etaSeconds: 0,
  });

  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const lastTimeRef = useRef<number>(0);
  const lastLoadedRef = useRef<number>(0);

  // Fetch metadata on mount
  useEffect(() => {
    let isMounted = true;
    const fetchMeta = async () => {
      try {
        setLoadingMeta(true);
        setMetaError(null);

        const res = await fetch(`/api/files/${fileId}/meta`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Unable to locate file (${res.status})`);
        }

        const data: FileMetadata = await res.json();
        if (isMounted) {
          setMeta(data);
          setLoadingMeta(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setMetaError(err.message || 'File transfer is invalid or expired.');
          setLoadingMeta(false);
        }
      }
    };

    fetchMeta();
    return () => {
      isMounted = false;
    };
  }, [fileId]);

  // Handle direct file download with live progress tracking
  const handleDownload = async () => {
    if (!meta) return;

    try {
      setDownloadProgress({
        stage: 'downloading',
        percent: 0,
        loadedBytes: 0,
        totalBytes: meta.size,
        speedBps: 0,
        etaSeconds: 0,
      });

      const xhr = new XMLHttpRequest();
      xhr.open('GET', `/api/files/${fileId}/download`, true);
      xhr.responseType = 'blob';

      lastTimeRef.current = Date.now();
      lastLoadedRef.current = 0;

      xhr.onprogress = (event) => {
        if (event.lengthComputable || meta.size > 0) {
          const total = event.lengthComputable ? event.total : meta.size;
          const currentTime = Date.now();
          const timeDelta = (currentTime - lastTimeRef.current) / 1000;
          const loadedDelta = event.loaded - lastLoadedRef.current;

          let speed = 0;
          let eta = 0;

          if (timeDelta > 0.3) {
            speed = loadedDelta / timeDelta;
            const remainingBytes = total - event.loaded;
            eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;
            lastTimeRef.current = currentTime;
            lastLoadedRef.current = event.loaded;
          }

          const percent = Math.min(99, Math.round((event.loaded / total) * 100));

          setDownloadProgress((prev) => ({
            ...prev,
            percent,
            loadedBytes: event.loaded,
            totalBytes: total,
            speedBps: speed || prev.speedBps,
            etaSeconds: eta,
          }));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = xhr.response;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = meta.originalName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          setDownloadProgress({
            stage: 'completed',
            percent: 100,
            loadedBytes: meta.size,
            totalBytes: meta.size,
            speedBps: 0,
            etaSeconds: 0,
          });

          // Update download count in local display
          setMeta((prev) =>
            prev ? { ...prev, downloadCount: prev.downloadCount + 1 } : null
          );
        } else {
          setDownloadProgress({
            stage: 'error',
            percent: 0,
            loadedBytes: 0,
            totalBytes: 0,
            speedBps: 0,
            etaSeconds: 0,
            errorMessage: 'Download failed. The file may have expired or reached its download limit.',
          });
        }
      };

      xhr.onerror = () => {
        setDownloadProgress({
          stage: 'error',
          percent: 0,
          loadedBytes: 0,
          totalBytes: 0,
          speedBps: 0,
          etaSeconds: 0,
          errorMessage: 'Network error while receiving file.',
        });
      };

      xhr.send();
    } catch (err: any) {
      setDownloadProgress({
        stage: 'error',
        percent: 0,
        loadedBytes: 0,
        totalBytes: 0,
        speedBps: 0,
        etaSeconds: 0,
        errorMessage: err.message || 'An error occurred during download.',
      });
    }
  };

  const isImage = meta?.mimeType.startsWith('image/');
  const isVideo = meta?.mimeType.startsWith('video/');
  const isAudio = meta?.mimeType.startsWith('audio/');
  const isPdf = meta?.mimeType === 'application/pdf';
  const canPreview = isImage || isVideo || isAudio || isPdf;

  if (loadingMeta) {
    return (
      <div id="download-loading-container" className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin mx-auto mb-4" />
        <h3 className="text-base font-semibold text-stone-900">Locating shared file...</h3>
        <p className="text-sm text-stone-500 mt-1">Connecting to transfer registry</p>
      </div>
    );
  }

  if (metaError || !meta) {
    return (
      <div id="download-error-container" className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-8 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 mb-2">File Unavailable</h3>
        <p className="text-sm text-stone-600 mb-6 leading-relaxed">
          {metaError || 'This file link has expired, was deleted by the sender, or reached its maximum download limit.'}
        </p>
        <button
          id="back-home-error-btn"
          type="button"
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Upload a New File</span>
        </button>
      </div>
    );
  }

  return (
    <div id="download-view-container" className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 sm:p-8">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-stone-100 mb-6">
        <button
          id="back-home-top-btn"
          type="button"
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Uploads</span>
        </button>
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Ready to Download
        </span>
      </div>

      {/* Main File Details Card */}
      <div id="file-meta-card" className="rounded-xl border border-stone-200 bg-stone-50/70 p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-stone-900 truncate" title={meta.originalName}>
              {meta.originalName}
            </h2>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-stone-500 mt-1">
              <span className="font-semibold text-stone-700">{formatBytes(meta.size)}</span>
              <span>•</span>
              <span>{meta.mimeType}</span>
            </div>
          </div>
        </div>

        {/* Sender Note if present */}
        {meta.senderNote && (
          <div id="sender-note-box" className="mt-4 pt-3.5 border-t border-stone-200/70 flex items-start gap-2.5 text-xs text-stone-700 bg-white/70 p-3 rounded-lg">
            <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-stone-900 block mb-0.5">Note from sender:</span>
              <p className="leading-relaxed">{meta.senderNote}</p>
            </div>
          </div>
        )}
      </div>

      {/* Expiry & Limit Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center gap-3">
          <Clock className="w-4 h-4 text-stone-500 shrink-0" />
          <div className="min-w-0 text-xs">
            <span className="text-stone-500 block">Link Expiry</span>
            <span className="font-semibold text-stone-900 truncate">
              {meta.expiresAt ? formatTimeRemaining(meta.expiresAt) : 'Permanent link'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center gap-3">
          <DownloadCloud className="w-4 h-4 text-stone-500 shrink-0" />
          <div className="min-w-0 text-xs">
            <span className="text-stone-500 block">Download Count</span>
            <span className="font-semibold text-stone-900 truncate">
              {meta.downloadLimit > 0
                ? `${meta.downloadCount} of ${meta.downloadLimit} allowed`
                : `${meta.downloadCount} downloads`}
            </span>
          </div>
        </div>
      </div>

      {/* Live Download Progress */}
      {downloadProgress.stage === 'downloading' && (
        <div id="download-progress-card" className="mb-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-950 mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span>Downloading file...</span>
            </div>
            <span>{downloadProgress.percent}%</span>
          </div>

          <div className="w-full h-2.5 bg-indigo-200/60 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-200"
              style={{ width: `${downloadProgress.percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-stone-600">
            <span>
              {formatBytes(downloadProgress.loadedBytes)} of {formatBytes(downloadProgress.totalBytes)}
            </span>
            <div className="flex items-center gap-3">
              {downloadProgress.speedBps > 0 && <span>{formatBytes(downloadProgress.speedBps)}/s</span>}
              {downloadProgress.etaSeconds > 0 && (
                <span>ETA: {formatTimeRemaining(Date.now() + downloadProgress.etaSeconds * 1000)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completed Success Toast */}
      {downloadProgress.stage === 'completed' && (
        <div id="download-success-toast" className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">File downloaded directly to your device!</span>
        </div>
      )}

      {/* Download Error Alert */}
      {downloadProgress.stage === 'error' && (
        <div id="download-error-alert" className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-semibold text-rose-900">Download Error</h4>
            <p className="text-xs text-rose-700 mt-0.5">{downloadProgress.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          id="direct-download-btn"
          type="button"
          disabled={downloadProgress.stage === 'downloading'}
          onClick={handleDownload}
          className="w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-semibold text-base transition-all shadow-sm flex items-center justify-center gap-2.5 group"
        >
          <Download className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
          <span>
            {downloadProgress.stage === 'downloading'
              ? 'Downloading...'
              : `Download File (${formatBytes(meta.size)})`}
          </span>
        </button>

        {/* Optional In-Browser Preview Button */}
        {canPreview && (
          <button
            id="preview-file-toggle-btn"
            type="button"
            onClick={() => setPreviewOpen(!previewOpen)}
            className="w-full py-2.5 px-4 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 font-medium text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4 text-stone-500" />
            <span>{previewOpen ? 'Hide Preview' : 'Preview File Online'}</span>
          </button>
        )}
      </div>

      {/* In-Browser Preview Viewer */}
      {previewOpen && canPreview && (
        <div id="file-inline-preview" className="mt-6 pt-6 border-t border-stone-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
            File Preview
          </h4>
          <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-100 flex items-center justify-center max-h-96">
            {isImage && (
              <img
                src={`/api/files/${fileId}/raw`}
                alt={meta.originalName}
                className="max-h-96 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            )}
            {isVideo && (
              <video
                src={`/api/files/${fileId}/raw`}
                controls
                className="max-h-96 w-full object-contain"
              />
            )}
            {isAudio && (
              <div className="p-8 w-full">
                <audio src={`/api/files/${fileId}/raw`} controls className="w-full" />
              </div>
            )}
            {isPdf && (
              <iframe
                src={`/api/files/${fileId}/raw`}
                title={meta.originalName}
                className="w-full h-80 border-0"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
