import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCheck,
  Inbox,
  Contact,
  ShieldCheck,
  History,
  Settings,
  ArrowLeft,
  Menu,
  X,
  LogOut,
  Sparkles,
  Radio,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { Logo } from '../common/Logo';

export const AdminLayout: React.FC = () => {
  const { userEmail, signOut } = useAuth();
  const { adminProfile } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, end: true },
    { to: '/admin/releases', label: 'Release Center', icon: <Radio className="w-4 h-4" /> },
    { to: '/admin/users', label: 'Users & Admins', icon: <Users className="w-4 h-4" /> },
    { to: '/admin/organizations', label: 'Organizations', icon: <Building2 className="w-4 h-4" /> },
    { to: '/admin/members', label: 'Organization Members', icon: <UserCheck className="w-4 h-4" /> },
    { to: '/admin/requests', label: 'Join Requests', icon: <Inbox className="w-4 h-4" /> },
    { to: '/admin/directory', label: 'Staff Directory', icon: <Contact className="w-4 h-4" /> },
    { to: '/admin/roles', label: 'Roles & Permissions', icon: <ShieldCheck className="w-4 h-4" /> },
    { to: '/admin/audit', label: 'Audit History', icon: <History className="w-4 h-4" /> },
    { to: '/admin/settings', label: 'Platform Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-card border-r border-border/80 text-foreground">
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Brand & Platform Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2">
              <Logo size="sm" variant="icon" />
              <div>
                <span className="font-bold text-sm text-foreground tracking-wide">TASKER ADMIN</span>
                <span className="block text-[10px] font-semibold text-primary uppercase tracking-wider">
                  Platform Control
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Identity Badge */}
        <div className="p-3 bg-muted/40 border border-border/60 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</span>
          </div>
          <p className="text-xs font-bold text-primary mt-1 uppercase">
            {adminProfile?.role || 'SUPER_ADMIN'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {userEmail || 'admin@tasker.internal'}
          </p>
        </div>

        {/* Exit Admin Button */}
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition-all border border-border/50 shadow-2xs group"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:-translate-x-0.5 transition-transform" />
          <span>Exit Admin / Return to App</span>
        </button>

        {/* Navigation links */}
        <div className="space-y-1 pt-2">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Management Areas
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/80 space-y-2">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-left"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-30 bg-card border-b border-border/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Open Admin Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm text-foreground">Platform Administration</span>
        </div>
        <Link
          to="/"
          className="px-2.5 py-1 text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg border border-border/50"
        >
          Exit
        </Link>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Main Administrative Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Bar for Desktop */}
        <header className="hidden lg:flex items-center justify-between h-14 px-8 bg-card/80 border-b border-border/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 border border-primary/20 text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Central Admin Panel
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium border border-border/50 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to App</span>
            </Link>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

