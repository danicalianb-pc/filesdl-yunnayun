import React from 'react';
import { Share2, History, PlusCircle, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: 'upload' | 'transfers';
  setActiveTab: (tab: 'upload' | 'transfers') => void;
  activeCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, activeCount = 0 }) => {
  return (
    <header className="w-full border-b border-stone-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div
          id="brand-header-link"
          onClick={() => setActiveTab('upload')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-stone-900">
                &#39;Yun na &#39;yun?
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                File Sharing
              </span>
            </div>
            <p className="text-[11px] text-stone-500 hidden sm:block">
              Fast, direct file transfers with real-time tracking & expiration
            </p>
          </div>
        </div>

        {/* Navigation Actions */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <button
            id="nav-tab-upload"
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Send File</span>
          </button>

          <button
            id="nav-tab-transfers"
            type="button"
            onClick={() => setActiveTab('transfers')}
            className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'transfers'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>My Transfers</span>
            {activeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                {activeCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
