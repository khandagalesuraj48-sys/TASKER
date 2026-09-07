export type FinancialType = 'bill' | 'obligation' | 'p2p_loan' | 'receivable' | 'payable';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue';
export type PaymentMethod = 'upi' | 'cash' | 'netbanking' | 'cheque' | 'card' | 'other';

export interface FinancialRecord {
  id: string;
  workspace_id: string;
  title: string;
  type: FinancialType;
  amount: number;
  paid_amount: number;
  currency: string;
  due_date: string;
  status: PaymentStatus;
  category?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  notes?: string | null;
  bill_number?: string | null;
  upi_id?: string | null;
  task_id?: string | null;
  reminder_days_before?: number;
  is_recurring?: boolean;
  recurrence_rule?: Record<string, any> | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialPayment {
  id: string;
  record_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
  user_id?: string | null;
  created_at: string;
}
