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
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';

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
      icon: <Users className="w-5 h-5 text-blue-500" />,
      bg: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
      link: '/admin/users',
    },
    {
      label: 'Active Organizations',
      value: data?.active_organizations ?? 1,
      icon: <Building2 className="w-5 h-5 text-primary" />,
      bg: 'bg-primary/10 border-primary/20 text-primary',
      link: '/admin/organizations',
    },
    {
      label: 'Pending Join Requests',
      value: data?.pending_requests ?? 0,
      icon: <Inbox className="w-5 h-5 text-amber-500" />,
      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
      link: '/admin/requests',
      highlight: (data?.pending_requests ?? 0) > 0,
    },
    {
      label: 'Total Memberships',
      value: data?.total_memberships ?? 1,
      icon: <UserCheck className="w-5 h-5 text-emerald-500" />,
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      link: '/admin/members',
    },
    {
      label: 'Platform Administrators',
      value: data?.platform_admins_count ?? 1,
      icon: <ShieldCheck className="w-5 h-5 text-purple-500" />,
      bg: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
      link: '/admin/roles',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Platform Administration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mt-1">Platform Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Central governance, user verification, organization provisioning, and security management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadData();
              refreshMetrics();
            }}
            disabled={loading}
            className="h-8 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/admin/organizations">
            <Button size="sm" className="h-8 text-xs font-semibold">
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Organization
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {stats.map((stat, i) => (
          <Link
            key={i}
            to={stat.link}
            className={`p-4 rounded-xl bg-card border transition-all hover:border-primary/40 shadow-xs group ${
              stat.highlight
                ? 'border-amber-500/40 ring-2 ring-amber-500/20'
                : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg border ${stat.bg}`}>{stat.icon}</div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-2xl font-bold text-foreground font-mono">{stat.value}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1 truncate">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-foreground">Create Organization</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Provision new enterprise workplaces such as SAMAJ RACHANA CONSTRUCTION LIMITED.
            </p>
            <Link
              to="/admin/organizations"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1"
            >
              <span>Open Organization Manager</span>
              <span>&rarr;</span>
            </Link>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-500">
              <Inbox className="w-5 h-5" />
              <h3 className="text-sm font-bold text-foreground">Review Join Requests</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Approve or reject employee applications before granting organization workspace access.
            </p>
            <Link
              to="/admin/requests"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline pt-1"
            >
              <span>Review Requests ({data?.pending_requests || 0})</span>
              <span>&rarr;</span>
            </Link>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="text-sm font-bold text-foreground">Platform Roles & Security</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Manage database-backed platform administrator privileges and security policy enforcement.
            </p>
            <Link
              to="/admin/roles"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
            >
              <span>View Roles Matrix</span>
              <span>&rarr;</span>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Audit Feed */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Recent Administrative Activity</h3>
            </div>
            <Link to="/admin/audit" className="text-xs font-semibold text-primary hover:underline">
              View All Audit Logs &rarr;
            </Link>
          </div>

          {data?.recent_activity && data.recent_activity.length > 0 ? (
            <div className="space-y-2.5">
              {data.recent_activity.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <span className="font-semibold text-foreground uppercase tracking-wider">{log.action}</span>
                      <span className="text-muted-foreground ml-2">by {log.admin_email || 'System Admin'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent administrative events logged. System is steady.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
