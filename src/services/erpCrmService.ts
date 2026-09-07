import { ErpParty } from '../types/enterprise';
import { OfflineSyncService } from './offlineSyncService';

const DEFAULT_PARTIES: ErpParty[] = [
  {
    id: 'party_ultratech',
    org_id: 'org_enterprise_default',
    type: 'vendor',
    legal_name: 'UltraTech Cement Limited',
    trade_name: 'UltraTech',
    gstin: '27AAACU9876E1Z2',
    pan: 'AAACU9876E',
    contact_person: 'Anil Deshmukh (Regional Sales)',
    phone: '9820011223',
    email: 'sales.mumbai@ultratech.com',
    billing_address: 'Ahura Centre, Mahakali Caves Road, Andheri East, Mumbai',
    credit_limit: 5000000,
    credit_days: 45,
    balance_amount: 1450000,
    created_at: new Date().toISOString(),
  },
  {
    id: 'party_mmrda',
    org_id: 'org_enterprise_default',
    type: 'customer',
    legal_name: 'Mumbai Metropolitan Region Development Authority',
    trade_name: 'MMRDA',
    gstin: '27AAAGM0011F1Z1',
    contact_person: 'Executive Engineer (Metro Works)',
    phone: '022-26594000',
    billing_address: 'Bandra-Kurla Complex, Bandra East, Mumbai',
    credit_limit: 100000000,
    credit_days: 60,
    balance_amount: 8200000,
    created_at: new Date().toISOString(),
  },
];

export const getErpParties = async (
  type?: 'customer' | 'vendor' | 'subcontractor',
  orgId: string = 'org_enterprise_default'
): Promise<ErpParty[]> => {
  const parties = await OfflineSyncService.getItems<ErpParty>(
    'erp_parties',
    (p) => p.org_id === orgId && (!type || p.type === type || p.type === 'both')
  );
  if (parties.length === 0 && orgId === 'org_enterprise_default') {
    for (const p of DEFAULT_PARTIES) {
      await OfflineSyncService.saveItem('erp_parties', p);
    }
    return type ? DEFAULT_PARTIES.filter((p) => p.type === type || p.type === 'both') : DEFAULT_PARTIES;
  }
  return parties;
};

export const createErpParty = async (input: Omit<ErpParty, 'id' | 'created_at'>): Promise<ErpParty> => {
  const party: ErpParty = {
    ...input,
    id: 'pty_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    balance_amount: input.balance_amount || 0,
    created_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('erp_parties', party);
};
