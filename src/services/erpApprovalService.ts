import { ErpApproval } from '../types/enterprise';
import { OfflineSyncService } from './offlineSyncService';

const DEFAULT_APPROVALS: ErpApproval[] = [
  {
    id: 'appr_01',
    org_id: 'org_enterprise_default',
    project_id: 'prj_mumbai_metro',
    site_id: 'site_worli',
    entity_type: 'purchase_order',
    entity_id: 'po_cement_1000',
    title: 'PO #1042: UltraTech Cement 1000 Bags (Site Worli)',
    amount: 380000,
    assigned_role: 'project_manager',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
  {
    id: 'appr_02',
    org_id: 'org_enterprise_default',
    project_id: 'prj_mumbai_metro',
    site_id: 'site_worli',
    entity_type: 'expense',
    entity_id: 'exp_concrete_test',
    title: 'Lab Cube Testing & Compressive Strength Report',
    amount: 14500,
    assigned_role: 'site_engineer',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
];

export const getErpApprovals = async (
  status: 'pending' | 'approved' | 'rejected' = 'pending',
  orgId: string = 'org_enterprise_default'
): Promise<ErpApproval[]> => {
  const list = await OfflineSyncService.getItems<ErpApproval>(
    'erp_approvals',
    (a) => a.org_id === orgId && (!status || a.status === status)
  );
  if (list.length === 0 && orgId === 'org_enterprise_default') {
    for (const a of DEFAULT_APPROVALS) {
      await OfflineSyncService.saveItem('erp_approvals', a);
    }
    return DEFAULT_APPROVALS.filter((a) => a.status === status);
  }
  return list;
};

export const getPendingApprovals = async (orgId: string = 'org_enterprise_default'): Promise<ErpApproval[]> => {
  return getErpApprovals('pending', orgId);
};

export const actOnApproval = async (
  approvalId: string,
  action: 'approved' | 'rejected',
  remarks?: string
): Promise<ErpApproval | null> => {
  return await OfflineSyncService.updateItem<ErpApproval>('erp_approvals', approvalId, {
    status: action,
    remarks: remarks || null,
    acted_at: new Date().toISOString(),
  });
};
