import React from 'react';
import { Menu, Search, Plus, UserCircle, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { useTask } from '../../context/TaskContext';
import { DEFAULT_USER_NAME } from '../../constants';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { openCreateModal, globalSearch, setGlobalSearch, isConfigured } = useTask();

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

        {/* Global Search Bar */}
        <div className="hidden sm:flex flex-1 max-w-md items-center relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search tasks by title, person, notes..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-1.5 text-sm placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {!isConfigured && (
            <span
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
              title="Supabase credentials need to be configured in .env"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Setup Supabase in .env</span>
            </span>
          )}

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

      {/* Mobile search bar when screen is small */}
      <div className="sm:hidden px-4 pb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
          />
        </div>
      </div>
    </header>
  );
};

