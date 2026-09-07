import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  CheckSquare2,
  CheckCircle2,
  Bell,
  MoreHorizontal,
  Trash2,
  Settings,
  X,
  IndianRupee,
  Car,
  FileBadge,
  Users,
  Briefcase,
  Sparkles,
  BarChart3,
  Building2,
  Package,
  Receipt,
  FileCheck2,
  UserCheck,
  FolderGit2,
} from 'lucide-react';
import { useTask } from '../../context/TaskContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { useBackButton } from '../../hooks/useBackButton';

export const MobileNav: React.FC = () => {
  const { stats } = useTask();
  const { isEnterpriseMode, setEnterpriseMode } = useEnterprise();
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);

  useBackButton(moreMenuOpen, () => setMoreMenuOpen(false), 30);

  const mainItems = [
    { to: '/', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
    {
      to: '/pending',
      label: 'Pending',
      icon: <Clock className="w-5 h-5" />,
      badge: stats.pending + stats.inProgress + stats.partial > 0 ? stats.pending + stats.inProgress + stats.partial : null,
    },
    { to: '/tasks', label: 'Tasks', icon: <CheckSquare2 className="w-5 h-5" /> },
    { to: '/completed', label: 'Done', icon: <CheckCircle2 className="w-5 h-5" /> },
    { to: '/reminders', label: 'Remind', icon: <Bell className="w-5 h-5" /> },
  ];

  const personalItems = [
    { to: '/finance', label: 'Finance & Bills', icon: <IndianRupee className="w-4 h-4 text-emerald-500" /> },
    { to: '/vehicles', label: 'Vehicles & PUC', icon: <Car className="w-4 h-4 text-blue-500" /> },
    { to: '/documents', label: 'Documents & Vault', icon: <FileBadge className="w-4 h-4 text-indigo-500" /> },
    { to: '/family', label: 'Family & Chores', icon: <Users className="w-4 h-4 text-teal-500" /> },
    { to: '/business', label: 'Business & Khata', icon: <Briefcase className="w-4 h-4 text-purple-500" /> },
    { to: '/templates', label: 'Checklists', icon: <Sparkles className="w-4 h-4 text-amber-500" /> },
    { to: '/reports', label: 'Reports & DPDP', icon: <BarChart3 className="w-4 h-4 text-rose-500" /> },
  ];

  const erpItems = [
    { to: '/erp', label: 'Executive ERP', icon: <Building2 className="w-4 h-4 text-blue-600" /> },
    { to: '/erp/inventory', label: 'Site Inventory', icon: <Package className="w-4 h-4 text-indigo-600" /> },
    { to: '/erp/accounting', label: 'Invoices & Ledger', icon: <Receipt className="w-4 h-4 text-emerald-600" /> },
    { to: '/erp/crm', label: 'CRM & Parties', icon: <Users className="w-4 h-4 text-blue-500" /> },
    { to: '/erp/hr', label: 'HR & Workforce', icon: <UserCheck className="w-4 h-4 text-indigo-500" /> },
    { to: '/erp/approvals', label: 'Approvals Queue', icon: <FileCheck2 className="w-4 h-4 text-amber-500" /> },
    { to: '/erp/documents', label: 'Drawings & Files', icon: <FolderGit2 className="w-4 h-4 text-purple-500" /> },
    { to: '/erp/reports', label: 'Financial Reports', icon: <BarChart3 className="w-4 h-4 text-rose-500" /> },
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
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">TASKER Mode & Modules</h3>
              <button
                onClick={() => setMoreMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setEnterpriseMode(false)}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  !isEnterpriseMode
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                👤 Personal Mode
              </button>
              <button
                type="button"
                onClick={() => setEnterpriseMode(true)}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  isEnterpriseMode
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                🏢 Enterprise ERP
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {(isEnterpriseMode ? erpItems : personalItems).map((m) => (
                <NavLink
                  key={m.to}
                  to={m.to}
                  onClick={() => setMoreMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300'
                    }`
                  }
                >
                  {m.icon}
                  <span className="truncate">{m.label}</span>
                </NavLink>
              ))}

              <NavLink
                to="/bin"
                onClick={() => setMoreMenuOpen(false)}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <Trash2 className="w-4 h-4 text-slate-400" />
                <span>Bin ({stats.binCount})</span>
              </NavLink>

              <NavLink
                to="/settings"
                onClick={() => setMoreMenuOpen(false)}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Settings</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 lg:hidden pb-safe shadow-lg"
      >
        <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
          {mainItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center min-w-[52px] min-h-[46px] rounded-xl px-1.5 py-1 text-[10px] font-semibold transition-all ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`relative p-1 rounded-xl transition-all ${isActive ? 'bg-blue-50 dark:bg-blue-950/60' : ''}`}>
                    {item.icon}
                    {item.badge !== null && item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 tracking-tight truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMoreMenuOpen(true)}
            className="flex flex-col items-center justify-center min-w-[52px] min-h-[46px] rounded-xl px-1.5 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
            aria-label="More navigation options"
          >
            <div className="p-1 rounded-xl">
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className="mt-0.5 tracking-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};
