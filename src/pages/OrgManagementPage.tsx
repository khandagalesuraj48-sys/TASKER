import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserPlus, CheckCircle2, Trash2, Building2, MapPin, Check, Plus, SlidersHorizontal } from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import { useToast } from '../context/ToastContext';
import {
  getOrgMembers,
  addOrgMember,
  removeOrgMember,
  getJoinRequests,
  getOrgEmployees,
  getOrgSites,
  createOrgSite,
  setUserSites,
  OrgMemberWithDetails,
  OrgJoinRequestItem,
} from '../services/enterpriseService';
import { ErpEmployee, OrgRole, OrgSite } from '../types/enterprise';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Modal } from '../components/common/Modal';

export const OrgManagementPage: React.FC = () => {
  const { currentOrg, isAdmin, refreshSites } = useEnterprise();
  const { showToast } = useToast();

  const [members, setMembers] = useState<OrgMemberWithDetails[]>([]);
  const [joinRequests, setJoinRequests] = useState<OrgJoinRequestItem[]>([]);
  const [employees, setEmployees] = useState<ErpEmployee[]>([]);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active Management Tab
  const [activeTab, setActiveTab] = useState<'members' | 'sites'>('members');

  // Add Member Modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<OrgRole>('team_member');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [newMemberSiteIds, setNewMemberSiteIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Manage Member Sites Modal
  const [siteModalMember, setSiteModalMember] = useState<OrgMemberWithDetails | null>(null);
  const [tempAssignedSiteIds, setTempAssignedSiteIds] = useState<string[]>([]);
  const [isSavingSites, setIsSavingSites] = useState<boolean>(false);

  // Create Site Modal
  const [createSiteOpen, setCreateSiteOpen] = useState<boolean>(false);
  const [newSiteName, setNewSiteName] = useState<string>('');
  const [newSiteCode, setNewSiteCode] = useState<string>('');
  const [newSiteAddress, setNewSiteAddress] = useState<string>('');
  const [isCreatingSite, setIsCreatingSite] = useState<boolean>(false);

  const loadOrgAdminData = async () => {
    if (!currentOrg?.id) return;
    setIsLoading(true);
    try {
      const [mems, reqs, emps, siteList] = await Promise.all([
        getOrgMembers(currentOrg.id),
        getJoinRequests(currentOrg.id),
        getOrgEmployees(currentOrg.id),
        getOrgSites(currentOrg.id),
      ]);
      setMembers(mems);
      setJoinRequests(reqs);
      setEmployees(emps);
      setSites(siteList);
    } catch (err) {
      console.error('Error loading org management data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrgAdminData();
  }, [currentOrg?.id]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-card rounded-xl border border-border shadow-xs space-y-3">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-foreground">Owner & Admin Privileges Required</h3>
        <p className="text-xs text-muted-foreground">
          Organization Member Management is restricted to the Organization Owner and authorized Administrators.
        </p>
      </div>
    );
  }

  const handleApproveRequest = async (req: OrgJoinRequestItem) => {
    if (!currentOrg?.id) return;
    try {
      await addOrgMember(currentOrg.id, req.user_id, 'team_member');
      showToast(`Approved ${req.user_email} as Organization Member.`, 'success');
      loadOrgAdminData();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve member.', 'error');
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg?.id || !targetUserId.trim()) {
      showToast('User ID or UUID is required.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await addOrgMember(currentOrg.id, targetUserId.trim(), selectedRole, selectedEmpId || undefined);
      
      // If sites were selected, assign them immediately
      if (newMemberSiteIds.length > 0) {
        await setUserSites(targetUserId.trim(), currentOrg.id, newMemberSiteIds);
      }

      showToast('सदस्य यशस्वीरित्या जोडला आणि साईट्स असाइन केल्या.', 'success');
      setAddModalOpen(false);
      setTargetUserId('');
      setSelectedEmpId('');
      setSelectedRole('team_member');
      setNewMemberSiteIds([]);
      loadOrgAdminData();
    } catch (err: any) {
      showToast(err.message || 'Failed to add member.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (membershipId: string, userId: string) => {
    if (!confirm('Are you sure you want to revoke this user\'s organization membership?')) return;
    try {
      await removeOrgMember(membershipId, userId);
      showToast('Member removed from organization.', 'info');
      loadOrgAdminData();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member.', 'error');
    }
  };

  // Open Manage Sites for a specific member
  const handleOpenSiteModal = (member: OrgMemberWithDetails) => {
    setSiteModalMember(member);
    setTempAssignedSiteIds(member.assignedSiteIds || []);
  };

  // Toggle a site selection in the modal
  const handleToggleSite = (siteId: string) => {
    setTempAssignedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  // Save updated site assignments for a member
  const handleSaveMemberSites = async () => {
    if (!siteModalMember || !currentOrg?.id) return;
    setIsSavingSites(true);
    try {
      const ok = await setUserSites(siteModalMember.user_id, currentOrg.id, tempAssignedSiteIds);
      if (ok) {
        showToast('साईट्स यशस्वीरित्या अपडेट केल्या!', 'success');
        setSiteModalMember(null);
        await loadOrgAdminData();
      } else {
        showToast('साईट्स अपडेट करताना त्रुटी आली.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update sites', 'error');
    } finally {
      setIsSavingSites(false);
    }
  };

  // Create a new Site directly in Organization
  const handleCreateSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg?.id || !newSiteName.trim() || !newSiteCode.trim()) {
      showToast('साईट्सचे नाव आणि कोड आवश्यक आहे.', 'error');
      return;
    }
    setIsCreatingSite(true);
    try {
      const created = await createOrgSite(currentOrg.id, newSiteName.trim(), newSiteCode.trim(), newSiteAddress.trim());
      if (created) {
        showToast(`नवीन साईट "${created.name}" तयार केली!`, 'success');
        setCreateSiteOpen(false);
        setNewSiteName('');
        setNewSiteCode('');
        setNewSiteAddress('');
        await refreshSites();
        await loadOrgAdminData();
      } else {
        showToast('साईट तयार करता आली नाही. कोड तपासा.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating site', 'error');
    } finally {
      setIsCreatingSite(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Organization Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mt-1">
            {currentOrg?.legal_name || 'Organization Control'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage organization members, assign site access, and control permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateSiteOpen(true)}
            className="h-8 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Site
          </Button>
          <Button
            size="sm"
            onClick={() => setAddModalOpen(true)}
            className="h-8 text-xs font-semibold"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Segmented Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit border border-border/50">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'members'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Members & Sites ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('sites')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTab === 'sites'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All Sites ({sites.length})
        </button>
      </div>

      {/* Join Requests Queue */}
      {joinRequests.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
          <h2 className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-2">
            <span>Pending Join Requests ({joinRequests.length})</span>
          </h2>
          <div className="space-y-2">
            {joinRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 bg-card rounded-lg border border-border flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-foreground">{req.user_email}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">User ID: {req.user_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleApproveRequest(req)} className="h-7 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Approve Member
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: MEMBERS & THEIR ASSIGNED SITES */}
      {activeTab === 'members' && (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground">
                Organization Members & Site Access ({members.length})
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Members only see tasks for their assigned sites
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 bg-muted rounded-lg"></div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No members found. Click "+ Add Member" to invite team members.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {members.map((m) => {
                  const assignedCount = m.assignedSiteIds?.length || 0;
                  const assignedSiteObjects = sites.filter((s) => m.assignedSiteIds?.includes(s.id));

                  return (
                    <div key={m.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            {m.employee ? `${m.employee.first_name} ${m.employee.last_name || ''}` : (m.email || 'User')}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                            {m.role}
                          </Badge>
                        </div>
                        {m.email && <p className="text-[11px] text-muted-foreground">{m.email}</p>}
                        <p className="text-[10px] text-muted-foreground font-mono">ID: {m.user_id}</p>

                        {/* Site Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-muted-foreground font-medium">Assigned Sites:</span>
                          {assignedCount === 0 ? (
                            <Badge variant="secondary" className="text-[10px]">
                              General (All Tasks Visible)
                            </Badge>
                          ) : (
                            assignedSiteObjects.map((s) => (
                              <Badge
                                key={s.id}
                                variant="success"
                                className="text-[10px] flex items-center gap-1"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                                {s.name} ({s.code})
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSiteModal(m)}
                          className="h-7 text-xs font-semibold"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                          <span>Change Sites</span>
                        </Button>

                        {m.role !== 'org_owner' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.id, m.user_id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: ALL SITES MANAGEMENT */}
      {activeTab === 'sites' && (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Work Sites & Locations ({sites.length})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure project sites (e.g. Site C, Site D, Headquarters)
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setCreateSiteOpen(true)}
                className="h-8 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Site
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sites.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-lg bg-muted/20 border border-border flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-foreground text-sm">{s.name}</span>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">Code: {s.code}</p>
                    {s.address && <p className="text-[11px] text-muted-foreground">{s.address}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] font-medium">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: MANAGE SITES FOR A MEMBER */}
      <Modal
        isOpen={Boolean(siteModalMember)}
        onClose={() => setSiteModalMember(null)}
        title="Assign Member Sites"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-xs font-bold text-foreground">
              {siteModalMember?.employee
                ? `${siteModalMember.employee.first_name} ${siteModalMember.employee.last_name || ''}`
                : (siteModalMember?.email || 'User')}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Select all site locations this member should have access to:
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {sites.map((site) => {
              const isChecked = tempAssignedSiteIds.includes(site.id);
              return (
                <div
                  key={site.id}
                  onClick={() => handleToggleSite(site.id)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                    isChecked
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        isChecked
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border bg-card'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{site.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Code: {site.code}</p>
                    </div>
                  </div>

                  {isChecked && (
                    <Badge variant="default" className="text-[10px]">
                      Assigned
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setTempAssignedSiteIds(tempAssignedSiteIds.length === sites.length ? [] : sites.map((s) => s.id))}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              {tempAssignedSiteIds.length === sites.length ? 'Clear All' : 'Select All'}
            </button>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSiteModalMember(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveMemberSites} disabled={isSavingSites}>
                {isSavingSites ? 'Saving...' : 'Save Sites'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: ADD NEW MEMBER */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Organization Member"
        maxWidth="md"
      >
        <form onSubmit={handleAddMemberSubmit} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              User UUID / Supabase User ID *
            </label>
            <input
              type="text"
              required
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Enter the user's UUID from the User Profile or Supabase Auth.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Role in Organization
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as OrgRole)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground"
            >
              <option value="team_member">Team Member</option>
              <option value="org_manager">Operations Manager</option>
              <option value="org_admin">Administrator</option>
            </select>
          </div>

          {employees.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Link to Employee Profile (Optional)
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground"
              >
                <option value="">-- None --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name || ''} ({emp.designation || 'Team Member'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {sites.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Assign Work Sites (Optional)
              </label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto border border-border rounded-lg p-2 bg-muted/20">
                {sites.map((s) => {
                  const checked = newMemberSiteIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setNewMemberSiteIds((prev) =>
                            prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                          );
                        }}
                        className="rounded border-border"
                      />
                      <span>{s.name} ({s.code})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" type="button" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={isSubmitting || !targetUserId.trim()}>
              {isSubmitting ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: CREATE NEW SITE */}
      <Modal
        isOpen={createSiteOpen}
        onClose={() => setCreateSiteOpen(false)}
        title="Create New Project Site"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSiteSubmit} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Site / Project Name *
            </label>
            <input
              type="text"
              required
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              placeholder="e.g. Site C - Pune Airport Project"
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Site Code *
            </label>
            <input
              type="text"
              required
              value={newSiteCode}
              onChange={(e) => setNewSiteCode(e.target.value.toUpperCase())}
              placeholder="e.g. SITE-C"
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Site Address / Location (Optional)
            </label>
            <input
              type="text"
              value={newSiteAddress}
              onChange={(e) => setNewSiteAddress(e.target.value)}
              placeholder="e.g. Plot 42, MIDC Bhosari, Pune"
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" type="button" onClick={() => setCreateSiteOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={isCreatingSite || !newSiteName.trim() || !newSiteCode.trim()}>
              {isCreatingSite ? 'Creating...' : 'Create Site'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
