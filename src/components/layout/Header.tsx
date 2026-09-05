import React, { useEffect } from 'react';
import { Menu, Search, Plus, UserCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../common/Button';
import { useTask } from '../../context/TaskContext';
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
  } = useTask();

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

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-2xs">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-slate-800 text-base">My Work Tracker</span>
        </div>

        {/* Global Universal Search Trigger Button */}
        <div className="hidden sm:flex flex-1 max-w-md items-center">
          <button
            type="button"
            onClick={() => openUniversalSearch()}
            className="w-full flex items-center justify-between px-3.5 py-2 text-sm text-slate-400 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 text-left cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              <span className="truncate">Universal Search (tasks, notes, files...)</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-3xs">
                Ctrl K
              </kbd>
            </div>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3">
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

          {/* Single-User Profile Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-slate-700">
            <UserCircle className="w-6 h-6 text-slate-400" />
            <span className="text-xs font-semibold text-slate-800 hidden sm:inline-block">
              {DEFAULT_USER_NAME}
            </span>
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
          <span>Search tasks, notes, files...</span>
        </button>
      </div>
    </header>
  );
};