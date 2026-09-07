export type OrgRole = 
  | 'org_owner' 
  | 'org_admin' 
  | 'project_manager' 
  | 'site_engineer' 
  | 'store_keeper' 
  | 'accountant' 
  | 'department_lead' 
  | 'auditor' 
  | 'viewer';

export interface Organization {
  id: string;
  legal_name: string;
  trade_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  currency: string;
  fiscal_year_start_month: number;
  owner_id: string;
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgProject {
  id: string;
  org_id: string;
  name: string;
  code: string;
  description?: string | null;
  status: 'bidding' | 'active' | 'on_hold' | 'completed' | 'archived';
  budget: number;
  start_date?: string | null;
  target_date?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  sites_count?: number;
}

export interface OrgSite {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  code: string;
  address?: string | null;
  is_warehouse: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgDepartment {
  id: string;
  org_id: string;
  site_id?: string | null;
  name: string;
  code: string;
  head_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMembership {
  id: string;
  user_id: string;
  org_id: string;
  project_id?: string | null;
  site_id?: string | null;
  department_id?: string | null;
  role: OrgRole;
  created_at: string;
}

export interface ChartOfAccount {
  id: string;
  org_id: string;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_id?: string | null;
  is_group: boolean;
  created_at: string;
}

export interface ErpParty {
  id: string;
  org_id: string;
  type: 'customer' | 'vendor' | 'subcontractor' | 'both';
  legal_name: string;
  trade_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  credit_limit: number;
  credit_days: number;
  balance_amount?: number;
  created_at: string;
}

export interface ErpItem {
  id: string;
  org_id: string;
  sku: string;
  name: string;
  hsn_sac?: string | null;
  uom: string;
  category?: string | null;
  standard_rate: number;
  created_at: string;
}

export interface InventoryStock {
  id: string;
  org_id: string;
  site_id: string;
  item_id: string;
  item_name?: string;
  sku?: string;
  uom?: string;
  quantity_on_hand: number;
  valuation_rate: number;
  updated_at: string;
}

export interface GatePassItem {
  item_id: string;
  item_name: string;
  qty: number;
  uom: string;
}

export interface GatePass {
  id: string;
  org_id: string;
  project_id: string;
  site_id: string;
  type: 'inward' | 'outward';
  pass_number: string;
  party_id?: string | null;
  party_name?: string | null;
  vehicle_number?: string | null;
  transporter_name?: string | null;
  challan_number?: string | null;
  challan_date?: string | null;
  items: GatePassItem[];
  status: 'draft' | 'verified' | 'rejected';
  received_by?: string | null;
  created_at: string;
}

export interface ErpInvoice {
  id: string;
  org_id: string;
  project_id: string;
  site_id?: string | null;
  type: 'purchase' | 'sales';
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  party_id: string;
  party_name?: string;
  total_amount: number;
  paid_amount: number;
  tax_amount: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue';
  items: Array<{ item_name: string; qty: number; rate: number; amount: number }>;
  created_at: string;
  updated_at: string;
}

export interface ErpPayment {
  id: string;
  org_id: string;
  project_id?: string | null;
  site_id?: string | null;
  payment_type: 'payment' | 'receipt';
  payment_number: string;
  party_id?: string | null;
  party_name?: string;
  invoice_id?: string | null;
  amount: number;
  payment_date: string;
  mode: 'upi' | 'neft' | 'rtgs' | 'cheque' | 'cash';
  reference_number?: string | null;
  created_at: string;
}

export interface GLEntry {
  id: string;
  org_id: string;
  project_id?: string | null;
  site_id?: string | null;
  department_id?: string | null;
  voucher_type: string;
  voucher_id: string;
  voucher_number: string;
  posting_date: string;
  account_id: string;
  account_name?: string;
  party_id?: string | null;
  debit: number;
  credit: number;
  narration?: string | null;
  created_at: string;
}

export interface ErpApproval {
  id: string;
  org_id: string;
  project_id: string;
  site_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  amount?: number | null;
  assigned_role: string;
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string | null;
  acted_by?: string | null;
  acted_at?: string | null;
  created_at: string;
}

export interface ErpEmployee {
  id: string;
  org_id: string;
  user_id?: string | null;
  project_id?: string | null;
  site_id?: string | null;
  department_id?: string | null;
  first_name: string;
  last_name: string;
  employee_code: string;
  designation: string;
  phone?: string | null;
  email?: string | null;
  salary?: number | null;
  daily_wage?: number | null;
  status: 'active' | 'on_leave' | 'resigned';
  created_at: string;
}

export interface ErpAttendance {
  id: string;
  org_id: string;
  project_id: string;
  site_id: string;
  employee_id: string;
  employee_name?: string;
  date: string;
  status: 'present' | 'absent' | 'half_day' | 'overtime';
  overtime_hours?: number;
  remarks?: string | null;
  created_at: string;
}

export interface ErpExpense {
  id: string;
  org_id: string;
  project_id: string;
  site_id: string;
  department_id?: string | null;
  expense_number: string;
  category: string;
  amount: number;
  payment_mode: 'cash' | 'upi' | 'bank_transfer';
  paid_to: string;
  date: string;
  notes?: string | null;
  status: 'pending' | 'approved' | 'paid';
  created_at: string;
}

export interface ErpDocument {
  id: string;
  org_id: string;
  project_id?: string | null;
  site_id?: string | null;
  category: 'blueprint' | 'contract' | 'permit' | 'compliance' | 'invoice' | 'report' | 'general';
  title: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
  file_url: string;
  uploaded_by?: string;
  tags: string[];
  created_at: string;
}

export interface ErpPurchaseOrder {
  id: string;
  org_id: string;
  project_id: string;
  site_id: string;
  po_number: string;
  vendor_id: string;
  vendor_name: string;
  order_date: string;
  expected_delivery_date?: string | null;
  total_amount: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'partially_received' | 'received' | 'cancelled';
  items: Array<{ item_id: string; item_name: string; qty: number; rate: number; amount: number }>;
  created_at: string;
}

