import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Building2,
  ArrowRightLeft,
  Trash2,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { PlatformAdmin, AppUserAdminView } from '../../types/admin';
import { Organization } from '../../types/enterprise';
import { useToast } from '../../context/ToastContext';

export const AdminUsersPage: React.FC = () => {
  const { showToast } = useToast();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [appUsers, setAppUsers] = useState<AppUserAdminView[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'in_org' | 'no_org' | 'multi_org'>('all');

  // Modal: Add Platform Admin
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState<boolean>(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState<boolean>(false);

  // Modal: Manage User Organizations
  const [selectedUser, setSelectedUser] = useState<AppUserAdminView | null>(null);
  const [showManageOrgModal, setShowManageOrgModal] = useState<boolean>(false);
  const [targetOrgId, setTargetOrgId] = useState<string>('');
  const [targetRole, setTargetRole] = useState<string>('team_member');
  const [exclusiveMove, setExclusiveMove] = useState<boolean>(false);
  const [isSavingOrg, setIsSavingOrg] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [adminList, userList, orgList] = await Promise.all([
        adminService.getPlatformAdmins(),
        adminService.getAllAppUsers(),
        adminService.getAllOrganizations(),
      ]);
      setAdmins(adminList);
      setAppUsers(userList);
      setOrganizations(orgList);
    } catch (err: any) {
      console.error('Failed to load users & admins:', err);
      showToast(err.message || 'Failed to load user directory', 'error');
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

    setIsSubmittingAdmin(true);
    try {
      await adminService.grantPlatformAdmin(newAdminEmail.trim(), 'super_admin');
      showToast(`Super Admin role granted to ${newAdminEmail}`, 'success');
      setNewAdminEmail('');
      setShowAddAdminModal(false);
      loadData();
    } catch (err: any) {
      console.error('Grant admin error:', err);
      showToast(err.message || 'Failed to grant admin role', 'error');
    } finally {
      setIsSubmittingAdmin(false);
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

  const openManageOrgModal = (user: AppUserAdminView) => {
    setSelectedUser(user);
    // Find first org user is not already in, or first active org
    const userOrgIds = new Set(user.organizations.map((o) => o.org_id));
    const availableOrg = organizations.find((o) => o.is_active && !userOrgIds.has(o.id));
    setTargetOrgId(availableOrg ? availableOrg.id : organizations[0]?.id || '');
    setTargetRole('team_member');
    setExclusiveMove(false);
    setShowManageOrgModal(true);
  };

  const handleAssignOrMoveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !targetOrgId) return;

    setIsSavingOrg(true);
    try {
      await adminService.assignUserToOrganization(
        selectedUser.id,
        targetOrgId,
        targetRole,
        exclusiveMove
      );

      const targetOrg = organizations.find((o) => o.id === targetOrgId);
      const orgName = targetOrg?.legal_name || 'Organization';

      if (exclusiveMove) {
        showToast(`${selectedUser.display_name} exclusively moved to ${orgName}`, 'success');
      } else {
        showToast(`${selectedUser.display_name} assigned to ${orgName}`, 'success');
      }

      await loadData();

      // Refresh selected user object
      const updatedUsers = await adminService.getAllAppUsers();
      setAppUsers(updatedUsers);
      const updatedSelected = updatedUsers.find((u) => u.id === selectedUser.id);
      if (updatedSelected) {
        setSelectedUser(updatedSelected);
      } else {
        setShowManageOrgModal(false);
      }
    } catch (err: any) {
      console.error('Failed to assign/move user:', err);
      showToast(err.message || 'Failed to update user organization', 'error');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleRemoveFromOrg = async (userId: string, orgId: string, orgName: string) => {
    if (!confirm(`Remove this user from ${orgName}?`)) return;

    try {
      await adminService.removeUserFromOrganization(userId, orgId);
      showToast(`User removed from ${orgName}`, 'info');
      await loadData();

      const updatedUsers = await adminService.getAllAppUsers();
      setAppUsers(updatedUsers);
      if (selectedUser && selectedUser.id === userId) {
        const updatedSelected = updatedUsers.find((u) => u.id === userId);
        if (updatedSelected) {
          setSelectedUser(updatedSelected);
        }
      }
    } catch (err: any) {
      console.error('Failed to remove user from org:', err);
      showToast(err.message || 'Failed to remove user from organization', 'error');
    }
  };

  // Filtered App Users
  const filteredUsers = useMemo(() => {
    return appUsers.filter((u) => {
      // Text search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.organizations.some((o) => o.org_name.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Category filter
      if (filterMode === 'in_org') return u.organizations.length > 0;
      if (filterMode === 'no_org') return u.organizations.length === 0;
      if (filterMode === 'multi_org') return u.organizations.length > 1;
      return true;
    });
  }, [appUsers, searchQuery, filterMode]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">App Users & Organization Directory</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Central user management: view all registered app users, see their joined organizations, and assign or move users between workplaces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-semibold transition-all border border-border/50 flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddAdminModal(true)}
            className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Assign Super Admin</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilterMode('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            filterMode === 'all'
              ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20'
              : 'bg-card border-border/80 hover:border-border'
          }`}
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Users</p>
          <p className="text-2xl font-bold text-foreground mt-1">{appUsers.length}</p>
        </div>

        <div
          onClick={() => setFilterMode('in_org')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            filterMode === 'in_org'
              ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/20'
              : 'bg-card border-border/80 hover:border-border'
          }`}
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">In Workplace</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {appUsers.filter((u) => u.organizations.length > 0).length}
          </p>
        </div>

        <div
          onClick={() => setFilterMode('multi_org')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            filterMode === 'multi_org'
              ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/20'
              : 'bg-card border-border/80 hover:border-border'
          }`}
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Multi-Workplace</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {appUsers.filter((u) => u.organizations.length > 1).length}
          </p>
        </div>

        <div
          onClick={() => setFilterMode('no_org')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-2xs ${
            filterMode === 'no_org'
              ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20'
              : 'bg-card border-border/80 hover:border-border'
          }`}
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Personal Only</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {appUsers.filter((u) => u.organizations.length === 0).length}
          </p>
        </div>
      </div>

      {/* App Users Management Directory Table */}
      <div className="bg-card border border-border/80 rounded-xl p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
          <div className="flex items-center gap-2 text-primary">
            <Users className="w-5 h-5" />
            <h2 className="text-base font-bold text-foreground">All App Registered Users</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
              {filteredUsers.length} shown
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user, email, org..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-input/80 text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/80">
                <th className="pb-3 font-semibold">User Details</th>
                <th className="pb-3 font-semibold">Joined Organizations & Roles</th>
                <th className="pb-3 font-semibold">Admin Privilege</th>
                <th className="pb-3 font-semibold">Joined Date</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {(u.display_name || u.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{u.display_name || 'App User'}</span>
                            {u.is_platform_admin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/15 text-primary border border-primary/25">
                                SUPER ADMIN
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                          <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{u.id}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3">
                      {u.organizations.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          Personal Space Only
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                          {u.organizations.map((org) => (
                            <div
                              key={org.membership_id || org.org_id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/70 text-foreground text-[11px]"
                            >
                              <Building2 className="w-3 h-3 text-primary shrink-0" />
                              <span className="font-semibold">{org.org_name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/15 text-primary uppercase">
                                {org.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-3">
                      {u.is_platform_admin ? (
                        <span className="inline-flex items-center gap-1 text-primary font-semibold text-[11px]">
                          <Shield className="w-3.5 h-3.5" />
                          Platform Admin
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Standard User</span>
                      )}
                    </td>

                    <td className="py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3 text-right">
                      <button
                        onClick={() => openManageOrgModal(u)}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-semibold text-xs border border-primary/20 transition-all flex items-center gap-1.5 ml-auto shadow-2xs"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Manage Orgs</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Central Platform Administrators Section */}
      <div className="bg-card border border-border/80 rounded-xl p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/80">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            <h2 className="text-base font-bold text-foreground">Central Platform Administrators</h2>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">{admins.length} registered</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/80">
                <th className="pb-3 font-semibold">Admin Email / Identity</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Assigned Date</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {admins.map((adm) => (
                <tr key={adm.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                        {(adm.email || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{adm.email || 'Admin User'}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{adm.user_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary uppercase">
                      {adm.role}
                    </span>
                  </td>
                  <td className="py-3">
                    {adm.is_active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
                        <XCircle className="w-3.5 h-3.5" />
                        Revoked
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {new Date(adm.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right">
                    {adm.is_active && (
                      <button
                        onClick={() => handleRevokeAdmin(adm.id, adm.email)}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg font-semibold text-[11px] border border-rose-500/20 transition-all shadow-2xs"
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

      {/* Modal: Manage User Organizations (Move or Multi-Org Assign) */}
      {showManageOrgModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-foreground">
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-primary" />
                  Manage User Organizations
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedUser.display_name} ({selectedUser.email})
                </p>
              </div>
              <button
                onClick={() => setShowManageOrgModal(false)}
                className="text-muted-foreground hover:text-foreground text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Current Memberships */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Current Assigned Organizations
              </label>

              {selectedUser.organizations.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 text-center text-xs text-muted-foreground">
                  This user currently operates in Personal Space only. Not assigned to any organization yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedUser.organizations.map((org) => (
                    <div
                      key={org.org_id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/70"
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2 className="w-4 h-4 text-primary" />
                        <div>
                          <p className="font-bold text-foreground text-xs">{org.org_name}</p>
                          <span className="text-[10px] text-primary uppercase font-semibold">
                            Role: {org.role}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromOrg(selectedUser.id, org.org_id, org.org_name)}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold border border-rose-500/20 transition-all flex items-center gap-1 shadow-2xs"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assign / Move Form */}
            <form onSubmit={handleAssignOrMoveOrg} className="space-y-4 pt-3 border-t border-border/80">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Assign or Move to Organization
              </label>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Select Target Organization
                  </label>
                  <select
                    value={targetOrgId}
                    onChange={(e) => setTargetOrgId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-input/80 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">-- Choose Organization --</option>
                    {organizations
                      .filter((o) => o.is_active)
                      .map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.legal_name} {org.trade_name ? `(${org.trade_name})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Assign Role in Organization
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-input/80 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="team_member">Team Member (Collaborator)</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="org_admin">Organization Admin</option>
                  </select>
                </div>

                {/* Exclusive Move Checkbox */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/70 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="exclusiveMove"
                    checked={exclusiveMove}
                    onChange={(e) => setExclusiveMove(e.target.checked)}
                    className="mt-0.5 rounded text-primary focus:ring-primary bg-background border-border/80"
                  />
                  <label htmlFor="exclusiveMove" className="text-xs text-foreground cursor-pointer">
                    <span className="font-semibold text-foreground block">Exclusive Move</span>
                    <span className="text-muted-foreground text-[11px]">
                      Remove user from all other organizations and place exclusively into this target organization.
                      (Uncheck to give multi-organization access).
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowManageOrgModal(false)}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold rounded-lg shadow-2xs"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSavingOrg || !targetOrgId}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingOrg ? 'Saving...' : exclusiveMove ? 'Move Exclusively' : 'Assign to Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Platform Admin */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-foreground">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Assign Platform Super Admin
              </h3>
              <button
                onClick={() => setShowAddAdminModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter the registered email of the user to grant <span className="font-mono text-primary font-semibold">SUPER_ADMIN</span> privileges.
            </p>

            <form onSubmit={handleGrantAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  User Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@tasker.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-input/80 text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold rounded-lg shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdmin}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5"
                >
                  {isSubmittingAdmin ? 'Assigning...' : 'Assign Super Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
