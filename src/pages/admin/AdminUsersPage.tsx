import React, { useEffect, useState } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { PlatformAdmin } from '../../types/admin';
import { OrgMembership } from '../../types/enterprise';
import { useToast } from '../../context/ToastContext';

export const AdminUsersPage: React.FC = () => {
  const { showToast } = useToast();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [adminList, memberList] = await Promise.all([
        adminService.getPlatformAdmins(),
        adminService.getAllMemberships(),
      ]);
      setAdmins(adminList);
      setMemberships(memberList);
    } catch (err: any) {
      console.error('Failed to load users & admins:', err);
      showToast(err.message || 'Failed to load user list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;

    setIsSubmitting(true);
    try {
      await adminService.grantPlatformAdmin(newAdminEmail.trim(), 'super_admin');
      showToast(`Super Admin role granted to ${newAdminEmail}`, 'success');
      setNewAdminEmail('');
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      console.error('Grant admin error:', err);
      showToast(err.message || 'Failed to grant admin role', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeAdmin = async (adminId: string, email: string | null) => {
    if (!confirm(`Are you sure you want to revoke platform admin privileges from ${email || 'this user'}?`)) {
      return;
    }
    try {
      await adminService.revokePlatformAdmin(adminId);
      showToast('Platform admin role revoked', 'info');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke role', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Platform Users & Admins</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage central Platform Administrators and cross-organization user accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Assign Platform Admin</span>
          </button>
        </div>
      </div>

      {/* Platform Admins Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-indigo-400">
            <Shield className="w-5 h-5" />
            <h2 className="text-base font-bold text-white">Central Platform Administrators</h2>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{admins.length} registered</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800/80">
                <th className="pb-3 font-semibold">Admin Email / Identity</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Assigned Date</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {admins.map((adm) => (
                <tr key={adm.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs">
                        {(adm.email || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white">{adm.email || 'Admin User'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{adm.user_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 uppercase">
                      {adm.role}
                    </span>
                  </td>
                  <td className="py-3">
                    {adm.is_active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px]">
                        <XCircle className="w-3.5 h-3.5" />
                        Revoked
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-slate-400">
                    {new Date(adm.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    {adm.is_active && (
                      <button
                        onClick={() => handleRevokeAdmin(adm.id, adm.email)}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg font-semibold text-[11px] border border-rose-500/20 transition-all"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cross-Organization Active Memberships */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-blue-400">
            <Users className="w-5 h-5" />
            <h2 className="text-base font-bold text-white">Active Organization Memberships</h2>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{memberships.length} active</span>
        </div>

        <p className="text-xs text-slate-400">
          Every approved organization member uses ONE authenticated user ID to access both their private Personal Space and their approved Organization Space.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800/80">
                <th className="pb-3 font-semibold">User ID</th>
                <th className="pb-3 font-semibold">Organization</th>
                <th className="pb-3 font-semibold">Organization Role</th>
                <th className="pb-3 font-semibold">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {memberships.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 font-mono text-[11px] text-slate-300">
                    {m.user_id}
                  </td>
                  <td className="py-3 font-semibold text-white">
                    {m.organization?.legal_name || 'Organization'}
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 uppercase">
                      {m.role}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Platform Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                Assign Platform Admin
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enter the registered email of the user to grant <span className="font-mono text-indigo-300">SUPER_ADMIN</span> privileges. The user must already exist in Supabase Auth.
            </p>

            <form onSubmit={handleGrantAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  User Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@tasker.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Assigning...' : 'Assign Super Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
