import React, { useEffect, useState, useRef } from 'react';
import { Menu, Search, Plus, AlertCircle, Sparkles, LogOut, Radio, ChevronDown } from 'lucide-react';
import { Button } from '../common/Button';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_USER_NAME } from '../../constants';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const {
    openCreateModal,
    openUniversalSearch,
    openAIDrawer,
    isConfigured,
    isRealtimeConnected,
  } = useTask();

  const { user, userEmail, displayName, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Ctrl+K or / to open Universal Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openUniversalSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openUniversalSearch]);

  // Click outside to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-2xs">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Mobile menu trigger button */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-base text-slate-800 tracking-tight">TASKER</span>
        </div>

        {/* Global Universal Search Bar Trigger (Command Palette style) */}
        <div className="hidden sm:flex flex-1 max-w-md mx-4">
          <button
            type="button"
            onClick={() => openUniversalSearch()}
            className="w-full flex items-center justify-between px-3.5 py-2 text-sm text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600 border border-slate-200 rounded-xl transition-all shadow-2xs group"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <span className="text-xs font-medium">Search tasks, notes, history, attachments...</span>
            </div>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Realtime Live Sync Indicator */}
          {isRealtimeConnected && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium"
              title="Supabase Realtime is active. Changes sync instantly."
            >
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              <span>Live Sync</span>
            </span>
          )}

          {/* Supabase status warning */}
          {!isConfigured && (
            <span
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
              title="Supabase credentials need to be configured in .env"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Setup Supabase</span>
            </span>
          )}

          {/* Task-Aware AI Assistant Button */}
          <button
            type="button"
            onClick={openAIDrawer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            title="Open Task-Aware AI Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden xs:inline">Ask AI</span>
          </button>

          {/* Quick + Add Task Button */}
          <Button
            size="sm"
            onClick={() => openCreateModal()}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + Add Task
          </Button>

          {/* User Profile & Account Dropdown */}
          <div className="relative pl-2 border-l border-slate-200" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 focus:outline-none"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                {(displayName || userEmail || DEFAULT_USER_NAME).charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-800 hidden sm:inline-block max-w-[120px] truncate">
                {displayName || userEmail || DEFAULT_USER_NAME}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline-block" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {displayName || 'TASKER User'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {userEmail || user?.id || 'Connected'}
                  </p>
                </div>

                <div className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search bar trigger when screen is small */}
      <div className="sm:hidden px-4 pb-3">
        <button
          type="button"
          onClick={() => openUniversalSearch()}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-lg text-left"
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span className="text-xs">Search tasks, notes, history...</span>
        </button>
      </div>
    </header>
  );
};