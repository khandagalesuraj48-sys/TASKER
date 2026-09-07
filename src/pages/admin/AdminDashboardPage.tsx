import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  Inbox,
  UserCheck,
  ShieldCheck,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { adminService } from '../../services/adminService';
import { AdminDashboardMetrics } from '../../types/admin';

export const AdminDashboardPage: React.FC = () => {
  const { metrics, refreshMetrics } = useAdmin();
  const [data, setData] = useState<AdminDashboardMetrics | null>(metrics);
  const [loading, setLoading] = useState<boolean>(!metrics);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminService.getDashboardMetrics();
      setData(res);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!metrics) {
      loadData();
    } else {
      setData(metrics);
    }
  }, [metrics]);

  const stats = [
    {
      label: 'Total Registered Users',
      value: data?.total_users ?? 1,
      icon: <Users className="w-5 h-5 text-blue-400" />,
      bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      link: '/admin/users',
    },
    {
      label: 'Active Organizations',
      value: data?.active_organizations ?? 1,
      icon: <Building2 className="w-5 h-5 text-indigo-400" />,
      bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      link: '/admin/organizations',
    },
    {
      label: 'Pending Join Requests',
      value: data?.pending_requests ?? 0,
      icon: <Inbox className="w-5 h-5 text-amber-400" />,
      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      link: '/admin/requests',
      highlight: (data?.pending_requests ?? 0) > 0,
    },
    {
      label: 'Organization Memberships',
      value: data?.total_memberships ?? 1,
      icon: <UserCheck className="w-5 h-5 text-emerald-400" />,
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      link: '/admin/members',
    },
    {
      label: 'Platform Administrators',
      value: data?.platform_admins_count ?? 1,
      icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
      bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      link: '/admin/roles',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Platform Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Central governance, user verification, organization provisioning, and security management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadData();
              refreshMetrics();
            }}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            to="/admin/organizations"
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Organization</span>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <Link
            key={i}
            to={stat.link}
            className={`p-4 rounded-2xl bg-slate-900 border transition-all hover:-translate-y-0.5 shadow-lg group ${
              stat.highlight
                ? 'border-amber-500/40 ring-2 ring-amber-500/20'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border ${stat.bg}`}>{stat.icon}</div>
              <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </div>
            <p className="text-2xl font-black text-white">{stat.value}</p>
            <p className="text-xs font-semibold text-slate-400 mt-1 truncate">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-900/40 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400">
            <Building2 className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">Create Organization</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Provision new enterprise workplaces such as SAMAJ RACHANA CONSTRUCTION LIMITED.
          </p>
          <Link
            to="/admin/organizations"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300"
          >
            <span>Open Organization Manager</span>
            <span>&rarr;</span>
          </Link>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-900/40 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Inbox className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">Review Join Requests</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Approve or reject employee applications before granting organization workspace access.
          </p>
          <Link
            to="/admin/requests"
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
          >
            <span>Review Pending Requests ({data?.pending_requests || 0})</span>
            <span>&rarr;</span>
          </Link>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-900/40 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">Platform Roles & Security</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Manage database-backed platform administrator privileges and security policy enforcement.
          </p>
          <Link
            to="/admin/roles"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300"
          >
            <span>View Roles Matrix</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>

      {/* Recent Activity Audit Feed */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Recent Administrative Activity</h3>
          </div>
          <Link to="/admin/audit" className="text-xs font-bold text-indigo-400 hover:text-indigo-300">
            View All Audit Logs &rarr;
          </Link>
        </div>

        {data?.recent_activity && data.recent_activity.length > 0 ? (
          <div className="space-y-3">
            {data.recent_activity.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <div>
                    <span className="font-bold text-white uppercase tracking-wider">{log.action}</span>
                    <span className="text-slate-400 ml-2">by {log.admin_email || 'System Admin'}</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p>No recent administrative events logged. System is steady.</p>
          </div>
        )}
      </div>
    </div>
  );
};

