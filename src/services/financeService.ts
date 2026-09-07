import { FinancialRecord, FinancialPayment } from '../types/finance';
import { OfflineSyncService } from './offlineSyncService';
import { supabase } from '../lib/supabase';

export const getFinancialRecords = async (workspaceId: string): Promise<FinancialRecord[]> => {
  return await OfflineSyncService.getItems<FinancialRecord>(
    'financial_records',
    (r) => r.workspace_id === workspaceId
  );
};

export const createFinancialRecord = async (
  record: Omit<FinancialRecord, 'id' | 'paid_amount' | 'created_at' | 'updated_at'>
): Promise<FinancialRecord> => {
  const { data: userData } = await supabase.auth.getUser();
  const newRecord: FinancialRecord = {
    ...record,
    id: 'fin_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    paid_amount: 0,
    user_id: userData?.user?.id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('financial_records', newRecord);
};

export const updateFinancialRecord = async (
  id: string,
  patch: Partial<FinancialRecord>
): Promise<FinancialRecord | null> => {
  return await OfflineSyncService.updateItem<FinancialRecord>('financial_records', id, patch);
};

export const deleteFinancialRecord = async (id: string): Promise<boolean> => {
  return await OfflineSyncService.deleteItem<FinancialRecord>('financial_records', id);
};

export const recordPayment = async (
  recordId: string,
  payment: { amount: number; method: FinancialPayment['payment_method']; notes?: string; reference?: string }
): Promise<FinancialPayment> => {
  const newPayment: FinancialPayment = {
    id: 'pay_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    record_id: recordId,
    amount: payment.amount,
    payment_date: new Date().toISOString(),
    payment_method: payment.method,
    reference_number: payment.reference || null,
    notes: payment.notes || null,
    created_at: new Date().toISOString(),
  };

  await OfflineSyncService.saveItem('financial_payments', newPayment);

  // Update record paid amount & status
  const records = await OfflineSyncService.getItems<FinancialRecord>('financial_records');
  const record = records.find((r) => r.id === recordId);
  if (record) {
    const newPaid = Number(record.paid_amount || 0) + Number(payment.amount);
    const newStatus = newPaid >= record.amount ? 'paid' : newPaid > 0 ? 'partially_paid' : record.status;
    await updateFinancialRecord(recordId, {
      paid_amount: newPaid,
      status: newStatus,
    });
  }

  return newPayment;
};

export const generateUpiUrl = (params: {
  upiId: string;
  name: string;
  amount: number;
  note?: string;
}): string => {
  const encodedName = encodeURIComponent(params.name);
  const encodedNote = encodeURIComponent(params.note || 'TASKER Payment');
  return `upi://pay?pa=${params.upiId}&pn=${encodedName}&am=${params.amount.toFixed(2)}&cu=INR&tn=${encodedNote}`;
};
