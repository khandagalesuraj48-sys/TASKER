import React, { useEffect, useState } from 'react';
import {
  Building2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../context/ToastContext';

export const AdminMembersPage: React.FC = () => {
  const { showToast } = useToast();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('team_member');

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAllMemberships();
      setMemberships(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load memberships', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleUpdateRole = async (membershipId: string) => {
    try {
      await adminService.updateMembershipRole(membershipId, selectedRole);
      showToast('Membership role updated', 'success');
      setEditingId(null);
      loadMembers();
    } catch (err: any) {
      showToast(err.message || 'Failed to update role', 'error');
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) return;
    try {
      await adminService.removeMembership(membershipId);
      showToast('Membership removed successfully', 'info');
      loadMembers();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove membership', 'error');
    }
  };

  const filtered = memberships.filter((m) =>
    (m.organization?.legal_name || '').toLowerCase().includes(search.toLowerCase()) ||
    m.user_id.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Organization Members</h1>
          <p className="text-xs text-slate-400 mt-1">
            Govern user memberships, assign organization-level roles, or revoke workplace access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMembers}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by organization, user ID, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800/80">
                <th className="pb-3 font-semibold">User Identity</th>
                <th className="pb-3 font-semibold">Organization</th>
                <th className="pb-3 font-semibold">Assigned Role</th>
                <th className="pb-3 font-semibold">Approved Date</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 font-mono text-[11px] text-slate-300">
                    {m.user_id}
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-semibold text-white">
                        {m.organization?.legal_name || 'Organization'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5">
                    {editingId === m.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                        >
                          <option value="org_owner">Org Owner</option>
                          <option value="org_admin">Org Admin</option>
                          <option value="project_manager">Project Manager</option>
                          <option value="team_member">Team Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => handleUpdateRole(m.id)}
                          className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 bg-slate-800 text-slate-400 rounded-lg text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 uppercase">
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 text-slate-400">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 text-right space-x-2">
                    {editingId !== m.id && (
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setSelectedRole(m.role);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold border border-slate-700 transition-all"
                      >
                        Change Role
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[11px] font-semibold border border-rose-500/20 transition-all"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No memberships found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
