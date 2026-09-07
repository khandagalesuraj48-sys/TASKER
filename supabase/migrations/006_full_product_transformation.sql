-- =====================================================================
-- Migration 006: Full Product Transformation
-- TASKER: India-focused Personal + Family + Business Work Operating System
-- =====================================================================

-- 1. WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT,
    type TEXT NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'family', 'business', 'school', 'clinic', 'society', 'custom')),
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_type ON public.workspaces(type);

-- 2. WORKSPACE MEMBERS
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'member', 'viewer')),
    department TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- 3. PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'on_hold')),
    start_date DATE,
    target_date DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);

-- 4. EXTEND TASKS TABLE
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;

CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_pinned ON public.tasks(is_pinned) WHERE is_pinned = true;

-- 5. SUBTASKS / CHECKLISTS
CREATE TABLE IF NOT EXISTS public.task_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task ON public.task_subtasks(task_id);

-- 6. TASK DEPENDENCIES
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'related_to')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(task_id, depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_task ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_depends ON public.task_dependencies(depends_on_task_id);

-- 7. PEOPLE (CLIENTS, VENDORS, STAFF, CONTRACTORS, FAMILY)
CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    type TEXT NOT NULL DEFAULT 'contact' CHECK (type IN ('client', 'vendor', 'contractor', 'staff', 'family', 'contact', 'doctor', 'teacher')),
    organization TEXT,
    notes TEXT,
    reliability_rating NUMERIC(2,1) DEFAULT 5.0,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_people_workspace ON public.people(workspace_id);
CREATE INDEX IF NOT EXISTS idx_people_type ON public.people(type);

-- 8. FINANCIAL RECORDS (BILLS / OBLIGATIONS / P2P)
CREATE TABLE IF NOT EXISTS public.financial_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('electricity', 'mobile', 'dth', 'broadband', 'gas', 'water', 'emi', 'loan', 'rent', 'insurance', 'person_p2p', 'school_fees', 'tax', 'other')),
    amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    recurrence_interval TEXT CHECK (recurrence_interval IN ('monthly', 'quarterly', 'yearly', 'weekly', 'biweekly')),
    person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    reference_number TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_finance_workspace ON public.financial_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_finance_status ON public.financial_records(status);
CREATE INDEX IF NOT EXISTS idx_finance_due_date ON public.financial_records(due_date);

-- 9. FINANCIAL PAYMENTS
CREATE TABLE IF NOT EXISTS public.financial_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.financial_records(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_method TEXT NOT NULL DEFAULT 'upi' CHECK (payment_method IN ('upi', 'cash', 'net_banking', 'credit_card', 'debit_card', 'cheque', 'other')),
    transaction_ref TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_record ON public.financial_payments(record_id);

-- 10. VEHICLES
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    vehicle_number TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'car' CHECK (vehicle_type IN ('car', 'two_wheeler', 'commercial', 'tractor', 'bus', 'auto', 'other')),
    nickname TEXT,
    owner_name TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_vehicles_workspace ON public.vehicles(workspace_id);

-- 11. VEHICLE DOCUMENTS
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('puc', 'insurance', 'road_tax', 'fitness', 'permit', 'rc', 'service_record', 'other')),
    document_number TEXT,
    issue_date DATE,
    expiry_date DATE NOT NULL,
    reminder_days_before INTEGER DEFAULT 15,
    file_path TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veh_docs_vehicle ON public.vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_veh_docs_expiry ON public.vehicle_documents(expiry_date);

-- 12. PERSONAL DOCUMENTS
CREATE TABLE IF NOT EXISTS public.personal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('passport', 'driving_license', 'aadhaar', 'pan', 'voter_id', 'insurance_policy', 'property', 'medical', 'academic', 'other')),
    title TEXT NOT NULL,
    document_number TEXT,
    holder_name TEXT,
    issue_date DATE,
    expiry_date DATE,
    reminder_days_before INTEGER DEFAULT 30,
    file_path TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_personal_docs_workspace ON public.personal_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personal_docs_expiry ON public.personal_documents(expiry_date);

-- 13. FAMILY ENTITIES (CHORES, GROCERY LISTS, KIDS ACTIVITIES)
CREATE TABLE IF NOT EXISTS public.family_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('chore', 'grocery_item', 'kids_homework', 'family_event')),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    due_date DATE,
    quantity TEXT,
    category TEXT,
    points INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_family_workspace ON public.family_entities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_family_entity_type ON public.family_entities(entity_type);

-- 14. SAVED VIEWS
CREATE TABLE IF NOT EXISTS public.saved_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    view_type TEXT NOT NULL DEFAULT 'tasks' CHECK (view_type IN ('tasks', 'finance', 'vehicles', 'family', 'business')),
    filter_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. AUDIT LOGS (DPDP Act Compliance)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON public.audit_logs(workspace_id);

-- 16. USER PREFERENCES (Language, Accessibility, Streaks)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'en',
    font_size TEXT NOT NULL DEFAULT 'normal' CHECK (font_size IN ('small', 'normal', 'large', 'extra_large')),
    high_contrast BOOLEAN NOT NULL DEFAULT false,
    elder_mode BOOLEAN NOT NULL DEFAULT false,
    low_data_mode BOOLEAN NOT NULL DEFAULT false,
    current_streak INTEGER NOT NULL DEFAULT 1,
    longest_streak INTEGER NOT NULL DEFAULT 1,
    last_active_date DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all newly created tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Helper security function: is user a member of workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID, u_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = u_id
    ) OR EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = ws_id AND created_by = u_id
    );
$$;

-- Policies for workspaces
CREATE POLICY workspace_select_policy ON public.workspaces FOR SELECT USING (
    auth.uid() = created_by OR EXISTS (
        SELECT 1 FROM public.workspace_members WHERE workspace_id = id AND user_id = auth.uid()
    )
);
CREATE POLICY workspace_insert_policy ON public.workspaces FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY workspace_update_policy ON public.workspaces FOR UPDATE USING (
    auth.uid() = created_by OR EXISTS (
        SELECT 1 FROM public.workspace_members WHERE workspace_id = id AND user_id = auth.uid() AND role IN ('owner', 'manager')
    )
);
CREATE POLICY workspace_delete_policy ON public.workspaces FOR DELETE USING (auth.uid() = created_by);

-- Policies for user_preferences
CREATE POLICY user_pref_all_policy ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
