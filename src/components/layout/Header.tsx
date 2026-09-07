import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Plus,
  Sparkles,
  LogOut,
  Radio,
  ChevronDown,
  Sun,
  Moon,
  Shield,
  Building2,
  User,
} from 'lucide-react';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { useAdmin } from '../../context/AdminContext';
import { DEFAULT_USER_NAME } from '../../constants';
import { Logo } from '../common/Logo';
import { useBackButton } from '../../hooks/useBackButton';
import { NotificationBell } from '../notifications/NotificationBell';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const {
    openCreateModal,
    openUniversalSearch,
    openAIDrawer,
    isRealtimeConnected,
  } = useTask();

  const { user, userEmail, displayName, signOut } = useAuth();
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

  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);

  const canAccessWorkplace = hasApprovedOrg || isPlatformAdmin;

  // Register with Android hardware back button handler (Priority 30: Menus & Popups)
  useBackButton(profileOpen, () => setProfileOpen(false), 30);

  // Keyboard shortcut: Ctrl+K or / to open Universal Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openUniversalSearch();
      }
      if (e.key === 'Escape' && profileOpen) {
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openUniversalSearch, profileOpen]);

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
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors pt-safe shadow-xs">
      <div className="flex items-center justify-between h-14 sm:h-16 px-2.5 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden">
        {/* Mobile Left Bar: Menu trigger & Unified Brand */}
        <div className="flex items-center gap-1.5 lg:hidden shrink-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="p-1.5 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="sm:hidden">
            <Logo size="xs" variant="icon" />
          </div>
          <div className="hidden sm:block">
            <Logo size="xs" variant="full" />
          </div>
        </div>

        {/* Global Universal Search Bar Trigger (Command Palette style - Desktop) */}
        <div className="hidden sm:flex flex-1 max-w-md mx-4">
          <button
            type="button"
            onClick={() => openUniversalSearch()}
            className="w-full flex items-center justify-between px-3.5 py-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl transition-all shadow-xs group"
          >
            <div className="flex items-center gap-2.5 min-w-0 truncate">
              <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
              <span className="text-xs font-medium truncate">Search tasks, notes, attachments...</span>
            </div>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-xs shrink-0">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Central Workspace Switcher (Mobile & Desktop) */}
        <div className="flex items-center mx-1 shrink min-w-0">
          {canAccessWorkplace ? (
            <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs max-w-full">
              <button
                type="button"
                onClick={() => {
                  setEnterpriseMode(false);
                  navigate('/');
                }}
                className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                  !isEnterpriseMode
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Switch to Personal Space"
              >
                <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden xs:inline">Personal</span>
              </button>

              <div className="relative min-w-0" ref={orgMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (userApprovedOrgs.length > 1) {
                      setOrgDropdownOpen(!orgDropdownOpen);
                    } else {
                      setEnterpriseMode(true);
                      navigate('/org/tasks');
                    }
                  }}
                  className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 max-w-[85px] xs:max-w-[130px] sm:max-w-[180px] truncate shrink ${
                    isEnterpriseMode
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title={currentOrg?.legal_name || 'Workplace'}
                >
                  <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">{currentOrg?.trade_name || currentOrg?.legal_name || 'Workplace'}</span>
                  {userApprovedOrgs.length > 1 && (
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                </button>

                {/* Multi-Org Switcher Dropdown */}
                {orgDropdownOpen && userApprovedOrgs.length > 1 && (
                  <div className="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700/80 p-2 z-50">
                    <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Switch Organization
                    </p>
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
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                          currentOrg?.id === org.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{org.legal_name}</span>
                        {currentOrg?.id === org.id && <span className="text-[10px] font-bold">Active</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">Personal</span>
            </div>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mobile Search Icon Button */}
          <button
            type="button"
            onClick={() => openUniversalSearch()}
            className="sm:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors"
            aria-label="Search"
          >
            <Search className="w-4.5 h-4.5" />
          </button>

          {/* Platform Admin Quick Shortcut (Only for verified Platform Admins) */}
          {isPlatformAdmin && (
            <Link
              to="/admin"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/70 hover:bg-purple-100 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold transition-all shadow-xs"
              title="Open Central Platform Administration"
            >
              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Platform Admin</span>
            </Link>
          )}

          {/* Realtime Live Sync Indicator (Desktop) */}
          {isRealtimeConnected && (
            <span
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium"
              title="Supabase Realtime is active. Changes sync instantly."
            >
              <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span>Live Sync</span>
            </span>
          )}

          {/* Theme Quick Toggle Button (Desktop & Tablet only) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="hidden sm:flex p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-w-[38px] min-h-[38px] items-center justify-center"
            title={`Switch to ${effectiveTheme === 'dark' ? 'Light' : 'Dark'} theme`}
            aria-label="Toggle theme"
          >
            {effectiveTheme === 'dark' ? (
              <Moon className="w-4 h-4 text-blue-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
          </button>

          {/* Desktop Task-Aware AI Button */}
          <button
            type="button"
            onClick={openAIDrawer}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700 text-xs font-bold transition-all shadow-xs"
            title="Open Task-Aware AI Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Ask AI</span>
          </button>

          {/* Quick + Add Task Button (Desktop & Tablet only) */}
          <button
            type="button"
            onClick={() =>
              openCreateModal({
                scope: isEnterpriseMode ? 'workplace' : 'personal',
                org_id: isEnterpriseMode ? currentOrg?.id : undefined,
              })
            }
            className="hidden md:inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all min-h-[36px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>

          {/* In-App Notifications Bell - ALWAYS VISIBLE ON MOBILE */}
          <div className="shrink-0 flex items-center">
            <NotificationBell />
          </div>

          {/* User Profile & Account Dropdown */}
          <div className="relative pl-0.5 sm:pl-1.5 shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1 p-1 sm:px-2 sm:py-1 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-h-[36px]"
              aria-label="User profile menu"
              aria-expanded={profileOpen}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                {(displayName || userEmail || DEFAULT_USER_NAME).charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 hidden md:inline-block max-w-[120px] truncate">
                {displayName || userEmail || DEFAULT_USER_NAME}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 hidden sm:inline-block transition-transform duration-150 ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700/80 py-2 z-40 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {displayName || 'TASKER User'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {userEmail || user?.id || 'Connected'}
                  </p>
                </div>

                <div className="px-2 py-1.5 space-y-1">
                  {/* Platform Admin Link */}
                  {isPlatformAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-xl transition-colors text-left"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Platform Admin Panel</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};