import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare2,
  Clock,
  CheckCircle2,
  Bell,
  Trash2,
  Settings,
  X,
  Plus,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { stats, openCreateModal } = useTask();
  const { userEmail, displayName, signOut } = useAuth();
  const { effectiveTheme, toggleTheme } = useTheme();

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: stats.overdue > 0 ? `${stats.overdue} overdue` : undefined,
      badgeColor: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold',
    },
    {
      to: '/pending',
      label: 'Pending Work',
      icon: <Clock className="w-4 h-4" />,
      badge:
        stats.pending + stats.inProgress + stats.partial > 0
          ? String(stats.pending + stats.inProgress + stats.partial)
          : undefined,
      badgeColor: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold',
    },
    {
      to: '/tasks',
      label: 'All Tasks',
      icon: <CheckSquare2 className="w-4 h-4" />,
      badge: stats.totalActive > 0 ? String(stats.totalActive) : undefined,
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    },
    {
      to: '/completed',
      label: 'Completed',
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: stats.completed > 0 ? String(stats.completed) : undefined,
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400',
    },
    {
      to: '/reminders',
      label: 'Reminders',
      icon: <Bell className="w-4 h-4" />,
    },
    {
      to: '/bin',
      label: 'Bin',
      icon: <Trash2 className="w-4 h-4" />,
      badge: stats.binCount > 0 ? String(stats.binCount) : undefined,
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors">
      <div className="p-5 flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md">
              <CheckSquare2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                TASKER
              </h1>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Work & Productivity
              </p>
            </div>
          </div>

          {/* Close button on mobile drawer */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Action Button: + Add Task */}
        <button
          onClick={() => {
            openCreateModal();
            onClose();
          }}
          className="w-full mb-6 py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Task</span>
        </button>

        {/* Navigation Items */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Main Navigation
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }`
              }
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Footer Area with Theme Toggle and User Summary */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
        {/* Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            {effectiveTheme === 'dark' ? (
              <Moon className="w-4 h-4 text-blue-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span>{effectiveTheme === 'dark' ? 'Dark Theme' : 'Light Theme'}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {effectiveTheme}
          </span>
        </button>

        {/* User Card */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {(displayName || userEmail || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {displayName || 'User'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                {userEmail}
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Slide out overlay) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
