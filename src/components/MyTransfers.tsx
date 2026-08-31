import React, { useState, useEffect } from 'react';
import {
  History,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Clock,
  DownloadCloud,
  FileIcon,
  PlusCircle
} from 'lucide-react';
import { MyTransferItem } from '../types';
import { formatBytes, formatTimeRemaining } from '../utils/formatters';

interface MyTransfersProps {
  onOpenRecipient: (shareUrl: string) => void;
  onNewTransfer: () => void;
}

export const MyTransfers: React.FC<MyTransfersProps> = ({ onOpenRecipient, onNewTransfer }) => {
  const [transfers, setTransfers] = useState<MyTransferItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load from local storage
  const loadTransfers = () => {
    try {
      const stored = localStorage.getItem('yun_transfers');
      if (stored) {
        const parsed: MyTransferItem[] = JSON.parse(stored);
        setTransfers(parsed);
      }
    } catch (e) {
      console.error('Failed to load transfers from localStorage:', e);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, []);

  const copyLink = async (shareUrl: string, id: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const deleteTransfer = async (item: MyTransferItem) => {
    if (!window.confirm(`Permanently delete "${item.originalName}" from the server?`)) {
      return;
    }

    try {
      setDeletingId(item.id);
      await fetch(`/api/files/${item.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteToken: item.deleteToken }),
      });

      // Remove from local list
      const updated = transfers.filter((t) => t.id !== item.id);
      setTransfers(updated);
      localStorage.setItem('yun_transfers', JSON.stringify(updated));
    } catch (err) {
      alert('Error communicating with server.');
    } finally {
      setDeletingId(null);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Clear your local transfer history?')) {
      setTransfers([]);
      localStorage.removeItem('yun_transfers');
    }
  };

  return (
    <div id="my-transfers-container" className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <span>My Shared Transfers</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage links created from this browser and delete active files anytime.
          </p>
        </div>

        {transfers.length > 0 && (
          <button
            type="button"
            id="clear-transfers-history-btn"
            onClick={clearHistory}
            className="text-xs text-stone-500 hover:text-rose-600 transition-colors font-medium"
          >
            Clear History
          </button>
        )}
      </div>

      {/* Empty State */}
      {transfers.length === 0 ? (
        <div id="transfers-empty-state" className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <FileIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-stone-900">No transfers yet</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Files you upload will appear here so you can re-copy links or delete files immediately.
            </p>
          </div>
          <button
            type="button"
            id="start-first-transfer-btn"
            onClick={onNewTransfer}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Share a File Now</span>
          </button>
        </div>
      ) : (
        /* Transfer List */
        <div className="space-y-3">
          {transfers.map((item) => (
            <div
              key={item.id}
              id={`transfer-item-${item.id}`}
              className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-stone-300"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <h4 className="text-sm sm:text-base font-bold text-stone-900 truncate" title={item.originalName}>
                  {item.originalName}
                </h4>

                <div className="flex flex-wrap items-center gap-2.5 text-xs text-stone-500">
                  <span className="font-semibold text-stone-700">{formatBytes(item.size)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-stone-600">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span>{formatTimeRemaining(item.expiresAt)}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-stone-600">
                    <DownloadCloud className="w-3.5 h-3.5 text-stone-400" />
                    <span>
                      {item.downloadLimit === 0
                        ? 'Unlimited'
                        : `${item.downloadLimit} limit`}
                    </span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                <button
                  type="button"
                  id={`copy-link-btn-${item.id}`}
                  onClick={() => copyLink(item.shareUrl, item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    copiedId === item.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                  }`}
                >
                  {copiedId === item.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  id={`open-recipient-btn-${item.id}`}
                  onClick={() => onOpenRecipient(item.shareUrl)}
                  className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                  title="Open download page"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  id={`delete-transfer-btn-${item.id}`}
                  disabled={deletingId === item.id}
                  onClick={() => deleteTransfer(item)}
                  className="p-2 rounded-lg bg-stone-100 hover:bg-rose-50 text-stone-500 hover:text-rose-600 transition-colors"
                  title="Delete File Permanently"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
