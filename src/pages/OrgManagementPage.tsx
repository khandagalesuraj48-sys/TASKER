import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserPlus, CheckCircle2, Trash2, Building2 } from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import { useToast } from '../context/ToastContext';
import {
  getOrgMembers,
  addOrgMember,
  removeOrgMember,
  getJoinRequests,
  getOrgEmployees,
  OrgMemberWithDetails,
  OrgJoinRequestItem,
} from '../services/enterpriseService';
import { ErpEmployee, OrgRole } from '../types/enterprise';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

export const OrgManagementPage: React.FC = () => {
  const { currentOrg, isAdmin } = useEnterprise();
  const { showToast } = useToast();

  const [members, setMembers] = useState<OrgMemberWithDetails[]>([]);
  const [joinRequests, setJoinRequests] = useState<OrgJoinRequestItem[]>([]);
  const [employees, setEmployees] = useState<ErpEmployee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Add Member Modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<OrgRole>('team_member');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadOrgAdminData = async () => {
    if (!currentOrg?.id) return;
    setIsLoading(true);
    try {
      const [mems, reqs, emps] = await Promise.all([
        getOrgMembers(currentOrg.id),
        getJoinRequests(currentOrg.id),
        getOrgEmployees(currentOrg.id),
      ]);
      setMembers(mems);
      setJoinRequests(reqs);
      setEmployees(emps);
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
      showToast('User ID / UUID is required.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await addOrgMember(currentOrg.id, targetUserId.trim(), selectedRole, selectedEmpId || undefined);
      showToast('Member successfully added.', 'success');
      setAddModalOpen(false);
      setTargetUserId('');
      setSelectedEmpId('');
      setSelectedRole('team_member');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Organization Administration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            Organization Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {currentOrg?.legal_name} — Member Access Control & Join Requests
          </p>
        </div>

        <Button
          onClick={() => setAddModalOpen(true)}
          leftIcon={<UserPlus className="w-4 h-4" />}
        >
          + Add Member Directly
        </Button>
      </div>

      {/* Join Requests Queue */}
      {joinRequests.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-3">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <span>Pending Join Requests ({joinRequests.length})</span>
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
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Members List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Approved Organization Members ({members.length})
        </h2>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {m.employee ? `${m.employee.first_name} ${m.employee.last_name || ''}` : 'User Account'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      {m.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">User ID: {m.user_id}</p>
                </div>

                {m.role !== 'org_owner' && (
                  <button
                    onClick={() => handleRemoveMember(m.id, m.user_id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Remove Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Organization Member">
        <form onSubmit={handleAddMemberSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              User UUID / Supabase Auth ID *
            </label>
            <input
              type="text"
              required
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Role in Organization *
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
              Link with Employee Directory Record (Optional)
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
            >
              <option value="">-- Do Not Link --</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name || ''} ({e.designation})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Add Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
