import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  Bell,
  Trash2,
  Settings,
  X,
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { useAdmin } from '../../context/AdminContext';
import { Logo } from '../common/Logo';
import { useBackButton } from '../../hooks/useBackButton';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { APP_VERSION } from '../../constants';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  useBackButton(isOpen, onClose, 30);

  const { stats } = useTask();
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

  // Desktop collapsible state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tasker_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tasker_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };


  // Personal space navigation items
  const personalNavItems = [
    {
      to: '/',
      label: 'My Tasks',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
      badge: stats.totalActive > 0 ? String(stats.totalActive) : undefined,
      badgeColor: 'bg-muted text-muted-foreground',
    },
    {
      to: '/pending',
      label: 'Pending Work',
      icon: <Clock className="w-4 h-4 shrink-0 text-amber-500" />,
      badge:
        stats.pending + stats.inProgress + stats.partial > 0
          ? String(stats.pending + stats.inProgress + stats.partial)
          : undefined,
      badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold',
    },
    {
      to: '/completed',
      label: 'Completed Archive',
      icon: <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />,
      badge: stats.completed > 0 ? String(stats.completed) : undefined,
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    },
    {
      to: '/reminders',
      label: 'Reminders & Schedules',
      icon: <Bell className="w-4 h-4 shrink-0 text-sky-500" />,
    },
    {
      to: '/bin',
      label: 'Recycle Bin',
      icon: <Trash2 className="w-4 h-4 shrink-0 text-muted-foreground" />,
      badge: stats.binCount > 0 ? String(stats.binCount) : undefined,
      badgeColor: 'bg-muted text-muted-foreground',
    },
  ];

  // Organization workplace navigation items
  const orgNavItems = [
    {
      to: '/org/tasks',
      label: 'Operations Board',
      icon: <Building2 className="w-4 h-4 shrink-0 text-indigo-500" />,
    },
    {
      to: '/org/pending',
      label: 'Pending by Site',
      icon: <Clock className="w-4 h-4 shrink-0 text-amber-500" />,
      badge:
        stats.pending + stats.inProgress + stats.partial > 0
          ? String(stats.pending + stats.inProgress + stats.partial)
          : undefined,
      badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold',
    },
    {
      to: '/org/assigned-to-me',
      label: 'My Delegated In',
      icon: <UserCheck className="w-4 h-4 shrink-0 text-blue-500" />,
    },
    {
      to: '/org/created-by-me',
      label: 'Delegated Out',
      icon: <Send className="w-4 h-4 shrink-0 text-emerald-500" />,
    },
    {
      to: '/org/employees',
      label: 'Employee Directory',
      icon: <Users className="w-4 h-4 shrink-0 text-purple-500" />,
    },
    {
      to: '/org/history',
      label: 'Assignment History',
      icon: <History className="w-4 h-4 shrink-0 text-slate-400" />,
    },
    {
      to: '/org/notifications',
      label: 'Audit & Alerts',
      icon: <Bell className="w-4 h-4 shrink-0 text-rose-500" />,
    },
  ];


  const sidebarContent = (
    <div
      className={cn(
        'flex h-full flex-col justify-between bg-card text-card-foreground border-r border-border transition-all duration-200 select-none pt-safe pb-safe',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Top Header & Navigation Section */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1 py-1">
          {!isCollapsed ? (
            <div className="flex items-center justify-between w-full">
              <Logo size="sm" variant="full" showTagline={false} />
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <Logo size="xs" variant="icon" />
            </div>
          )}
        </div>

        {/* Space Switcher (Personal Space vs Organization Space) */}
        {!isCollapsed ? (
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => {
                setEnterpriseMode(false);
                navigate('/');
                onClose();
              }}
              className={cn(
                'py-1.5 px-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95',
                !isEnterpriseMode
                  ? 'bg-background text-primary shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
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
              className={cn(
                'py-1.5 px-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95',
                isEnterpriseMode
                  ? 'bg-background text-workplace shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Building2 className="w-3.5 h-3.5 text-workplace" />
              <span>Workplace</span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setEnterpriseMode(!isEnterpriseMode);
                navigate(isEnterpriseMode ? '/' : '/org/tasks');
              }}
              className="p-2 rounded-lg hover:bg-muted text-foreground active:scale-95"
              title="Toggle Workplace / Personal"
            >
              {isEnterpriseMode ? (
                <Building2 className="w-4 h-4 text-workplace" />
              ) : (
                <User className="w-4 h-4 text-primary" />
              )}
            </button>
          </div>
        )}

        {/* Active Organization Context Banner */}
        {!isCollapsed && isEnterpriseMode && (
          hasApprovedOrg || isMember ? (
            <div className="px-3 py-2.5 rounded-xl border border-workplace/30 bg-workplace/5 shadow-2xs">
              <span className="text-[9px] font-bold text-workplace uppercase tracking-wider block">
                Enterprise Workspace
              </span>
              <p className="text-xs font-bold text-foreground truncate mt-0.5">
                {currentOrg?.legal_name || 'SAMAJ RACHANA CONSTRUCTION'}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant="workplace" size="xs">
                  {isAdmin ? 'Admin' : 'Member'}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">
                No Org Assigned
              </span>
            </div>
          )
        )}

        {/* Navigation list */}
        <div className="space-y-1 pt-1">
          {!isCollapsed && (
            <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
              {isEnterpriseMode ? 'Operations' : 'Task Manager'}
            </p>
          )}

          {(isEnterpriseMode ? orgNavItems : personalNavItems).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/org/tasks'}
              onClick={onClose}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-accent/80 text-foreground font-semibold border-l-[3px] border-primary'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                )
              }
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.icon}
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!isCollapsed && item.badge && (
                <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-mono', item.badgeColor)}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}

          {/* Admin-only Organization Management */}
          {isEnterpriseMode && isAdmin && (
            <div className="pt-2 border-t border-border/80 mt-2 space-y-1">
              {!isCollapsed && (
                <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Organization Control
                </p>
              )}
              <NavLink
                to="/org/manage"
                onClick={onClose}
                title={isCollapsed ? 'Org Admin' : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )
                }
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                  {!isCollapsed && <span>Organization Admin</span>}
                </div>
              </NavLink>
            </div>
          )}


          {/* Platform Superadmin Navigation Item (if verified platform admin) */}
          {isPlatformAdmin && (
            <div className="pt-2 border-t border-border/80 mt-2">
              <NavLink
                to="/admin"
                onClick={onClose}
                title={isCollapsed ? 'Platform Admin' : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold'
                      : 'text-purple-600 dark:text-purple-400 hover:bg-muted/70'
                  )
                }
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Platform Admin</span>}
                </div>
              </NavLink>
            </div>
          )}

          {/* Settings Navigation */}
          <div className="pt-2 border-t border-border/80 mt-2">
            <NavLink
              to="/settings"
              onClick={onClose}
              title={isCollapsed ? 'Settings' : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-accent/80 text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                )
              }
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Settings & Updates</span>}
              </div>
            </NavLink>
          </div>
        </div>
      </div>

      {/* Footer Section: Theme Switcher & Collapse Toggle */}
      <div className="p-2.5 border-t border-border/80 bg-card/80 space-y-1.5">
        {/* Desktop Collapse / Expand Toggle */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden lg:flex w-full items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground text-xs font-medium transition-colors active:scale-95"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2 w-full px-1">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            'w-full flex items-center p-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors active:scale-95',
            isCollapsed ? 'justify-center' : 'justify-between px-2'
          )}
          title="Toggle Theme"
        >
          <div className="flex items-center gap-2">
            {effectiveTheme === 'dark' ? (
              <Moon className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            {!isCollapsed && (
              <span>{effectiveTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            )}
          </div>
        </button>

        {/* User Card */}
        <div
          className={cn(
            'flex items-center p-2 rounded-xl bg-muted/40 border border-border/70 text-xs shadow-2xs',
            isCollapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
              {(displayName || userEmail || 'U').charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 truncate">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-foreground truncate leading-tight text-[11px]">
                    {displayName || 'Operative'}
                  </p>
                  <span className="text-[9px] font-mono text-muted-foreground px-1 py-0.2 rounded-md bg-muted border border-border/70">
                    v{APP_VERSION}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                  {userEmail}
                </p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => signOut()}
              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block h-full shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden animate-in fade-in duration-150"
          onClick={onClose}
        >
          <div
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
