import React, { useEffect, useState } from 'react';
import {
  Inbox,
  CheckCircle,
  XCircle,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { OrgJoinRequest } from '../../types/admin';
import { useToast } from '../../context/ToastContext';

import { supabase } from '../../lib/supabase';
import { Organization } from '../../types/enterprise';

export const AdminRequestsPage: React.FC = () => {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<OrgJoinRequest[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Approval Modal State
  const [approvingRequest, setApprovingRequest] = useState<OrgJoinRequest | null>(null);
  const [targetOrgId, setTargetOrgId] = useState<string>('');
  const [assignedRole, setAssignedRole] = useState<string>('team_member');

  const loadRequests = async () => {
    setLoading(true);
    try {
      const [data, orgs] = await Promise.all([
        adminService.getAllJoinRequests(),
        adminService.getAllOrganizations(),
      ]);
      setRequests(data);
      setOrganizations(orgs);
    } catch (err: any) {
      showToast(err.message || 'Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();

    // Supabase Realtime for live updates without manual page refresh
    const channel = supabase
      .channel('admin-join-requests-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_join_requests' },
        () => {
          loadRequests();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openApproveModal = (req: OrgJoinRequest) => {
    setApprovingRequest(req);
    // Default to requested org or first active org
    const defaultOrg = organizations.find((o) => o.id === req.org_id) || organizations[0];
    setTargetOrgId(defaultOrg?.id || req.org_id || '');
    setAssignedRole(req.requested_role || 'team_member');
  };

  const handleConfirmApprove = async () => {
    if (!approvingRequest) return;
    setProcessingId(approvingRequest.id);
    try {
      await adminService.approveJoinRequest(approvingRequest.id, assignedRole, targetOrgId);
      const orgName = organizations.find((o) => o.id === targetOrgId)?.legal_name || 'Organization';
      showToast(`Approved ${approvingRequest.user_email} into ${orgName}`, 'success');
      setApprovingRequest(null);
      loadRequests();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: OrgJoinRequest) => {
    const reason = prompt('Enter reason for rejection (optional):');
    if (reason === null) return; // User cancelled prompt

    setProcessingId(req.id);
    try {
      await adminService.rejectJoinRequest(req.id, reason || undefined);
      showToast(`Rejected request for ${req.user_email}`, 'info');
      loadRequests();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Organization Join Requests</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review and authorize user requests to join organization workspaces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRequests}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
              filter === tab
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab} {tab === 'pending' && `(${requests.filter((r) => r.status === 'pending').length})`}
          </button>
        ))}
      </div>

      {/* Requests List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Inbox className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold">No {filter !== 'all' ? filter : ''} requests found</p>
            <p className="text-xs mt-1">When users request to join an organization, they appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((req) => (
              <div
                key={req.id}
                className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 first:pt-0 last:pb-0"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm text-white">{req.user_email}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        req.status === 'pending'
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                          : req.status === 'approved'
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                      <strong className="text-slate-200">
                        {req.organization?.legal_name || 'Organization'}
                      </strong>
                    </span>
                    <span>Role: <strong className="text-slate-200 capitalize">{req.requested_role}</strong></span>
                    <span className="text-slate-500">
                      Applied: {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {req.notes && (
                    <p className="text-xs text-slate-300 italic bg-slate-800/50 p-2 rounded-lg border border-slate-800">
                      "{req.notes}"
                    </p>
                  )}

                  {req.rejection_reason && (
                    <p className="text-xs text-rose-400">
                      Rejection Reason: {req.rejection_reason}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {req.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openApproveModal(req)}
                      disabled={processingId === req.id}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{processingId === req.id ? 'Approving...' : 'Approve'}</span>
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      disabled={processingId === req.id}
                      className="px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-bold rounded-xl border border-rose-600/30 transition-all flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Target Organization & Role Approval Modal */}
      {approvingRequest && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Approve Join Request</h3>
                <p className="text-xs text-slate-400">Choose organization & role for this user</p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3 space-y-1">
              <p className="text-xs text-slate-400">Requesting User:</p>
              <p className="text-sm font-semibold text-white">{approvingRequest.user_email}</p>
              {approvingRequest.notes && (
                <p className="text-xs text-slate-400 italic">"{approvingRequest.notes}"</p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assign to Organization:
                </label>
                <select
                  value={targetOrgId}
                  onChange={(e) => setTargetOrgId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assigned Workplace Role:
                </label>
                <select
                  value={assignedRole}
                  onChange={(e) => setAssignedRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="team_member">Team Member (Can view and update assigned tasks)</option>
                  <option value="project_manager">Project Manager (Can create, assign, and manage team tasks)</option>
                  <option value="org_admin">Organization Admin (Full workplace control)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApprovingRequest(null)}
                disabled={processingId === approvingRequest.id}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={processingId === approvingRequest.id || !targetOrgId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{processingId === approvingRequest.id ? 'Approving...' : 'Confirm Approval'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
