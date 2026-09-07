import {
  Organization,
  OrgProject,
  OrgSite,
  OrgDepartment,
} from '../types/enterprise';
import { OfflineSyncService } from './offlineSyncService';

const ACTIVE_ORG_KEY = 'tasker_active_org_id';
const ACTIVE_PROJECT_KEY = 'tasker_active_project_id';
const ACTIVE_SITE_KEY = 'tasker_active_site_id';
const ACTIVE_DEPT_KEY = 'tasker_active_dept_id';

const DEFAULT_ORG: Organization = {
  id: 'org_enterprise_default',
  legal_name: 'One Click Solutions Enterprise',
  trade_name: 'One Click Infra & Tech',
  gstin: '27AABCO1234F1Z5',
  pan: 'AABCO1234F',
  currency: 'INR',
  fiscal_year_start_month: 4,
  owner_id: 'default-user',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_PROJECTS: OrgProject[] = [
  {
    id: 'prj_mumbai_metro',
    org_id: 'org_enterprise_default',
    name: 'Mumbai Metro Phase 2',
    code: 'PRJ-MUM-02',
    description: 'Underground station excavation & civil construction',
    status: 'active',
    budget: 45000000,
    start_date: '2026-01-01',
    target_date: '2027-12-31',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prj_pune_techpark',
    org_id: 'org_enterprise_default',
    name: 'Pune Commercial Tech Park',
    code: 'PRJ-PUN-01',
    description: '14-floor commercial IT park development',
    status: 'active',
    budget: 28000000,
    start_date: '2026-02-15',
    target_date: '2027-06-30',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_SITES: OrgSite[] = [
  {
    id: 'site_worli',
    org_id: 'org_enterprise_default',
    project_id: 'prj_mumbai_metro',
    name: 'Worli Underground Station',
    code: 'SITE-WORLI-01',
    address: 'Worli Naka, Mumbai, Maharashtra',
    is_warehouse: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'site_bandra',
    org_id: 'org_enterprise_default',
    project_id: 'prj_mumbai_metro',
    name: 'Bandra Reclamation Yard',
    code: 'SITE-BND-02',
    address: 'Bandra Reclamation, Mumbai, Maharashtra',
    is_warehouse: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'site_baner',
    org_id: 'org_enterprise_default',
    project_id: 'prj_pune_techpark',
    name: 'Baner Tower A & B',
    code: 'SITE-BANER-01',
    address: 'Baner High Street, Pune, Maharashtra',
    is_warehouse: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_DEPTS: OrgDepartment[] = [
  {
    id: 'dept_civil',
    org_id: 'org_enterprise_default',
    name: 'Civil & Structural Execution',
    code: 'DEPT-CIVIL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dept_stores',
    org_id: 'org_enterprise_default',
    name: 'Stores & Inventory',
    code: 'DEPT-STORES',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dept_accounts',
    org_id: 'org_enterprise_default',
    name: 'Accounts & Finance',
    code: 'DEPT-ACCTS',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const getOrganizations = async (): Promise<Organization[]> => {
  const list = await OfflineSyncService.getItems<Organization>('organizations');
  if (list.length === 0) {
    await OfflineSyncService.saveItem('organizations', DEFAULT_ORG);
    return [DEFAULT_ORG];
  }
  return list;
};

export const getActiveOrgId = (): string => {
  return localStorage.getItem(ACTIVE_ORG_KEY) || 'org_enterprise_default';
};

export const setActiveOrgId = (id: string): void => {
  localStorage.setItem(ACTIVE_ORG_KEY, id);
  window.dispatchEvent(new CustomEvent('enterprise-context-changed'));
};

export const getActiveProjectId = (): string | null => {
  return localStorage.getItem(ACTIVE_PROJECT_KEY) || null;
};

export const setActiveProjectId = (id: string | null): void => {
  if (id) localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  else localStorage.removeItem(ACTIVE_PROJECT_KEY);
  window.dispatchEvent(new CustomEvent('enterprise-context-changed'));
};

export const getActiveSiteId = (): string | null => {
  return localStorage.getItem(ACTIVE_SITE_KEY) || null;
};

export const setActiveSiteId = (id: string | null): void => {
  if (id) localStorage.setItem(ACTIVE_SITE_KEY, id);
  else localStorage.removeItem(ACTIVE_SITE_KEY);
  window.dispatchEvent(new CustomEvent('enterprise-context-changed'));
};

export const getActiveDeptId = (): string | null => {
  return localStorage.getItem(ACTIVE_DEPT_KEY) || null;
};

export const setActiveDeptId = (id: string | null): void => {
  if (id) localStorage.setItem(ACTIVE_DEPT_KEY, id);
  else localStorage.removeItem(ACTIVE_DEPT_KEY);
  window.dispatchEvent(new CustomEvent('enterprise-context-changed'));
};

export const getOrgProjects = async (orgId: string): Promise<OrgProject[]> => {
  const projects = await OfflineSyncService.getItems<OrgProject>('org_projects', (p) => p.org_id === orgId);
  if (projects.length === 0 && orgId === 'org_enterprise_default') {
    for (const p of DEFAULT_PROJECTS) {
      await OfflineSyncService.saveItem('org_projects', p);
    }
    return DEFAULT_PROJECTS;
  }
  return projects;
};

export const createOrgProject = async (input: Omit<OrgProject, 'id' | 'created_at' | 'updated_at'>): Promise<OrgProject> => {
  const newProject: OrgProject = {
    ...input,
    id: 'prj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return await OfflineSyncService.saveItem('org_projects', newProject);
};

export const getOrgSites = async (projectId?: string | null, orgId: string = getActiveOrgId()): Promise<OrgSite[]> => {
  const sites = await OfflineSyncService.getItems<OrgSite>(
    'org_sites',
    (s) => s.org_id === orgId && (!projectId || s.project_id === projectId)
  );
  if (sites.length === 0 && orgId === 'org_enterprise_default') {
    for (const s of DEFAULT_SITES) {
      await OfflineSyncService.saveItem('org_sites', s);
    }
    return projectId ? DEFAULT_SITES.filter((s) => s.project_id === projectId) : DEFAULT_SITES;
  }
  return sites;
};

export const createOrgSite = async (input: Omit<OrgSite, 'id' | 'created_at' | 'updated_at'>): Promise<OrgSite> => {
  const newSite: OrgSite = {
    ...input,
    id: 'site_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return await OfflineSyncService.saveItem('org_sites', newSite);
};

export const getOrgDepartments = async (orgId: string = getActiveOrgId()): Promise<OrgDepartment[]> => {
  const depts = await OfflineSyncService.getItems<OrgDepartment>('org_departments', (d) => d.org_id === orgId);
  if (depts.length === 0 && orgId === 'org_enterprise_default') {
    for (const d of DEFAULT_DEPTS) {
      await OfflineSyncService.saveItem('org_departments', d);
    }
    return DEFAULT_DEPTS;
  }
  return depts;
};
