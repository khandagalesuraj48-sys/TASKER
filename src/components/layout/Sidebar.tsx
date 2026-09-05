import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare2,
  Clock,
  CheckCircle2,
  Trash2,
  Settings,
  X,
  PlusCircle,
} from 'lucide-react';
import { APP_NAME } from '../../constants';
import { useTask } from '../../context/TaskContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { stats, openCreateModal } = useTask();

  const navItems = [
    {
      to: '/',
      label: 'Home',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: stats.overdue > 0 ? `${stats.overdue} overdue` : undefined,
      badgeColor: 'bg-rose-100 text-rose-700',
    },
    {
      to: '/pending',
      label: 'Pending',
      icon: <Clock className="w-4 h-4" />,
      badge: stats.pending + stats.inProgress + stats.partial > 0 ? String(stats.pending + stats.inProgress + stats.partial) : undefined,
      badgeColor: 'bg-amber-100 text-amber-700 font-semibold',
    },
    {
      to: '/tasks',
      label: 'All Tasks',
      icon: <CheckSquare2 className="w-4 h-4" />,
      badge: stats.totalActive > 0 ? String(stats.totalActive) : undefined,
      badgeColor: 'bg-slate-100 text-slate-600',
    },
    {
      to: '/completed',
      label: 'Completed',
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: stats.completed > 0 ? String(stats.completed) : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-700',
    },
    {
      to: '/bin',
      label: 'Bin',
      icon: <Trash2 className="w-4 h-4" />,
      badge: stats.binCount > 0 ? String(stats.binCount) : undefined,
      badgeColor: 'bg-slate-100 text-slate-500',
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200">
      <div className="p-5">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              <CheckSquare2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">{APP_NAME}</h1>
              <p className="text-[11px] text-slate-500 mt-1">Single-User Personal Tracker</p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Add Button in Sidebar */}
        <div className="mt-5">
          <button
            onClick={() => {
              openCreateModal();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Task</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="mt-6 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Active Tasks: <strong>{stats.totalActive}</strong></span>
          <span>Pending: <strong>{stats.pending + stats.inProgress + stats.partial}</strong></span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Responsive Overlay) */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-full shadow-2xl z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

