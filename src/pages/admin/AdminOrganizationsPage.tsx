import React, { useEffect, useState } from 'react';
import {
  Building2,
  MapPin,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  Trash2,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Organization, OrgSite } from '../../types/enterprise';
import { getOrgSites, createOrgSite } from '../../services/enterpriseService';
import { useToast } from '../../context/ToastContext';

export const AdminOrganizationsPage: React.FC = () => {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    legal_name: '',
    trade_name: '',
    currency: 'INR',
    is_active: true,
  });

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAllOrganizations();
      setOrgs(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organizations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.legal_name.trim()) return;

    setIsSubmitting(true);
    try {
      await adminService.createOrganization(formData);
      showToast(`Organization "${formData.legal_name}" created successfully`, 'success');
      setShowModal(false);
      setFormData({ legal_name: '', trade_name: '', currency: 'INR', is_active: true });
      loadOrgs();
    } catch (err: any) {
      showToast(err.message || 'Failed to create organization', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sites Modal State
  const [selectedOrgForSites, setSelectedOrgForSites] = useState<Organization | null>(null);
  const [orgSites, setOrgSites] = useState<OrgSite[]>([]);
  const [loadingSites, setLoadingSites] = useState<boolean>(false);
  const [showAddSiteForm, setShowAddSiteForm] = useState<boolean>(false);
  const [newSiteName, setNewSiteName] = useState<string>('');
  const [newSiteCode, setNewSiteCode] = useState<string>('');
  const [isCreatingSite, setIsCreatingSite] = useState<boolean>(false);

  const handleOpenSites = async (org: Organization) => {
    setSelectedOrgForSites(org);
    setLoadingSites(true);
    setShowAddSiteForm(false);
    try {
      const sites = await getOrgSites(org.id);
      setOrgSites(sites);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization sites', 'error');
    } finally {
      setLoadingSites(false);
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgForSites || !newSiteName.trim() || !newSiteCode.trim()) return;
    setIsCreatingSite(true);
    try {
      const created = await createOrgSite(selectedOrgForSites.id, newSiteName.trim(), newSiteCode.trim());
      if (created) {
        showToast(`Site "${created.name}" created successfully!`, 'success');
        setNewSiteName('');
        setNewSiteCode('');
        setShowAddSiteForm(false);
        const updated = await getOrgSites(selectedOrgForSites.id);
        setOrgSites(updated);
      } else {
        showToast('Failed to create site', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating site', 'error');
    } finally {
      setIsCreatingSite(false);
    }
  };

  const [selectedOrgForMembers, setSelectedOrgForMembers] = useState<Organization | null>(null);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false);
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);

  const handleOpenMembers = async (org: Organization) => {
    setSelectedOrgForMembers(org);
    setLoadingMembers(true);
    try {
      const members = await adminService.getOrganizationMembers(org.id);
      setOrgMembers(members);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization members', 'error');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleDeleteOrg = async (org: Organization) => {
    const confirmed = confirm(
      `⚠️ PERMANENT DELETION WARNING:\n\nAre you sure you want to permanently delete "${org.legal_name}"?\n\nThis will remove organization memberships and references. This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingOrgId(org.id);
    try {
      await adminService.deleteOrganization(org.id);
      showToast(`Organization "${org.legal_name}" deleted successfully`, 'info');
      loadOrgs();
      if (selectedOrgForMembers?.id === org.id) {
        setSelectedOrgForMembers(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete organization', 'error');
    } finally {
      setDeletingOrgId(null);
    }
  };

  const handleToggleStatus = async (org: Organization) => {
    const nextStatus = !org.is_active;
    try {
      await adminService.toggleOrganizationStatus(org.id, nextStatus);
      showToast(`Organization ${org.legal_name} ${nextStatus ? 'activated' : 'deactivated'}`, 'info');
      loadOrgs();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const filtered = orgs.filter(
    (o) =>
      o.legal_name.toLowerCase().includes(search.toLowerCase()) ||
      (o.trade_name && o.trade_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Organizations Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Create, configure, and monitor enterprise workplace organizations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadOrgs}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Organization</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search organizations by legal name or trade name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>

      {/* Organizations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800/80">
                <th className="pb-3 font-semibold">Legal Name</th>
                <th className="pb-3 font-semibold">Trade Name</th>
                <th className="pb-3 font-semibold">Currency</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Created Date</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((org) => (
                <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs">{org.legal_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{org.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 text-slate-300 font-medium">
                    {org.trade_name || '—'}
                  </td>
                  <td className="py-3.5 text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300">
                      {org.currency || 'INR'}
                    </span>
                  </td>
                  <td className="py-3.5">
                    {org.is_active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500 font-semibold text-[11px]">
                        <XCircle className="w-3.5 h-3.5" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 text-slate-400">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 text-right space-x-2">
                    <button
                      onClick={() => handleOpenSites(org)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20 inline-flex items-center gap-1"
                      title="Manage Organization Sites"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Sites</span>
                    </button>
                    <button
                      onClick={() => handleOpenMembers(org)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20 inline-flex items-center gap-1"
                    >
                      <Users className="w-3 h-3" />
                      <span>Members</span>
                    </button>
                    <button
                      onClick={() => handleToggleStatus(org)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                        org.is_active
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {org.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteOrg(org)}
                      disabled={deletingOrgId === org.id}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20 inline-flex items-center gap-1"
                      title="Delete Organization"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{deletingOrgId === org.id ? 'Deleting...' : 'Delete'}</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No organizations found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Organization Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                Create New Organization
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Legal Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SAMAJ RACHANA CONSTRUCTION LIMITED"
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Trade / Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. SAMAJ RACHANA"
                  value={formData.trade_name}
                  onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Operating Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="INR">INR - Indian Rupee (₹)</option>
                  <option value="USD">USD - US Dollar ($)</option>
                  <option value="EUR">EUR - Euro (€)</option>
                  <option value="AED">AED - UAE Dirham</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="org_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500/40"
                />
                <label htmlFor="org_active" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Activate organization immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  {isSubmitting ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Organization Sites Management Modal */}
      {selectedOrgForSites && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedOrgForSites.legal_name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Organization Work Sites ({orgSites.length})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrgForSites(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold">Active Project Sites</span>
              <button
                onClick={() => setShowAddSiteForm(!showAddSiteForm)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddSiteForm ? 'Cancel' : '+ Add Site'}</span>
              </button>
            </div>

            {showAddSiteForm && (
              <form onSubmit={handleCreateSite} className="p-3 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-white">Create New Work Site</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Site Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Site C, Rachana Site"
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Site Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SITE_C, C"
                      value={newSiteCode}
                      onChange={(e) => setNewSiteCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono uppercase"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isCreatingSite}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    {isCreatingSite ? 'Creating...' : 'Save Site'}
                  </button>
                </div>
              </form>
            )}

            {loadingSites ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-emerald-400" />
                <p className="text-xs">Loading sites...</p>
              </div>
            ) : orgSites.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">No sites created for this organization yet. Click "+ Add Site" above.</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {orgSites.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 bg-slate-800/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-bold text-white">{s.name}</p>
                        <p className="text-slate-400 text-[10px] font-mono">Code: {s.code}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedOrgForSites(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Organization Members Inspection Modal */}
      {selectedOrgForMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedOrgForMembers.legal_name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Organization Members ({orgMembers.length})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrgForMembers(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {loadingMembers ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-indigo-400" />
                <p className="text-xs">Loading members...</p>
              </div>
            ) : orgMembers.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">No members enrolled in this organization yet.</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {orgMembers.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-800/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-mono text-slate-200 text-[11px]">{m.user_id}</p>
                      <p className="text-slate-400 text-[10px]">
                        Joined: {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedOrgForMembers(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
