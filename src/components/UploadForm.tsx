import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  File as FileIcon,
  X,
  Clock,
  DownloadCloud,
  FileText,
  AlertCircle,
  Zap,
  ArrowRight
} from 'lucide-react';
import { ExpiryOption, DownloadLimitOption, ShareLinkData, UploadProgressState } from '../types';
import { formatBytes, formatTimeRemaining } from '../utils/formatters';
import { generateToken, arrayBufferToBase64 } from '../utils/crypto';

interface UploadFormProps {
  onUploadSuccess: (shareData: ShareLinkData) => void;
}

export const UploadForm: React.FC<UploadFormProps> = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState<ExpiryOption>('24h');
  const [customDays, setCustomDays] = useState<number>(1);
  const [downloadLimit, setDownloadLimit] = useState<DownloadLimitOption>(0);
  const [senderNote, setSenderNote] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [progress, setProgress] = useState<UploadProgressState>({
    stage: 'idle',
    percent: 0,
    loadedBytes: 0,
    totalBytes: 0,
    speedBps: 0,
    etaSeconds: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastLoadedRef = useRef<number>(0);

  const calculateExpiryTimestamp = (opt: ExpiryOption, days: number): number | null => {
    const now = Date.now();
    switch (opt) {
      case '5m':
        return now + 5 * 60 * 1000;
      case '1h':
        return now + 60 * 60 * 1000;
      case '24h':
        return now + 24 * 60 * 60 * 1000;
      case '3d':
        return now + 3 * 24 * 60 * 60 * 1000;
      case '7d':
        return now + 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return now + 30 * 24 * 60 * 60 * 1000;
      case 'custom':
        return now + Math.max(1, days) * 24 * 60 * 60 * 1000;
      case 'permanent':
      default:
        return null;
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setProgress({
      stage: 'idle',
      percent: 0,
      loadedBytes: 0,
      totalBytes: 0,
      speedBps: 0,
      etaSeconds: 0,
    });
  };

  const startUpload = async () => {
    if (!selectedFile) return;

    // File limit check (200MB in browser memory buffer)
    if (selectedFile.size > 200 * 1024 * 1024) {
      setProgress({
        stage: 'error',
        percent: 0,
        loadedBytes: 0,
        totalBytes: 0,
        speedBps: 0,
        etaSeconds: 0,
        errorMessage: 'File size exceeds current 200MB limit.',
      });
      return;
    }

    try {
      setProgress({
        stage: 'uploading',
        percent: 0,
        loadedBytes: 0,
        totalBytes: selectedFile.size,
        speedBps: 0,
        etaSeconds: 0,
      });

      const fileId = generateToken(8);
      const deleteToken = generateToken(16);
      const expiresAt = calculateExpiryTimestamp(expiry, customDays);

      // Read file data
      const arrayBuffer = await selectedFile.arrayBuffer();
      const base64Data = arrayBufferToBase64(arrayBuffer);

      // Setup XHR for upload tracking
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      lastTimeRef.current = Date.now();
      lastLoadedRef.current = 0;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const currentTime = Date.now();
          const timeDelta = (currentTime - lastTimeRef.current) / 1000;
          const loadedDelta = event.loaded - lastLoadedRef.current;

          let speed = 0;
          let eta = 0;

          if (timeDelta > 0.3) {
            speed = loadedDelta / timeDelta;
            const remainingBytes = event.total - event.loaded;
            eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;
            lastTimeRef.current = currentTime;
            lastLoadedRef.current = event.loaded;
          }

          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));

          setProgress((prev) => ({
            ...prev,
            percent,
            loadedBytes: event.loaded,
            totalBytes: event.total,
            speedBps: speed || prev.speedBps,
            etaSeconds: eta,
          }));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const resp = JSON.parse(xhr.responseText);
          setProgress({
            stage: 'completed',
            percent: 100,
            loadedBytes: selectedFile.size,
            totalBytes: selectedFile.size,
            speedBps: 0,
            etaSeconds: 0,
          });

          // Generate share link
          const baseUrl = window.location.origin;
          const shareUrl = `${baseUrl}/#download=${fileId}`;

          const shareData: ShareLinkData = {
            fileId,
            deleteToken,
            originalName: selectedFile.name,
            size: selectedFile.size,
            expiresAt,
            downloadLimit,
            createdAt: Date.now(),
            shareUrl,
          };

          // Save to local storage transfer history
          try {
            const stored = localStorage.getItem('yun_transfers');
            const list = stored ? JSON.parse(stored) : [];
            list.unshift({
              id: fileId,
              originalName: selectedFile.name,
              size: selectedFile.size,
              createdAt: Date.now(),
              expiresAt,
              downloadLimit,
              deleteToken,
              shareUrl,
            });
            localStorage.setItem('yun_transfers', JSON.stringify(list.slice(0, 30)));
          } catch (e) {
            console.error('Failed to update local transfers storage:', e);
          }

          setTimeout(() => {
            onUploadSuccess(shareData);
          }, 300);
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            throw new Error(errJson.error || `Upload failed with status ${xhr.status}`);
          } catch (e: any) {
            throw new Error(e.message || `Upload failed (${xhr.status})`);
          }
        }
      };

      xhr.onerror = () => {
        setProgress({
          stage: 'error',
          percent: 0,
          loadedBytes: 0,
          totalBytes: 0,
          speedBps: 0,
          etaSeconds: 0,
          errorMessage: 'Network error occurred during file transfer.',
        });
      };

      xhr.open('POST', '/api/files/upload', true);
      xhr.setRequestHeader('Content-Type', 'application/json');

      const payload = {
        id: fileId,
        originalName: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
        size: selectedFile.size,
        fileBase64: base64Data,
        senderNote: senderNote.trim() || undefined,
        expiresAt,
        downloadLimit,
        deleteToken,
      };

      xhr.send(JSON.stringify(payload));
    } catch (err: any) {
      console.error('Upload preparation error:', err);
      setProgress({
        stage: 'error',
        percent: 0,
        loadedBytes: 0,
        totalBytes: 0,
        speedBps: 0,
        etaSeconds: 0,
        errorMessage: err.message || 'Failed to prepare file for upload.',
      });
    }
  };

  const isUploading = progress.stage === 'uploading';

  return (
    <div id="upload-form-container" className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 sm:p-8">
      {/* File Dropzone Area */}
      {!selectedFile ? (
        <div
          id="dropzone-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed transition-all p-8 sm:p-12 text-center flex flex-col items-center justify-center ${
            isDragging
              ? 'border-indigo-600 bg-indigo-50/50 scale-[0.99]'
              : 'border-stone-300 hover:border-indigo-500 hover:bg-stone-50/60'
          }`}
        >
          <input
            id="file-input-hidden"
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900 mb-1">
            Choose a file or drag & drop here
          </h3>
          <p className="text-sm text-stone-500 max-w-sm mb-4">
            Fast, direct transfer up to 200MB. Documents, images, archives, videos, or code.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-medium transition-colors">
            <FileIcon className="w-4 h-4 text-stone-600" />
            <span>Browse Computer</span>
          </div>
        </div>
      ) : (
        <div id="selected-file-preview" className="rounded-xl border border-stone-200 bg-stone-50 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <FileIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900 truncate max-w-xs sm:max-w-md">
                  {selectedFile.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                  <span className="font-medium text-stone-700">{formatBytes(selectedFile.size)}</span>
                  <span>•</span>
                  <span>{selectedFile.type || 'Binary File'}</span>
                </div>
              </div>
            </div>

            {!isUploading && (
              <button
                id="remove-file-button"
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-200/60 transition-colors"
                title="Remove file"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress & Status Display */}
      {progress.stage === 'uploading' && (
        <div id="upload-progress-card" className="mb-6 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-950 mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span>Uploading to server...</span>
            </div>
            <span>{progress.percent}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-indigo-200/60 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-200"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-stone-600">
            <span>
              {formatBytes(progress.loadedBytes)} of {formatBytes(progress.totalBytes)}
            </span>
            <div className="flex items-center gap-3">
              {progress.speedBps > 0 && <span>{formatBytes(progress.speedBps)}/s</span>}
              {progress.etaSeconds > 0 && (
                <span>ETA: {formatTimeRemaining(Date.now() + progress.etaSeconds * 1000)}</span>
              )}
              <button
                id="cancel-upload-btn"
                type="button"
                onClick={cancelUpload}
                className="text-rose-600 hover:underline font-medium ml-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {progress.stage === 'error' && (
        <div id="upload-error-alert" className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-rose-900">Upload failed</h4>
            <p className="text-xs text-rose-700 mt-0.5">{progress.errorMessage}</p>
          </div>
          <button
            id="dismiss-error-btn"
            type="button"
            onClick={() => setProgress((p) => ({ ...p, stage: 'idle' }))}
            className="text-xs font-semibold text-rose-800 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sharing Options Configuration */}
      <div id="transfer-options" className="mt-6 pt-6 border-t border-stone-200/80 space-y-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Transfer & Expiration Settings
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Expiration Options */}
          <div>
            <label htmlFor="expiry-select" className="block text-xs font-medium text-stone-700 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              Link Expiration
            </label>
            <select
              id="expiry-select"
              value={expiry}
              disabled={isUploading}
              onChange={(e) => setExpiry(e.target.value as ExpiryOption)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="5m">5 Minutes (Burn fast)</option>
              <option value="1h">1 Hour</option>
              <option value="24h">24 Hours (Standard)</option>
              <option value="3d">3 Days</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="permanent">Permanent (Until deleted)</option>
              <option value="custom">Custom Days</option>
            </select>
          </div>

          {/* Download Limit */}
          <div>
            <label htmlFor="download-limit-select" className="block text-xs font-medium text-stone-700 mb-1.5 flex items-center gap-1.5">
              <DownloadCloud className="w-3.5 h-3.5 text-stone-500" />
              Download Limit
            </label>
            <select
              id="download-limit-select"
              value={downloadLimit}
              disabled={isUploading}
              onChange={(e) => setDownloadLimit(Number(e.target.value) as DownloadLimitOption)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value={0}>Unlimited downloads</option>
              <option value={1}>1 download (Self-destruct)</option>
              <option value={3}>3 downloads</option>
              <option value={5}>5 downloads</option>
              <option value={10}>10 downloads</option>
            </select>
          </div>
        </div>

        {/* Custom Days Input if selected */}
        {expiry === 'custom' && (
          <div>
            <label htmlFor="custom-days-input" className="block text-xs font-medium text-stone-700 mb-1">
              Set Expiration (Number of Days)
            </label>
            <input
              id="custom-days-input"
              type="number"
              min="1"
              max="365"
              value={customDays}
              disabled={isUploading}
              onChange={(e) => setCustomDays(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Optional Note for recipient */}
        <div>
          <label htmlFor="sender-note-input" className="block text-xs font-medium text-stone-700 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-stone-500" />
            Message or note for recipient (optional)
          </label>
          <input
            id="sender-note-input"
            type="text"
            placeholder="e.g. Here is the contract draft we discussed earlier"
            value={senderNote}
            disabled={isUploading}
            onChange={(e) => setSenderNote(e.target.value)}
            maxLength={300}
            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-8">
        <button
          id="generate-link-btn"
          type="button"
          disabled={!selectedFile || isUploading}
          onClick={startUpload}
          className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 group"
        >
          {isUploading ? (
            <span>Uploading file...</span>
          ) : (
            <>
              <span>Generate Share Link</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
