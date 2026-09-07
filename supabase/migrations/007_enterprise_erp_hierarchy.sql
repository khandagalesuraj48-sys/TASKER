-- =====================================================================
-- Migration 007: Enterprise Multi-Project, Multi-Site, Multi-Department ERP
-- TASKER Enterprise Operating System
-- =====================================================================

-- 1. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    currency VARCHAR(3) DEFAULT 'INR',
    fiscal_year_start_month INT DEFAULT 4,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_id);

-- 2. PROJECTS (ENTERPRISE)
CREATE TABLE IF NOT EXISTS public.org_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code VARCHAR(32) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('bidding', 'active', 'on_hold', 'completed', 'archived')),
    budget NUMERIC(15, 2) DEFAULT 0,
    start_date DATE,
    target_date DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_projects_org ON public.org_projects(org_id);

-- 3. SITES (PHYSICAL LOCATIONS, BRANCHES, WAREHOUSES)
CREATE TABLE IF NOT EXISTS public.org_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.org_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code VARCHAR(32) NOT NULL,
    address TEXT,
    is_warehouse BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_sites_project ON public.org_sites(project_id);
CREATE INDEX IF NOT EXISTS idx_org_sites_org ON public.org_sites(org_id);

-- 4. DEPARTMENTS
CREATE TABLE IF NOT EXISTS public.org_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    site_id UUID REFERENCES public.org_sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code VARCHAR(32) NOT NULL,
    head_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_departments_site ON public.org_departments(site_id);
CREATE INDEX IF NOT EXISTS idx_org_departments_org ON public.org_departments(org_id);

