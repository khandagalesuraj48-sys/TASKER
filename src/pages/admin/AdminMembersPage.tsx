import React, { useEffect, useState } from 'react';
import {
  Building2,
  RefreshCw,
  Search,
  MapPin,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { setUserSites } from '../../services/enterpriseService';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { AppUserAdminView } from '../../types/admin';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';

export const AdminMembersPage: React.FC = () => {
  const { showToast } = useToast();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [appUsers, setAppUsers] = useState<Map<string, AppUserAdminView>>(new Map());
  const [allSites, setAllSites] = useState<any[]>([]);
  const [userSitesMap, setUserSitesMap] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('team_member');

  // Site Assignment Modal
  const [siteModalMember, setSiteModalMember] = useState<any | null>(null);
  const [tempSiteIds, setTempSiteIds] = useState<string[]>([]);
  const [isSavingSites, setIsSavingSites] = useState<boolean>(false);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const [membersData, usersData, sitesRes, userSitesRes] = await Promise.all([
        adminService.getAllMemberships(),
        adminService.getAllAppUsers(),
        supabase.from('org_sites').select('*'),
        supabase.from('org_user_sites').select('*'),
      ]);

      setMemberships(membersData || []);

      // Build User Map
      const uMap = new Map<string, AppUserAdminView>();
      (usersData || []).forEach((u) => uMap.set(u.id, u));
      setAppUsers(uMap);

      setAllSites(sitesRes.data || []);

      // Build User-Sites Map: key = userId_orgId
      const sMap = new Map<string, string[]>();
      (userSitesRes.data || []).forEach((us: any) => {
        const key = `${us.user_id}_${us.org_id}`;
        const list = sMap.get(key) || [];
        list.push(us.site_id);
        sMap.set(key, list);
      });
      setUserSitesMap(sMap);
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

  // Open site assignment modal
  const handleOpenSiteModal = (m: any) => {
    const key = `${m.user_id}_${m.org_id}`;
    const currentAssigned = userSitesMap.get(key) || [];
    setSiteModalMember(m);
    setTempSiteIds(currentAssigned);
  };

  const handleToggleSite = (siteId: string) => {
    setTempSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSaveSites = async () => {
    if (!siteModalMember) return;
    setIsSavingSites(true);
    try {
      const ok = await setUserSites(siteModalMember.user_id, siteModalMember.org_id, tempSiteIds);
      if (ok) {
        showToast('Sites updated successfully', 'success');
        setSiteModalMember(null);
        loadMembers();
      } else {
        showToast('Failed to update sites', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update sites', 'error');
    } finally {
      setIsSavingSites(false);
    }
  };

  const filtered = memberships.filter((m) => {
    const user = appUsers.get(m.user_id);
    const userName = (user?.display_name || '').toLowerCase();
    const userEmail = (user?.email || '').toLowerCase();
    const orgName = (m.organization?.legal_name || '').toLowerCase();
    const role = (m.role || '').toLowerCase();
    const q = search.toLowerCase();

    return (
      userName.includes(q) ||
      userEmail.includes(q) ||
      orgName.includes(q) ||
      role.includes(q) ||
      m.user_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Organization Members</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage member names, roles, organization access, and site assignments (e.g. VTR, 18 B, etc.).
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
          placeholder="Search by user name, email, organization, or role..."
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
                <th className="pb-3 font-semibold">User Details</th>
                <th className="pb-3 font-semibold">Organization</th>
                <th className="pb-3 font-semibold">Assigned Sites</th>
                <th className="pb-3 font-semibold">Assigned Role</th>
                <th className="pb-3 font-semibold">Approved Date</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((m) => {
                const user = appUsers.get(m.user_id);
                const displayName = user?.display_name || (user?.email ? user.email.split('@')[0] : 'User');
                const userEmail = user?.email || null;
                const userInitial = (displayName[0] || 'U').toUpperCase();

                // Get assigned sites for this user in this org
                const key = `${m.user_id}_${m.org_id}`;
                const assignedSiteIds = userSitesMap.get(key) || [];
                const assignedSites = allSites.filter((s) => s.org_id === m.org_id && assignedSiteIds.includes(s.id));

                return (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* User Identity with Name & Email */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                          {userInitial}
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs leading-snug">
                            {displayName}
                          </p>
                          {userEmail && (
                            <p className="text-[11px] text-slate-400 font-medium">
                              {userEmail}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500 font-mono">
                            ID: {m.user_id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Organization */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="font-semibold text-white">
                          {m.organization?.legal_name || 'Organization'}
                        </span>
                      </div>
                    </td>

                    {/* Assigned Sites */}
                    <td className="py-3.5">
                      <div className="flex flex-wrap items-center gap-1 max-w-xs">
                        {assignedSites.length === 0 ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            All Sites
                          </span>
                        ) : (
                          assignedSites.map((s) => (
                            <span
                              key={s.id}
                              className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"
                            >
                              <MapPin className="w-2.5 h-2.5" />
                              {s.name} ({s.code})
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Assigned Role */}
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

                    {/* Approved Date */}
                    <td className="py-3.5 text-slate-400">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenSiteModal(m)}
                        className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg text-[11px] font-bold border border-indigo-500/30 transition-all inline-flex items-center gap-1"
                        title="Assign Sites"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>Sites</span>
                      </button>

                      {editingId !== m.id && (
                        <button
                          onClick={() => {
                            setEditingId(m.id);
                            setSelectedRole(m.role);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold border border-slate-700 transition-all"
                        >
                          Role
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
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No memberships found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Sites Modal */}
      <Modal
        isOpen={Boolean(siteModalMember)}
        onClose={() => setSiteModalMember(null)}
        title="Assign Organization Sites"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-indigo-950/40 rounded-2xl border border-indigo-900/60">
            <p className="text-xs font-bold text-indigo-200">
              {appUsers.get(siteModalMember?.user_id)?.display_name || 'Member'} ({siteModalMember?.organization?.legal_name})
            </p>
            <p className="text-[11px] text-indigo-300 mt-0.5">
              Select which sites this user is assigned to. The user will strictly only see tasks from checked sites:
            </p>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {allSites
              .filter((s) => s.org_id === siteModalMember?.org_id)
              .map((site) => {
                const isChecked = tempSiteIds.includes(site.id);
                return (
                  <div
                    key={site.id}
                    onClick={() => handleToggleSite(site.id)}
                    className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                      isChecked
                        ? 'border-indigo-500 bg-indigo-950/50 text-white'
                        : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-700 bg-slate-800'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold">{site.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">Code: {site.code}</p>
                      </div>
                    </div>

                    {isChecked && (
                      <span className="text-[10px] font-black text-indigo-400">
                        Assigned
                      </span>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                const orgSites = allSites.filter((s) => s.org_id === siteModalMember?.org_id);
                setTempSiteIds(tempSiteIds.length === orgSites.length ? [] : orgSites.map((s) => s.id));
              }}
              className="text-[11px] font-bold text-indigo-400 hover:underline"
            >
              Toggle Select All
            </button>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSiteModalMember(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveSites} isLoading={isSavingSites}>
                Save Sites
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
