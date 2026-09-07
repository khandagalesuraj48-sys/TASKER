import { ErpInvoice, GLEntry } from '../types/enterprise';
import { OfflineSyncService } from './offlineSyncService';

export const getErpInvoices = async (
  type?: 'purchase' | 'sales',
  projectId?: string | null,
  orgId: string = 'org_enterprise_default'
): Promise<ErpInvoice[]> => {
  return await OfflineSyncService.getItems<ErpInvoice>(
    'erp_invoices',
    (inv) => inv.org_id === orgId && (!type || inv.type === type) && (!projectId || inv.project_id === projectId)
  );
};

export const createErpInvoice = async (input: Omit<ErpInvoice, 'id' | 'paid_amount' | 'created_at' | 'updated_at'>): Promise<ErpInvoice> => {
  const invoice: ErpInvoice = {
    ...input,
    id: 'inv_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    paid_amount: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await OfflineSyncService.saveItem('erp_invoices', invoice);

  // Post Double-Entry to General Ledger (GL)
  const glDebitAccount = invoice.type === 'purchase' ? 'Project Material Expense' : 'Sundry Debtors';
  const glCreditAccount = invoice.type === 'purchase' ? 'Sundry Creditors' : 'Project Sales Revenue';

  await postGlEntry({
    org_id: invoice.org_id,
    project_id: invoice.project_id,
    voucher_type: invoice.type + '_invoice',
    voucher_id: invoice.id,
    voucher_number: invoice.invoice_number,
    posting_date: invoice.invoice_date,
    account_id: 'acc_' + glDebitAccount.toLowerCase().replace(/\s+/g, '_'),
    account_name: glDebitAccount,
    party_id: invoice.party_id,
    debit: invoice.total_amount,
    credit: 0,
    narration: `Invoice ${invoice.invoice_number} posted to ${glDebitAccount}`,
  });

  await postGlEntry({
    org_id: invoice.org_id,
    project_id: invoice.project_id,
    voucher_type: invoice.type + '_invoice',
    voucher_id: invoice.id,
    voucher_number: invoice.invoice_number,
    posting_date: invoice.invoice_date,
    account_id: 'acc_' + glCreditAccount.toLowerCase().replace(/\s+/g, '_'),
    account_name: glCreditAccount,
    party_id: invoice.party_id,
    debit: 0,
    credit: invoice.total_amount,
    narration: `Invoice ${invoice.invoice_number} credited to ${glCreditAccount}`,
  });

  return invoice;
};

export const postGlEntry = async (entry: Omit<GLEntry, 'id' | 'created_at'>): Promise<GLEntry> => {
  const gl: GLEntry = {
    ...entry,
    id: 'gl_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    created_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('gl_entries', gl);
};

export const getGlEntries = async (projectId?: string | null, orgId: string = 'org_enterprise_default'): Promise<GLEntry[]> => {
  return await OfflineSyncService.getItems<GLEntry>(
    'gl_entries',
    (gl) => gl.org_id === orgId && (!projectId || gl.project_id === projectId)
  );
};

export const getErpPayments = async (
  orgId: string = 'org_enterprise_default',
  projectId?: string | null
): Promise<import('../types/enterprise').ErpPayment[]> => {
  return await OfflineSyncService.getItems<import('../types/enterprise').ErpPayment>(
    'erp_payments',
    (p) => p.org_id === orgId && (!projectId || p.project_id === projectId)
  );
};

export const recordErpPayment = async (
  input: Omit<import('../types/enterprise').ErpPayment, 'id' | 'created_at'>
): Promise<import('../types/enterprise').ErpPayment> => {
  const payment: import('../types/enterprise').ErpPayment = {
    ...input,
    id: 'pay_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    created_at: new Date().toISOString(),
  };

  await OfflineSyncService.saveItem('erp_payments', payment);

  // If tied to an invoice, update invoice paid amount
  if (payment.invoice_id) {
    const invoices = await getErpInvoices(undefined, undefined, payment.org_id);
    const targetInv = invoices.find((inv) => inv.id === payment.invoice_id);
    if (targetInv) {
      const updatedPaid = (targetInv.paid_amount || 0) + payment.amount;
      const updatedStatus = updatedPaid >= targetInv.total_amount ? 'paid' : 'partially_paid';
      await OfflineSyncService.saveItem('erp_invoices', {
        ...targetInv,
        paid_amount: updatedPaid,
        status: updatedStatus,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Post Double-Entry to GL
  const isReceipt = payment.payment_type === 'receipt';
  const debitAcc = isReceipt ? 'Cash and Bank' : 'Sundry Creditors';
  const creditAcc = isReceipt ? 'Sundry Debtors' : 'Cash and Bank';

  await postGlEntry({
    org_id: payment.org_id,
    project_id: payment.project_id,
    voucher_type: payment.payment_type,
    voucher_id: payment.id,
    voucher_number: payment.payment_number,
    posting_date: payment.payment_date,
    account_id: 'acc_' + debitAcc.toLowerCase().replace(/\s+/g, '_'),
    account_name: debitAcc,
    party_id: payment.party_id,
    debit: payment.amount,
    credit: 0,
    narration: `${isReceipt ? 'Receipt from' : 'Payment to'} ${payment.party_name || 'Party'} via ${payment.mode.toUpperCase()}`,
  });

  await postGlEntry({
    org_id: payment.org_id,
    project_id: payment.project_id,
    voucher_type: payment.payment_type,
    voucher_id: payment.id,
    voucher_number: payment.payment_number,
    posting_date: payment.payment_date,
    account_id: 'acc_' + creditAcc.toLowerCase().replace(/\s+/g, '_'),
    account_name: creditAcc,
    party_id: payment.party_id,
    debit: 0,
    credit: payment.amount,
    narration: `${isReceipt ? 'Receipt from' : 'Payment to'} ${payment.party_name || 'Party'} via ${payment.mode.toUpperCase()}`,
  });

  return payment;
};

export const getErpExpenses = async (
  orgId: string = 'org_enterprise_default',
  projectId?: string | null,
  siteId?: string | null
): Promise<import('../types/enterprise').ErpExpense[]> => {
  return await OfflineSyncService.getItems<import('../types/enterprise').ErpExpense>(
    'erp_expenses',
    (exp) =>
      exp.org_id === orgId &&
      (!projectId || exp.project_id === projectId) &&
      (!siteId || exp.site_id === siteId)
  );
};

export const recordErpExpense = async (
  input: Omit<import('../types/enterprise').ErpExpense, 'id' | 'created_at'>
): Promise<import('../types/enterprise').ErpExpense> => {
  const expense: import('../types/enterprise').ErpExpense = {
    ...input,
    id: 'exp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    created_at: new Date().toISOString(),
  };

  await OfflineSyncService.saveItem('erp_expenses', expense);

  // Post Double-Entry to GL
  await postGlEntry({
    org_id: expense.org_id,
    project_id: expense.project_id,
    site_id: expense.site_id,
    voucher_type: 'site_expense',
    voucher_id: expense.id,
    voucher_number: expense.expense_number,
    posting_date: expense.date,
    account_id: 'acc_site_operations_' + expense.category.toLowerCase().replace(/\s+/g, '_'),
    account_name: `Site Expense (${expense.category})`,
    debit: expense.amount,
    credit: 0,
    narration: `Expense: ${expense.category} - Paid to ${expense.paid_to} (${expense.notes || ''})`,
  });

  await postGlEntry({
    org_id: expense.org_id,
    project_id: expense.project_id,
    site_id: expense.site_id,
    voucher_type: 'site_expense',
    voucher_id: expense.id,
    voucher_number: expense.expense_number,
    posting_date: expense.date,
    account_id: 'acc_cash_and_bank',
    account_name: 'Cash and Bank',
    debit: 0,
    credit: expense.amount,
    narration: `Payment for ${expense.category} to ${expense.paid_to}`,
  });

  return expense;
};