-- 5. MEMBERSHIPS & GRANULAR RBAC
CREATE TABLE IF NOT EXISTS public.org_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.org_projects(id) ON DELETE CASCADE,
    site_id UUID REFERENCES public.org_sites(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.org_departments(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL CHECK (role IN (
        'org_owner', 'org_admin', 'project_manager', 
        'site_engineer', 'store_keeper', 'accountant', 
        'department_lead', 'auditor', 'viewer'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.org_memberships(org_id);

-- 6. CHART OF ACCOUNTS
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_code VARCHAR(32) NOT NULL,
    account_name TEXT NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_id UUID REFERENCES public.chart_of_accounts(id),
    is_group BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_coa_org ON public.chart_of_accounts(org_id);

-- 7. PARTIES (CUSTOMERS, VENDORS, SUBCONTRACTORS)
CREATE TABLE IF NOT EXISTS public.erp_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type VARCHAR(16) NOT NULL CHECK (type IN ('customer', 'vendor', 'subcontractor', 'both')),
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    contact_person TEXT,
    email TEXT,
    phone VARCHAR(20),
    billing_address TEXT,
    shipping_address TEXT,
    credit_limit NUMERIC(15, 2) DEFAULT 0,
    credit_days INT DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parties_org ON public.erp_parties(org_id);

-- 8. ERP ITEMS / SKUs
CREATE TABLE IF NOT EXISTS public.erp_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    name TEXT NOT NULL,
    hsn_sac VARCHAR(16),
    uom VARCHAR(16) NOT NULL DEFAULT 'Nos',
    category VARCHAR(64),
    standard_rate NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(org_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_erp_items_org ON public.erp_items(org_id);

-- 9. INVENTORY STOCK BALANCES (PER SITE)
CREATE TABLE IF NOT EXISTS public.inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.org_sites(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.erp_items(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(15, 3) DEFAULT 0,
    valuation_rate NUMERIC(15, 2) DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(site_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_site ON public.inventory_stock(site_id);

-- 10. GATE PASSES (INWARD / OUTWARD)
CREATE TABLE IF NOT EXISTS public.gate_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.org_projects(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.org_sites(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('inward', 'outward')),
    pass_number VARCHAR(64) NOT NULL,
    party_id UUID REFERENCES public.erp_parties(id),
    vehicle_number VARCHAR(20),
    transporter_name TEXT,
    challan_number TEXT,
    challan_date DATE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    received_by UUID REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'verified' CHECK (status IN ('draft', 'verified', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gate_passes_site ON public.gate_passes(site_id);

-- 11. GENERAL LEDGER ENTRIES (IMMUTABLE BOOK)
CREATE TABLE IF NOT EXISTS public.gl_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.org_projects(id) ON DELETE SET NULL,
    site_id UUID REFERENCES public.org_sites(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.org_departments(id) ON DELETE SET NULL,
    voucher_type VARCHAR(32) NOT NULL,
    voucher_id UUID NOT NULL,
    voucher_number VARCHAR(64) NOT NULL,
    posting_date DATE NOT NULL,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
    party_id UUID REFERENCES public.erp_parties(id) ON DELETE SET NULL,
    debit NUMERIC(15, 2) DEFAULT 0,
    credit NUMERIC(15, 2) DEFAULT 0,
    narration TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gl_entries_org ON public.gl_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_gl_entries_project ON public.gl_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_gl_entries_site ON public.gl_entries(site_id);

-- 12. ERP INVOICES (PURCHASE & SALES)
CREATE TABLE IF NOT EXISTS public.erp_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.org_projects(id) ON DELETE CASCADE,
    site_id UUID REFERENCES public.org_sites(id) ON DELETE SET NULL,
    type VARCHAR(16) NOT NULL CHECK (type IN ('purchase', 'sales')),
    invoice_number VARCHAR(64) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    party_id UUID NOT NULL REFERENCES public.erp_parties(id) ON DELETE CASCADE,
    total_amount NUMERIC(15, 2) NOT NULL,
    paid_amount NUMERIC(15, 2) DEFAULT 0,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'overdue')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_invoices_org ON public.erp_invoices(org_id);

-- 13. ERP PAYMENTS & RECEIPTS
CREATE TABLE IF NOT EXISTS public.erp_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.org_projects(id) ON DELETE SET NULL,
    site_id UUID REFERENCES public.org_sites(id) ON DELETE SET NULL,
    payment_type VARCHAR(16) NOT NULL CHECK (payment_type IN ('payment', 'receipt')),
    payment_number VARCHAR(64) NOT NULL,
    party_id UUID REFERENCES public.erp_parties(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.erp_invoices(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    mode VARCHAR(16) NOT NULL CHECK (mode IN ('upi', 'neft', 'rtgs', 'cheque', 'cash')),
    reference_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. APPROVALS WORKFLOW
CREATE TABLE IF NOT EXISTS public.erp_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.org_projects(id) ON DELETE CASCADE,
    site_id UUID REFERENCES public.org_sites(id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC(15, 2),
    assigned_role VARCHAR(32) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    remarks TEXT,
    acted_by UUID REFERENCES auth.users(id),
    acted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_approvals_org ON public.erp_approvals(org_id);

-- 15. HR / EMPLOYEES
CREATE TABLE IF NOT EXISTS public.erp_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.org_projects(id) ON DELETE SET NULL,
    site_id UUID REFERENCES public.org_sites(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.org_departments(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    employee_code VARCHAR(32) NOT NULL,
    designation TEXT NOT NULL,
    phone VARCHAR(20),
    email TEXT,
    salary NUMERIC(12, 2),
    status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'resigned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. POLYMORPHIC ENTERPRISE DOCUMENTS
CREATE TABLE IF NOT EXISTS public.org_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.org_projects(id) ON DELETE SET NULL,
    site_id UUID REFERENCES public.org_sites(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.org_departments(id) ON DELETE SET NULL,
    attached_to_entity_type VARCHAR(32),
    attached_to_entity_id UUID,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link Tasks to Enterprise Scope
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.org_sites(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.org_departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_site ON public.tasks(site_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dept ON public.tasks(department_id);
