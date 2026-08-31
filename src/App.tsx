import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { UploadForm } from './components/UploadForm';
import { ShareSuccess } from './components/ShareSuccess';
import { DownloadView } from './components/DownloadView';
import { MyTransfers } from './components/MyTransfers';
import { ShareLinkData, MyTransferItem } from './types';
import { Zap, Clock, ShieldCheck, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'transfers'>('upload');
  const [shareData, setShareData] = useState<ShareLinkData | null>(null);
  const [recipientFileId, setRecipientFileId] = useState<string | null>(null);
  const [activeTransfersCount, setActiveTransfersCount] = useState<number>(0);

  // Check URL parameters or hash for download link
  const parseDownloadIdFromUrl = (): string | null => {
    // 1. Check hash: #download=xyz or #xyz
    if (window.location.hash) {
      const hash = window.location.hash.substring(1);
      if (hash.startsWith('download=')) {
        return hash.replace('download=', '');
      }
      if (hash.length > 0 && !hash.includes('&') && !hash.includes('=')) {
        return hash;
      }
    }
    // 2. Check query params: ?download=xyz or ?share=xyz
    const params = new URLSearchParams(window.location.search);
    return params.get('download') || params.get('share') || null;
  };

  const syncStateFromUrl = () => {
    const fileId = parseDownloadIdFromUrl();
    setRecipientFileId(fileId);
  };

  const updateTransfersCount = () => {
    try {
      const stored = localStorage.getItem('yun_transfers');
      if (stored) {
        const parsed: MyTransferItem[] = JSON.parse(stored);
        setActiveTransfersCount(parsed.length);
      } else {
        setActiveTransfersCount(0);
      }
    } catch {
      setActiveTransfersCount(0);
    }
  };

  useEffect(() => {
    syncStateFromUrl();
    updateTransfersCount();

    const handleLocationChange = () => {
      syncStateFromUrl();
      updateTransfersCount();
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleUploadSuccess = (data: ShareLinkData) => {
    setShareData(data);
    updateTransfersCount();
  };

  const handleResetUpload = () => {
    setShareData(null);
    setActiveTab('upload');
  };

  const handleOpenRecipientView = (shareUrl: string) => {
    try {
      const url = new URL(shareUrl);
      window.location.hash = url.hash;
      const fileId = parseDownloadIdFromUrl();
      if (fileId) {
        setRecipientFileId(fileId);
      }
    } catch {
      // fallback
      window.location.href = shareUrl;
    }
  };

  const handleGoHome = () => {
    window.history.pushState(null, '', window.location.pathname);
    setRecipientFileId(null);
    setShareData(null);
    setActiveTab('upload');
    updateTransfersCount();
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-['Plus_Jakarta_Sans'] antialiased">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (recipientFileId) {
            handleGoHome();
          }
          setActiveTab(tab);
        }}
        activeCount={activeTransfersCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        {/* Recipient Download View */}
        {recipientFileId ? (
          <DownloadView fileId={recipientFileId} onBackToHome={handleGoHome} />
        ) : activeTab === 'transfers' ? (
          /* Transfers History View */
          <MyTransfers
            onOpenRecipient={handleOpenRecipientView}
            onNewTransfer={() => {
              setActiveTab('upload');
              setShareData(null);
            }}
          />
        ) : shareData ? (
          /* Share Generated Link View */
          <ShareSuccess
            shareData={shareData}
            onUploadAnother={handleResetUpload}
          />
        ) : (
          /* Upload View with Header Intro */
          <div className="space-y-6">
            <div className="text-center max-w-lg mx-auto space-y-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
                Transfer files without the hassle
              </h1>
              <p className="text-sm text-stone-600">
                Direct, rapid file sharing with custom expiration and instant 1-click downloads.
              </p>
            </div>

            <UploadForm onUploadSuccess={handleUploadSuccess} />

            {/* Feature Highlights Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
              <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-xs flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-900">Direct Download</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-normal">
                    Recipients download original files straight from the browser with no confusing steps.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-xs flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-900">Expiration Links</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-normal">
                    Set links to expire in 5 minutes, days, or keep them permanent until manually deleted.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-xs flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-900">Auto-Clean Storage</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-normal">
                    Files are automatically purged when their expiration time or download limits are reached.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-stone-200/80 bg-white py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-800">&#39;Yun na &#39;yun? File Sharing</span>
            <span>—</span>
            <span>Mabilis at madali. Walang arte — &#39;yun na &#39;yun!</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Direct Transfers</span>
            <span>•</span>
            <span>Real-time Tracking</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
