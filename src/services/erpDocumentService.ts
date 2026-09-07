import { ErpDocument } from '../types/enterprise';
import { OfflineSyncService } from './offlineSyncService';

const DEFAULT_DOCUMENTS: ErpDocument[] = [
  {
    id: 'doc_metro_cst_blueprint',
    org_id: 'org_enterprise_default',
    project_id: 'proj_metro_line_3',
    site_id: 'site_mumbai_cst',
    category: 'blueprint',
    title: 'CST Underground Station Structural Layout Rev-3',
    file_name: 'CST_Station_Structural_Layout_Rev3.pdf',
    file_size: 14857600,
    file_type: 'application/pdf',
    file_url: '#',
    uploaded_by: 'Senior Design Consultant (Tata Projects)',
    tags: ['CST', 'Structural', 'Foundation', 'G+2'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'doc_metro_po_ultratech',
    org_id: 'org_enterprise_default',
    project_id: 'proj_metro_line_3',
    site_id: 'site_mumbai_cst',
    category: 'contract',
    title: 'PO #PO-2026-088 - UltraTech Bulk OPC 53 Grade Supply',
    file_name: 'PO_2026_088_UltraTech_Signed.pdf',
    file_size: 2450000,
    file_type: 'application/pdf',
    file_url: '#',
    uploaded_by: 'Procurement Head',
    tags: ['Purchase Order', 'Cement', 'Commercial'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'doc_worli_safety_permit',
    org_id: 'org_enterprise_default',
    project_id: 'proj_metro_line_3',
    site_id: 'site_worli_casting',
    category: 'permit',
    title: 'Heavy Crane Operation Permit - Yard 2',
    file_name: 'Crane_EHS_Permit_Worli_Yard2.pdf',
    file_size: 1200000,
    file_type: 'application/pdf',
    file_url: '#',
    uploaded_by: 'Sunita More (EHS Officer)',
    tags: ['Safety', 'Crane', 'EHS Permit'],
    created_at: new Date().toISOString(),
  },
];

export const getErpDocuments = async (
  category?: string,
  projectId?: string | null,
  siteId?: string | null,
  orgId: string = 'org_enterprise_default'
): Promise<ErpDocument[]> => {
  const docs = await OfflineSyncService.getItems<ErpDocument>(
    'erp_documents',
    (d) =>
      d.org_id === orgId &&
      (!category || d.category === category) &&
      (!projectId || d.project_id === projectId) &&
      (!siteId || d.site_id === siteId)
  );

  if (docs.length === 0 && orgId === 'org_enterprise_default') {
    for (const d of DEFAULT_DOCUMENTS) {
      await OfflineSyncService.saveItem('erp_documents', d);
    }
    return category
      ? DEFAULT_DOCUMENTS.filter((d) => d.category === category)
      : DEFAULT_DOCUMENTS;
  }

  return docs;
};

export const uploadErpDocument = async (
  input: Omit<ErpDocument, 'id' | 'created_at'>
): Promise<ErpDocument> => {
  const doc: ErpDocument = {
    ...input,
    id: 'doc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    created_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('erp_documents', doc);
};

export const deleteErpDocument = async (id: string): Promise<void> => {
  await OfflineSyncService.deleteItem('erp_documents', id);
};
