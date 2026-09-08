import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  Shield,
  Plus,
  User,
} from 'lucide-react';
import { useTask } from '../../context/TaskContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { useAdmin } from '../../context/AdminContext';
import { useBackButton } from '../../hooks/useBackButton';
import { cn } from '@/lib/utils';

export const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const { stats, openCreateModal } = useTask();
  const { isEnterpriseMode, setEnterpriseMode, isAdmin } = useEnterprise();
  const { isPlatformAdmin } = useAdmin();
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);

  useBackButton(moreMenuOpen, () => setMoreMenuOpen(false), 30);

  const pendingCount = stats.pending + stats.inProgress + stats.partial;

  return (
    <>
      {/* Mobile Drawer Bottom Sheet for "More" */}
      {moreMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex flex-col justify-end lg:hidden animate-in fade-in duration-150"
          onClick={() => setMoreMenuOpen(false)}
        >
          <div
            className="w-full bg-card text-card-foreground rounded-t-2xl border-t border-border p-4 pb-8 pb-safe shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-foreground">TASKER Operations</h3>
                <p className="text-[11px] text-muted-foreground">Workspace modules & management</p>
              </div>
              <button
                type="button"
                onClick={() => setMoreMenuOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Space Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-md border border-border/60">
              <button
                type="button"
                onClick={() => {
                  setEnterpriseMode(false);
                  navigate('/');
                  setMoreMenuOpen(false);
                }}
                className={cn(
                  'py-2 text-xs font-bold rounded-sm transition-all flex items-center justify-center gap-1.5',
                  !isEnterpriseMode
                    ? 'bg-background text-primary shadow-2xs'
                    : 'text-muted-foreground'
                )}
              >
                <User className="w-3.5 h-3.5" />
                <span>Personal Space</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEnterpriseMode(true);
                  navigate('/org/tasks');
                  setMoreMenuOpen(false);
                }}
                className={cn(
                  'py-2 text-xs font-bold rounded-sm transition-all flex items-center justify-center gap-1.5',
                  isEnterpriseMode
                    ? 'bg-background text-workplace shadow-2xs'
                    : 'text-muted-foreground'
                )}
              >
                <Building2 className="w-3.5 h-3.5 text-workplace" />
                <span>Workplace Space</span>
              </button>
            </div>

            {/* Navigation options depending on Space */}
            <div className="space-y-1">
              {isEnterpriseMode ? (
                <>
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Workplace Modules
                  </p>
                  <NavLink
                    to="/org/created-by-me"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Send className="w-4 h-4 text-emerald-500" />
                    <span>Tasks Delegated Out by Me</span>
                  </NavLink>
                  <NavLink
                    to="/org/employees"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Users className="w-4 h-4 text-purple-500" />
                    <span>Employee Directory</span>
                  </NavLink>
                  <NavLink
                    to="/org/history"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <History className="w-4 h-4 text-amber-500" />
                    <span>Assignment History Audit</span>
                  </NavLink>
                  <NavLink
                    to="/org/notifications"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Bell className="w-4 h-4 text-rose-500" />
                    <span>Notifications & Alerts</span>
                  </NavLink>

                  {isAdmin && (
                    <div className="pt-2 border-t border-border">
                      <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                        Administration
                      </p>
                      <NavLink
                        to="/org/manage"
                        onClick={() => setMoreMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>Organization Management</span>
                      </NavLink>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Personal Space
                  </p>
                  <NavLink
                    to="/completed"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Completed Archive</span>
                  </NavLink>
                  <NavLink
                    to="/reminders"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Bell className="w-4 h-4 text-sky-500" />
                    <span>Reminders & Schedules</span>
                  </NavLink>
                  <NavLink
                    to="/bin"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                    <span>Recycle Bin</span>
                  </NavLink>
                </>
              )}

              {/* Platform Admin Link */}
              {isPlatformAdmin && (
                <div className="pt-2 border-t border-border">
                  <NavLink
                    to="/admin"
                    onClick={() => setMoreMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Platform Admin Control Center</span>
                  </NavLink>
                </div>
              )}

              {/* General Settings */}
              <div className="pt-2 border-t border-border">
                <NavLink
                  to="/settings"
                  onClick={() => setMoreMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings & Android Updates</span>
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main 5-Tab Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-md border-t border-border lg:hidden pb-safe">
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {/* Tab 1: Dashboard / Home */}
          <NavLink
            to={isEnterpriseMode ? '/org/tasks' : '/'}
            end
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 h-full transition-colors min-h-[44px]',
                isActive
                  ? isEnterpriseMode ? 'text-workplace font-bold' : 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {isEnterpriseMode ? (
              <Building2 className="w-5 h-5" />
            ) : (
              <LayoutDashboard className="w-5 h-5" />
            )}
            <span className="text-[10px] tracking-tight truncate max-w-[56px]">
              {isEnterpriseMode ? 'Board' : 'Tasks'}
            </span>
          </NavLink>

          {/* Tab 2: Pending Tasks */}
          <NavLink
            to={isEnterpriseMode ? '/org/pending' : '/pending'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 h-full transition-colors relative min-h-[44px]',
                isActive
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <div className="relative">
              <Clock className="w-5 h-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] text-[9px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Pending</span>
          </NavLink>

          {/* Tab 3: Centered Quick Add Action Button */}
          <div className="flex items-center justify-center h-full">
            <button
              type="button"
              onClick={() => openCreateModal({ scope: isEnterpriseMode ? 'workplace' : 'personal' })}
              className={cn(
                'w-11 h-11 rounded-full text-white flex items-center justify-center shadow-md active:scale-95 transition-transform min-h-[44px] min-w-[44px]',
                isEnterpriseMode
                  ? 'bg-workplace hover:bg-workplace/90'
                  : 'bg-primary hover:bg-primary/90'
              )}
              aria-label="Create new task"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Tab 4: Delegations / Assigned Tasks */}
          <NavLink
            to={isEnterpriseMode ? '/org/assigned-to-me' : '/completed'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 h-full transition-colors min-h-[44px]',
                isActive
                  ? isEnterpriseMode ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {isEnterpriseMode ? (
              <UserCheck className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <span className="text-[10px] tracking-tight truncate max-w-[56px]">
              {isEnterpriseMode ? 'Assigned' : 'Done'}
            </span>
          </NavLink>

          {/* Tab 5: More Menu Drawer */}
          <button
            type="button"
            onClick={() => setMoreMenuOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 h-full transition-colors min-h-[44px]',
              moreMenuOpen ? 'text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};
