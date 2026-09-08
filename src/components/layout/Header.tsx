import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  Search,
  Plus,
  Radio,
  ChevronDown,
  Shield,
  Building2,
  User,
  LogOut,
  ChevronRight,
  Mic,
} from 'lucide-react';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { useAdmin } from '../../context/AdminContext';
import { useBackButton } from '../../hooks/useBackButton';
import { NotificationBell } from '../notifications/NotificationBell';
import { VoiceTaskModal } from '../tasks/VoiceTaskModal';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const {
    openCreateModal,
    openUniversalSearch,
    isRealtimeConnected,
  } = useTask();

  const { userEmail, displayName, signOut } = useAuth();
  const { effectiveTheme, toggleTheme } = useTheme();
  const {
    isEnterpriseMode,
    setEnterpriseMode,
    userApprovedOrgs,
    hasApprovedOrg,
    currentOrg,
    switchOrg,
  } = useEnterprise();
  const { isPlatformAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState<boolean>(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);

  const canAccessWorkplace = hasApprovedOrg || isPlatformAdmin;

  // Register with Android hardware back button handler
  useBackButton(profileOpen, () => setProfileOpen(false), 30);

  // Keyboard shortcut: Ctrl+K or / to open Universal Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openUniversalSearch();
      }
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setOrgDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openUniversalSearch]);

  // Click outside to close profile and org dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
        setOrgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute breadcrumb label from location
  const getPageTitle = () => {
    const p = location.pathname;
    if (p === '/') return 'Personal Tasks';
    if (p === '/pending') return 'Pending Tasks';
    if (p === '/completed') return 'Completed Tasks';
    if (p === '/reminders') return 'Reminders';
    if (p === '/bin') return 'Recycle Bin';
    if (p === '/settings') return 'Settings';
    if (p === '/org/tasks') return 'Operations Board';
    if (p === '/org/pending') return 'Site Pending Work';
    if (p === '/org/assigned-to-me') return 'My Delegated Tasks';
    if (p === '/org/created-by-me') return 'Tasks Delegated Out';
    if (p === '/org/employees') return 'Employee Directory';
    if (p === '/org/history') return 'Assignment History';
    if (p === '/org/manage') return 'Organization Admin';
    if (p === '/org/notifications') return 'Audit & Alerts';
    if (p.startsWith('/tasks/') || p.startsWith('/org/tasks/')) return 'Task Record';
    if (p.startsWith('/admin')) return 'Platform Administration';
    return 'TASKER';
  };

  return (
    <header className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border/80 transition-colors pt-safe shadow-2xs">
      <div className="flex items-center justify-between h-14 px-3 sm:px-6 max-w-7xl mx-auto w-full">
        {/* Left Side: Mobile Menu Button & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 focus:outline-none min-w-[38px] min-h-[38px] flex items-center justify-center transition-colors active:scale-95"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop Breadcrumb */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <span className="font-semibold text-foreground/80 flex items-center gap-1.5">
              {isEnterpriseMode ? (
                <>
                  <Building2 className="w-3.5 h-3.5 text-workplace" />
                  <span className="truncate max-w-[140px]">{currentOrg?.trade_name || 'Enterprise'}</span>
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>Personal</span>
                </>
              )}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <span className="font-medium text-foreground truncate">{getPageTitle()}</span>
          </div>

          {/* Mobile compact title */}
          <div className="sm:hidden font-semibold text-xs text-foreground truncate max-w-[130px]">
            {getPageTitle()}
          </div>
        </div>

        {/* Center: Command Palette Global Search (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-sm mx-4">
          <button
            type="button"
            onClick={() => openUniversalSearch()}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground bg-muted/40 hover:bg-muted/80 border border-border/80 rounded-lg transition-all group shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              <span className="truncate">Search tasks, sites, notes...</span>
            </div>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 bg-background/80 border border-border/80 rounded shadow-2xs shrink-0">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Side: Workspace Switcher, Sync, Notifications & Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Search Button */}
          <button
            type="button"
            onClick={() => openUniversalSearch()}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-lg min-w-[38px] min-h-[38px] flex items-center justify-center transition-colors active:scale-95"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Realtime Live Sync Status */}
          {isRealtimeConnected && (
            <span
              className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold"
              title="Supabase Realtime is active. Data syncs live."
            >
              <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
              <span>Live Sync</span>
            </span>
          )}

          {/* Workspace Pill Switcher */}
          {canAccessWorkplace && (
            <div className="relative" ref={orgMenuRef}>
              <button
                type="button"
                onClick={() => {
                  if (userApprovedOrgs.length > 1) {
                    setOrgDropdownOpen(!orgDropdownOpen);
                  } else {
                    setEnterpriseMode(!isEnterpriseMode);
                    navigate(isEnterpriseMode ? '/' : '/org/tasks');
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shadow-2xs active:scale-95',
                  isEnterpriseMode
                    ? 'border-workplace/30 bg-workplace/10 text-workplace hover:bg-workplace/15'
                    : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                )}
                title="Switch Workspace"
              >
                {isEnterpriseMode ? (
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <User className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="hidden sm:inline truncate max-w-[110px]">
                  {isEnterpriseMode
                    ? (currentOrg?.trade_name || currentOrg?.legal_name || 'Workplace')
                    : 'Personal'}
                </span>
                {userApprovedOrgs.length > 1 && (
                  <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Multi-Org Dropdown */}
              {orgDropdownOpen && userApprovedOrgs.length > 1 && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-card rounded-xl shadow-lg border border-border/80 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Switch Workplace Organization
                  </div>
                  {userApprovedOrgs.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => {
                        switchOrg(org.id);
                        setEnterpriseMode(true);
                        setOrgDropdownOpen(false);
                        navigate('/org/tasks');
                      }}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors',
                        currentOrg?.id === org.id
                          ? 'bg-workplace/15 text-workplace font-semibold'
                          : 'text-foreground hover:bg-muted/70'
                      )}
                    >
                      <span className="truncate">{org.legal_name}</span>
                      {currentOrg?.id === org.id && (
                        <span className="text-[10px] font-bold text-workplace">Active</span>
                      )}
                    </button>
                  ))}
                  <div className="border-t border-border/80 mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEnterpriseMode(false);
                        setOrgDropdownOpen(false);
                        navigate('/');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted/70 flex items-center gap-1.5"
                    >
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>Switch to Personal Space</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Voice-to-Task Quick Dictation */}
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors flex items-center gap-1 text-xs active:scale-95"
            title="AI Voice-to-Task (मराठी / हिंदी / English)"
          >
            <Mic className="w-4 h-4 text-primary animate-pulse" />
            <span className="hidden md:inline text-[11px] font-semibold text-foreground">Voice</span>
          </button>

          {/* Notification Bell with In-App Drawer Hook */}
          <NotificationBell />

          {/* Quick Add Button in Header (Desktop) */}
          <button
            type="button"
            onClick={() => openCreateModal({ scope: isEnterpriseMode ? 'workplace' : 'personal' })}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-xs transition-all active:scale-95',
              isEnterpriseMode ? 'bg-workplace hover:bg-workplace/90' : 'bg-primary hover:bg-primary/90'
            )}
            title="Create Task"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-muted/70 transition-colors focus:outline-none active:scale-95"
              aria-label="User profile menu"
            >
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
                {(displayName || userEmail || 'U').charAt(0).toUpperCase()}
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-card rounded-xl shadow-lg border border-border/80 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-2 border-b border-border/80">
                  <p className="font-semibold text-xs text-foreground truncate leading-tight">
                    {displayName || 'Operative'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                    {userEmail}
                  </p>
                </div>

                <div className="py-1">
                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted/70 transition-colors"
                  >
                    <span>Settings & App Updates</span>
                  </Link>

                  {isPlatformAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-muted/70 transition-colors"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Platform Admin</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      toggleTheme();
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted/70 transition-colors"
                  >
                    <span>Appearance</span>
                    <span className="text-[10px] font-semibold text-muted-foreground capitalize">
                      {effectiveTheme}
                    </span>
                  </button>
                </div>

                <div className="border-t border-border/80 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors font-medium"
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

      {voiceModalOpen && (
        <VoiceTaskModal
          isOpen={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
        />
      )}
    </header>
  );
};
