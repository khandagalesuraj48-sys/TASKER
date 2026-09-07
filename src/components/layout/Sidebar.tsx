import React, { useState } from 'react';
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
  IndianRupee,
  Car,
  FileBadge,
  Users,
  Briefcase,
  Sparkles,
  BarChart3,
  ChevronDown,
  Check,
  Building2,
  Package,
  Receipt,
  FileCheck2,
  UserCheck,
  FolderGit2,
} from 'lucide-react';
import { useTask } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useEnterprise } from '../../context/EnterpriseContext';
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
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const { isEnterpriseMode, setEnterpriseMode, currentOrg } = useEnterprise();
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);

  const coreNavItems = [
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
  ];

  const osNavItems = [
    { to: '/finance', label: 'Finance & Bills', icon: <IndianRupee className="w-4 h-4 text-emerald-500" /> },
    { to: '/vehicles', label: 'Vehicles & PUC', icon: <Car className="w-4 h-4 text-blue-500" /> },
    { to: '/documents', label: 'Documents & Vault', icon: <FileBadge className="w-4 h-4 text-indigo-500" /> },
    { to: '/family', label: 'Family & Home', icon: <Users className="w-4 h-4 text-teal-500" /> },
    { to: '/business', label: 'Business & Khata', icon: <Briefcase className="w-4 h-4 text-purple-500" /> },
    { to: '/templates', label: 'Checklists', icon: <Sparkles className="w-4 h-4 text-amber-500" /> },
    { to: '/reports', label: 'Reports & DPDP', icon: <BarChart3 className="w-4 h-4 text-rose-500" /> },
  ];

  const erpNavItems = [
    { to: '/erp', label: 'Executive Dashboard', icon: <Building2 className="w-4 h-4 text-blue-600" /> },
    { to: '/erp/inventory', label: 'Site Inventory & GRN', icon: <Package className="w-4 h-4 text-indigo-600" /> },
    { to: '/erp/accounting', label: 'Invoicing & GL Ledger', icon: <Receipt className="w-4 h-4 text-emerald-600" /> },
    { to: '/erp/crm', label: 'CRM & Commercial Parties', icon: <Users className="w-4 h-4 text-blue-500" /> },
    { to: '/erp/hr', label: 'HR & Site Workforce', icon: <UserCheck className="w-4 h-4 text-indigo-500" /> },
    { to: '/erp/approvals', label: 'Approvals Center', icon: <FileCheck2 className="w-4 h-4 text-amber-500" /> },
    { to: '/erp/documents', label: 'Documents & Blueprints', icon: <FolderGit2 className="w-4 h-4 text-purple-500" /> },
    { to: '/erp/reports', label: 'Financial Intelligence', icon: <BarChart3 className="w-4 h-4 text-rose-500" /> },
  ];

  const systemNavItems = [
    {
      to: '/bin',
      label: 'Bin',
      icon: <Trash2 className="w-4 h-4" />,
      badge: stats.binCount > 0 ? String(stats.binCount) : undefined,
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    },
    { to: '/settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors pt-safe pb-safe">
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
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

        {/* Mode Switcher (Personal vs Enterprise ERP) */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setEnterpriseMode(false)}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
              !isEnterpriseMode
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            👤 Personal
          </button>
          <button
            type="button"
            onClick={() => setEnterpriseMode(true)}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
              isEnterpriseMode
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            🏢 Enterprise
          </button>
        </div>

        {/* Workspace or Org Info */}
        {!isEnterpriseMode ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
              className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-base">{currentWorkspace?.icon || '👤'}</span>
                <span className="truncate">{currentWorkspace?.name || 'Personal Workspace'}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {workspaceDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-1.5 space-y-1">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      switchWorkspace(ws.id);
                      setWorkspaceDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors ${
                      ws.id === currentWorkspace?.id
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{ws.icon}</span>
                      <span>{ws.name}</span>
                    </div>
                    {ws.id === currentWorkspace?.id && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
              Organization Entity
            </span>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
              {currentOrg?.legal_name || 'One Click Enterprise'}
            </p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => {
            openCreateModal();
            onClose();
          }}
          className="w-full py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Task</span>
        </button>

        {/* Navigation list */}
        {isEnterpriseMode ? (
          <div className="space-y-0.5">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              ERP & Multi-Site Modules
            </p>
            {erpNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/erp'}
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
          </div>
        ) : (
          <>
            <div className="space-y-0.5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Tasks & Reminders
              </p>
              {coreNavItems.map((item) => (
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

            <div className="space-y-0.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Life & Work OS
              </p>
              {osNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
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
                </NavLink>
              ))}
            </div>
          </>
        )}

        {/* System */}
        <div className="space-y-0.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          {systemNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
      </div>

      {/* Footer */}
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

        <div className="pt-1 text-center">
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-tight leading-tight">
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
