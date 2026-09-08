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
import { Button } from '../components/common/Button';
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
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Owner & Admin Privileges Required</h3>
        <p className="text-xs text-slate-500">
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
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Organization Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {currentOrg?.legal_name || 'Organization Control'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            सदस्य, साईट्स असाइनमेंट आणि परवानग्या ॲपमधून थेट नियंत्रित करा
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateSiteOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + नवीन साईट
          </Button>
          <Button
            size="sm"
            onClick={() => setAddModalOpen(true)}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            + सदस्य जोडा
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'members'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          सदस्य व साईट्स ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('sites')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'sites'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          सर्व साईट्स यादी ({sites.length})
        </button>
      </div>

      {/* Join Requests Queue */}
      {joinRequests.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-3">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <span>प्रलंबित जॉइन विनंत्या ({joinRequests.length})</span>
          </h2>
          <div className="space-y-2">
            {joinRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{req.user_email}</p>
                  <p className="text-[11px] text-slate-400">User ID: {req.user_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleApproveRequest(req)} leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                    मंजूर करा (Approve)
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: MEMBERS & THEIR ASSIGNED SITES */}
      {activeTab === 'members' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              संस्थेतील सदस्य व त्यांचे साईट ॲक्सेस ({members.length})
            </h2>
            <span className="text-[11px] text-slate-500">
              ज्या साईटवर टिक असेल, फक्त त्याचेच टास्क त्या सदस्याला दिसतात
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              अद्याप कोणतेही सदस्य जोडलेले नाहीत. "+ सदस्य जोडा" वर क्लिक करा.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => {
                const assignedCount = m.assignedSiteIds?.length || 0;
                const assignedSiteObjects = sites.filter((s) => m.assignedSiteIds?.includes(s.id));

                return (
                  <div key={m.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {m.employee ? `${m.employee.first_name} ${m.employee.last_name || ''}` : (m.email || 'User')}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {m.role}
                        </span>
                      </div>
                      {m.email && <p className="text-[11px] text-slate-500 font-medium">{m.email}</p>}
                      <p className="text-[10px] text-slate-400 font-mono">ID: {m.user_id}</p>

                      {/* Site Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 font-semibold">असाइन साईट्स:</span>
                        {assignedCount === 0 ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            सर्वसाधारण (सर्व टास्क दिसतील)
                          </span>
                        ) : (
                          assignedSiteObjects.map((s) => (
                            <span
                              key={s.id}
                              className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                            >
                              <MapPin className="w-2.5 h-2.5" />
                              {s.name} ({s.code})
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenSiteModal(m)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800/80"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>साईट्स बदला</span>
                      </button>

                      {m.role !== 'org_owner' && (
                        <button
                          onClick={() => handleRemoveMember(m.id, m.user_id)}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="सदस्य काढा"
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
        </div>
      )}

      {/* TAB 2: ALL SITES MANAGEMENT */}
      {activeTab === 'sites' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                उपलब्ध कार्य साईट्स ({sites.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                नवीन प्रोजेक्ट किंवा साईट (उदा. Site C, Site D, Rachana) तयार करा
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setCreateSiteOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              + नवीन साईट जोडा
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sites.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{s.name}</span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-500">कोड: {s.code}</p>
                  {s.address && <p className="text-[11px] text-slate-400">{s.address}</p>}
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                  Active Site
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: MANAGE SITES FOR A MEMBER */}
      <Modal
        isOpen={Boolean(siteModalMember)}
        onClose={() => setSiteModalMember(null)}
        title="सदस्याच्या साईट्स असाइन करा"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/60">
            <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
              {siteModalMember?.employee
                ? `${siteModalMember.employee.first_name} ${siteModalMember.employee.last_name || ''}`
                : (siteModalMember?.email || 'User')}
            </p>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
              या सदस्याला ज्या साईटचे टास्क दाखवायचे आहेत, त्या सर्व साईट्सवर खाली टिक (✓) करा:
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {sites.map((site) => {
              const isChecked = tempAssignedSiteIds.includes(site.id);
              return (
                <div
                  key={site.id}
                  onClick={() => handleToggleSite(site.id)}
                  className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    isChecked
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 dark:border-indigo-500'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                        isChecked
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{site.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">कोड: {site.code}</p>
                    </div>
                  </div>

                  {isChecked && (
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                      असाइन केले
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTempAssignedSiteIds(tempAssignedSiteIds.length === sites.length ? [] : sites.map((s) => s.id))}
              className="text-[11px] font-bold text-indigo-600 hover:underline"
            >
              {tempAssignedSiteIds.length === sites.length ? 'सर्व काढा (Clear All)' : 'सर्व निवडा (Select All)'}
            </button>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSiteModalMember(null)}>
                रद्द करा
              </Button>
              <Button size="sm" onClick={handleSaveMemberSites} isLoading={isSavingSites}>
                सेव्ह करा
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: ADD NEW SITE */}
      <Modal isOpen={createSiteOpen} onClose={() => setCreateSiteOpen(false)} title="नवीन साईट तयार करा">
        <form onSubmit={handleCreateSiteSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              साईट्सचे नाव (Site Name) *
            </label>
            <input
              type="text"
              required
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              placeholder="उदा. VTR Site, 18 B Site, Rachana Site, Site C"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              साईट्सचा शॉर्ट कोड (Site Code) *
            </label>
            <input
              type="text"
              required
              value={newSiteCode}
              onChange={(e) => setNewSiteCode(e.target.value.toUpperCase())}
              placeholder="उदा. VTR, 18_B, SITE_C, C"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              पत्ता किंवा लोकेशन (ऐच्छिक)
            </label>
            <input
              type="text"
              value={newSiteAddress}
              onChange={(e) => setNewSiteAddress(e.target.value)}
              placeholder="उदा. प्लॉट नं 12, पुणे"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateSiteOpen(false)}>
              रद्द करा
            </Button>
            <Button type="submit" size="sm" isLoading={isCreatingSite}>
              साईट तयार करा
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: ADD MEMBER WITH SITES */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="नवीन सदस्य जोडा">
        <form onSubmit={handleAddMemberSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              सदस्याचा User ID किंवा Email / UUID *
            </label>
            <input
              type="text"
              required
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="उदा. 43e701a5-1832-48f3-84d8-d775422ea82f किंवा User ID"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono"
            />
            {employees.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-slate-400">नोंदणीकृत कर्मचारी:</span>
                {employees.filter((e) => e.user_id).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setTargetUserId(e.user_id || '');
                      setSelectedEmpId(e.id);
                    }}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-[10px] font-bold text-slate-700 dark:text-slate-300"
                  >
                    {e.first_name} ({e.email || e.designation})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              भूमिका (Role) *
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as OrgRole)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
            >
              <option value="team_member">Team Member</option>
              <option value="project_manager">Project Manager</option>
              <option value="org_admin">Organization Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              या सदस्याला सुरुवातीला कोणत्या साईट्स द्यायच्या आहेत? (Checkboxes)
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {sites.map((site) => {
                const isChecked = newMemberSiteIds.includes(site.id);
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() =>
                      setNewMemberSiteIds((prev) =>
                        prev.includes(site.id) ? prev.filter((id) => id !== site.id) : [...prev, site.id]
                      )
                    }
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                      isChecked
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>{site.name}</span>
                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                      isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                    }`}>
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>
              रद्द करा
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              सदस्य जोडा
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
