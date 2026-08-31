import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  Download,
  Share2,
  Clock,
  Trash2,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { ShareLinkData } from '../types';
import { formatBytes, formatTimeRemaining } from '../utils/formatters';
import { generateQrSvg } from '../utils/qr';

interface ShareSuccessProps {
  shareData: ShareLinkData;
  onUploadAnother: () => void;
}

export const ShareSuccess: React.FC<ShareSuccessProps> = ({ shareData, onUploadAnother }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletedMsg, setDeletedMsg] = useState<string | null>(null);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const deleteImmediately = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this file now?')) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/files/${shareData.fileId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteToken: shareData.deleteToken }),
      });

      if (res.ok) {
        setDeletedMsg('File was permanently deleted from the server.');
        // Remove from local storage
        try {
          const stored = localStorage.getItem('yun_transfers');
          if (stored) {
            const list = JSON.parse(stored).filter((item: any) => item.id !== shareData.fileId);
            localStorage.setItem('yun_transfers', JSON.stringify(list));
          }
        } catch (e) {}
      } else {
        alert('Failed to delete file.');
      }
    } catch (e) {
      alert('Error deleting file.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (deletedMsg) {
    return (
      <div id="deleted-confirmation-card" className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-8 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-600 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-stone-900 mb-2">File Removed</h3>
        <p className="text-sm text-stone-600 mb-6">{deletedMsg}</p>
        <button
          id="upload-another-deleted-btn"
          type="button"
          onClick={onUploadAnother}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          Share Another File
        </button>
      </div>
    );
  }

  return (
    <div id="share-success-container" className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 sm:p-8">
      {/* Top Banner */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-stone-100">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">Your file is ready to share!</h2>
          <p className="text-xs text-stone-500">
            Anyone with this link can download the file immediately with one click.
          </p>
        </div>
      </div>

      {/* Share Link Copy Box */}
      <div className="mb-6">
        <label htmlFor="share-link-input" className="block text-xs font-semibold text-stone-700 mb-2">
          Direct Download Link
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="share-link-input"
              type="text"
              readOnly
              value={shareData.shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 px-3.5 text-xs sm:text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            id="copy-share-link-btn"
            type="button"
            onClick={copyToClipboard}
            className={`px-4 py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 shrink-0 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* File summary & Expiration details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
          <span className="text-xs text-stone-500 block">File Name & Size</span>
          <span className="text-xs font-semibold text-stone-900 truncate block mt-0.5" title={shareData.originalName}>
            {shareData.originalName} ({formatBytes(shareData.size)})
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 block">Expiration</span>
            <span className="text-xs font-semibold text-stone-900 block mt-0.5">
              {shareData.expiresAt ? formatTimeRemaining(shareData.expiresAt) : 'Permanent'}
            </span>
          </div>
          <Clock className="w-4 h-4 text-stone-400" />
        </div>
      </div>

      {/* Quick Action Tools */}
      <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-stone-100">
        <button
          id="toggle-qr-code-btn"
          type="button"
          onClick={() => setShowQr(!showQr)}
          className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <QrCode className="w-3.5 h-3.5 text-stone-500" />
          <span>{showQr ? 'Hide QR Code' : 'Show QR Code'}</span>
        </button>

        <a
          id="test-download-link-btn"
          href={shareData.shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
          <span>Test Download Page</span>
        </a>

        <div className="flex-1" />

        <button
          id="delete-now-btn"
          type="button"
          disabled={isDeleting}
          onClick={deleteImmediately}
          className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{isDeleting ? 'Deleting...' : 'Delete File Now'}</span>
        </button>
      </div>

      {/* QR Code expansion */}
      {showQr && (
        <div id="qr-code-display-box" className="mt-6 p-6 rounded-xl bg-stone-50 border border-stone-200 flex flex-col items-center justify-center text-center">
          <div
            className="p-3 bg-white rounded-xl shadow-xs border border-stone-200 mb-3"
            dangerouslySetInnerHTML={{
              __html: generateQrSvg(shareData.shareUrl, 160),
            }}
          />
          <p className="text-xs text-stone-500">Scan with a mobile phone camera to download instantly</p>
        </div>
      )}

      {/* Bottom Button */}
      <div className="mt-8 pt-4 border-t border-stone-100">
        <button
          id="upload-another-bottom-btn"
          type="button"
          onClick={onUploadAnother}
          className="w-full py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Upload Another File</span>
        </button>
      </div>
    </div>
  );
};
