import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  Bell,
  MoreHorizontal,
  Trash2,
  Settings,
  X,
  Building2,
  UserCheck,
  Send,
  Users,
  History,
  ShieldAlert,
} from 'lucide-react';
import { useTask } from '../../context/TaskContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { useAdmin } from '../../context/AdminContext';
import { useBackButton } from '../../hooks/useBackButton';
import { Shield } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { stats } = useTask();
  const { isEnterpriseMode, setEnterpriseMode, isAdmin, hasApprovedOrg } = useEnterprise();
  const { isPlatformAdmin } = useAdmin();
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);

  useBackButton(moreMenuOpen, () => setMoreMenuOpen(false), 30);

  const mainItems = [
    { to: '/', label: 'My Tasks', icon: <LayoutDashboard className="w-5 h-5" /> },
    {
      to: '/pending',
      label: 'Pending',
      icon: <Clock className="w-5 h-5" />,
      badge: stats.pending + stats.inProgress + stats.partial > 0 ? stats.pending + stats.inProgress + stats.partial : null,
    },
    { to: '/org/tasks', label: 'Workplace', icon: <Building2 className="w-5 h-5 text-indigo-500" /> },
    { to: '/reminders', label: 'Remind', icon: <Bell className="w-5 h-5" /> },
  ];

  return (
    <>
      {moreMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex flex-col justify-end lg:hidden animate-in fade-in duration-150"
          onClick={() => setMoreMenuOpen(false)}
        >
          <div
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-5 pb-8 pb-safe shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">TASKER Spaces & Navigation</h3>
              <button
                onClick={() => setMoreMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Space Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setEnterpriseMode(false)}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  !isEnterpriseMode
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <span>👤</span>
                <span>Personal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (hasApprovedOrg) {
                    setEnterpriseMode(true);
                  } else {
                    alert('You are not an approved member of any organization yet.');
                  }
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  isEnterpriseMode
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <span>🏢</span>
                <span>Workplace</span>
              </button>
            </div>

            {/* Navigation Section */}
            <div className="space-y-1">
              {isEnterpriseMode ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-2">
                    Workplace Collaboration
                  </p>
                  <NavLink
                    to="/org/tasks"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span>Organization Tasks</span>
                  </NavLink>
                  <NavLink
                    to="/org/assigned-to-me"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    <span>My Assigned Tasks</span>
                  </NavLink>
                  <NavLink
                    to="/org/created-by-me"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <Send className="w-4 h-4 text-emerald-500" />
                    <span>Tasks Created by Me</span>
                  </NavLink>
                  <NavLink
                    to="/org/employees"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <Users className="w-4 h-4 text-purple-500" />
                    <span>Employee Directory</span>
                  </NavLink>
                  <NavLink
                    to="/org/history"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <History className="w-4 h-4 text-amber-500" />
                    <span>Assignment History</span>
                  </NavLink>
                  <NavLink
                    to="/org/notifications"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <Bell className="w-4 h-4 text-rose-500" />
                    <span>Notifications</span>
                  </NavLink>

                  {isAdmin && (
                    <NavLink
                      to="/org/manage"
                      onClick={() => setMoreMenuOpen(false)}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-xs font-bold text-amber-600 dark:text-amber-400"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Organization Management (Admin)</span>
                    </NavLink>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Personal Space
                  </p>
                  <NavLink
                    to="/"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <LayoutDashboard className="w-4 h-4 text-blue-500" />
                    <span>My Tasks</span>
                  </NavLink>
                  <NavLink
                    to="/completed"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Completed Tasks</span>
                  </NavLink>
                  <NavLink
                    to="/bin"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Bin</span>
                  </NavLink>
                </>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                {isPlatformAdmin && (
                  <NavLink
                    to="/admin"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-xs font-bold"
                  >
                    <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Platform Admin Panel</span>
                  </NavLink>
                )}

                <NavLink
                  to="/settings"
                  onClick={() => setMoreMenuOpen(false)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Settings</span>
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe">
        <div className="flex items-center justify-around h-14 px-2">
          {mainItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center w-14 h-full text-[10px] font-semibold transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`
              }
            >
              <div className="relative">
                {item.icon}
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMoreMenuOpen(true)}
            className="flex flex-col items-center justify-center w-14 h-full text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="mt-0.5">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};
