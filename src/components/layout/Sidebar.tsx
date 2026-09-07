import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
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
  Building2,
  UserCheck,
  Send,
  Users,
  History,
  ShieldAlert,
  Shield,
  User,
} from 'lucide-react';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { useAdmin } from '../../context/AdminContext';
import { Logo } from '../common/Logo';
import { useBackButton } from '../../hooks/useBackButton';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  useBackButton(isOpen, onClose, 30);

  const { stats, openCreateModal } = useTask();
  const { userEmail, displayName, signOut } = useAuth();
  const { effectiveTheme, toggleTheme } = useTheme();
  const {
    isEnterpriseMode,
    setEnterpriseMode,
    currentOrg,
    isMember,
    isAdmin,
    hasApprovedOrg,
  } = useEnterprise();
  const { isPlatformAdmin } = useAdmin();
  const navigate = useNavigate();

  // Personal space navigation items
  const personalNavItems = [
    {
      to: '/',
      label: 'My Tasks',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: stats.totalActive > 0 ? String(stats.totalActive) : undefined,
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
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
  ];

  // Organization workplace navigation items
  const orgNavItems = [
    {
      to: '/org/tasks',
      label: 'Organization Tasks',
      icon: <Building2 className="w-4 h-4 text-indigo-500" />,
    },
    {
      to: '/org/assigned-to-me',
      label: 'My Assigned Tasks',
      icon: <UserCheck className="w-4 h-4 text-blue-500" />,
    },
    {
      to: '/org/created-by-me',
      label: 'Tasks Created by Me',
      icon: <Send className="w-4 h-4 text-emerald-500" />,
    },
    {
      to: '/org/employees',
      label: 'Employee Directory',
      icon: <Users className="w-4 h-4 text-purple-500" />,
    },
    {
      to: '/org/history',
      label: 'Assignment History',
      icon: <History className="w-4 h-4 text-amber-500" />,
    },
    {
      to: '/org/notifications',
      label: 'Notifications',
      icon: <Bell className="w-4 h-4 text-rose-500" />,
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors pt-safe pb-safe">
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Header with Logo */}
        <div className="flex items-center justify-between">
          <Logo size="sm" variant="full" showTagline={true} />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Space Switcher (Personal Space vs Organization Space) */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setEnterpriseMode(false);
              navigate('/');
              onClose();
            }}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              !isEnterpriseMode
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Personal</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEnterpriseMode(true);
              navigate('/org/tasks');
              onClose();
            }}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              isEnterpriseMode
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Workplace</span>
          </button>
        </div>

        {/* Active Space Indicator Banner */}
        {isEnterpriseMode ? (
          hasApprovedOrg || isMember ? (
            <div className="p-3 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                Active Organization
              </span>
              <p className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">
                {currentOrg?.legal_name || 'SAMAJ RACHANA CONSTRUCTION LIMITED'}
              </p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300">
                {isAdmin ? 'Admin / Owner' : 'Team Member'}
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/40 text-center space-y-1.5">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                No Organization Access
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                You are not a member of any organization yet.
              </p>
            </div>
          )
        ) : (
          <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Private Space
            </span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
              Personal Task Manager
            </p>
          </div>
        )}

        {/* Action Button: Create Task */}
        <button
          onClick={() => {
            openCreateModal({
              scope: isEnterpriseMode ? 'workplace' : 'personal',
              org_id: isEnterpriseMode ? currentOrg?.id : undefined,
            });
            onClose();
          }}
          className="w-full py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{isEnterpriseMode ? 'New Workplace Task' : 'New Personal Task'}</span>
        </button>

        {/* Navigation list */}
        {isEnterpriseMode ? (
          <div className="space-y-0.5">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              Workplace Collaboration
            </p>
            {orgNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              </NavLink>
            ))}

            {/* Admin-only Organization Management */}
            {isAdmin && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-2">
                <NavLink
                  to="/org/manage"
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Organization Admin</span>
                  </div>
                </NavLink>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              Personal Tasks & Reminders
            </p>
            {personalNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
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
        )}

        {/* Settings */}
        <div className="space-y-0.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
              }`
            }
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </div>
          </NavLink>
        </div>
      </div>

      {/* Footer with Theme toggle & user card */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

        {/* Platform Admin Button (Visible only to verified Platform Admins) */}
        {isPlatformAdmin && (
          <Link
            to="/admin"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/70 hover:bg-purple-100 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold transition-all shadow-xs"
          >
            <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Platform Admin Panel</span>
          </Link>
        )}

        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
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

        <div className="pt-1.5 flex flex-col items-center gap-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
              TASKER v1.0.12
            </span>
          </div>
          <p className="text-[9.5px] font-medium text-slate-400 dark:text-slate-500 tracking-tight leading-tight">
            Developed by Suraj Khandagale | One Click Solution
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 z-20">
        {sidebarContent}
      </aside>

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
