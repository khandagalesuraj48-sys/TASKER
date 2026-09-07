import { ErpEmployee, ErpAttendance } from '../types/enterprise';
import { OfflineSyncService } from './offlineSyncService';

const DEFAULT_EMPLOYEES: ErpEmployee[] = [
  {
    id: 'emp_ramesh',
    org_id: 'org_enterprise_default',
    project_id: 'proj_metro_line_3',
    site_id: 'site_mumbai_cst',
    department_id: 'dept_civil',
    first_name: 'Ramesh',
    last_name: 'Patil',
    employee_code: 'EMP-0101',
    designation: 'Senior Project Engineer (Civil)',
    phone: '9822114455',
    email: 'ramesh.patil@enterprise.tasker',
    salary: 85000,
    daily_wage: 3500,
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'emp_sunita',
    org_id: 'org_enterprise_default',
    project_id: 'proj_metro_line_3',
    site_id: 'site_mumbai_cst',
    department_id: 'dept_safety',
    first_name: 'Sunita',
    last_name: 'More',
    employee_code: 'EMP-0102',
    designation: 'EHS & Safety Officer',
    phone: '9822336677',
    email: 'sunita.more@enterprise.tasker',
    salary: 65000,
    daily_wage: 2600,
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'emp_sachin',
    org_id: 'org_enterprise_default',
    project_id: 'proj_metro_line_3',
    site_id: 'site_worli_casting',
    department_id: 'dept_civil',
    first_name: 'Sachin',
    last_name: 'Kadam',
    employee_code: 'EMP-0103',
    designation: 'Site Supervisor',
    phone: '9822558899',
    email: 'sachin.kadam@enterprise.tasker',
    salary: 45000,
    daily_wage: 1800,
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'emp_ganesh',
    org_id: 'org_enterprise_default',
    project_id: 'proj_metro_line_3',
    site_id: 'site_mumbai_cst',
    department_id: 'dept_electrical',
    first_name: 'Ganesh',
    last_name: 'Shinde',
    employee_code: 'EMP-0104',
    designation: 'Lead MEP Electrician',
    phone: '9822991122',
    email: 'ganesh.shinde@enterprise.tasker',
    salary: 40000,
    daily_wage: 1600,
    status: 'active',
    created_at: new Date().toISOString(),
  },
  {
    id: 'emp_vikas',
    org_id: 'org_enterprise_default',
    project_id: 'proj_metro_line_3',
    site_id: 'site_worli_casting',
    department_id: 'dept_stores',
    first_name: 'Vikas',
    last_name: 'Pawar',
    employee_code: 'EMP-0105',
    designation: 'Stores & Gate Keeper',
    phone: '9822774411',
    email: 'vikas.pawar@enterprise.tasker',
    salary: 35000,
    daily_wage: 1400,
    status: 'active',
    created_at: new Date().toISOString(),
  },
];

export const getErpEmployees = async (
  orgId: string = 'org_enterprise_default',
  projectId?: string | null,
  siteId?: string | null
): Promise<ErpEmployee[]> => {
  const employees = await OfflineSyncService.getItems<ErpEmployee>(
    'erp_employees',
    (emp) =>
      emp.org_id === orgId &&
      (!projectId || emp.project_id === projectId) &&
      (!siteId || emp.site_id === siteId)
  );

  if (employees.length === 0 && orgId === 'org_enterprise_default') {
    for (const emp of DEFAULT_EMPLOYEES) {
      await OfflineSyncService.saveItem('erp_employees', emp);
    }
    return projectId
      ? DEFAULT_EMPLOYEES.filter((e) => !projectId || e.project_id === projectId)
      : DEFAULT_EMPLOYEES;
  }

  return employees;
};

export const createErpEmployee = async (
  input: Omit<ErpEmployee, 'id' | 'created_at'>
): Promise<ErpEmployee> => {
  const employee: ErpEmployee = {
    ...input,
    id: 'emp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    created_at: new Date().toISOString(),
  };

  return await OfflineSyncService.saveItem('erp_employees', employee);
};

export const getErpAttendance = async (
  date: string,
  siteId?: string | null,
  orgId: string = 'org_enterprise_default'
): Promise<ErpAttendance[]> => {
  return await OfflineSyncService.getItems<ErpAttendance>(
    'erp_attendance',
    (att) =>
      att.org_id === orgId &&
      att.date === date &&
      (!siteId || att.site_id === siteId)
  );
};

export const markErpAttendance = async (
  records: Array<Omit<ErpAttendance, 'id' | 'created_at'>>
): Promise<ErpAttendance[]> => {
  const saved: ErpAttendance[] = [];
  for (const rec of records) {
    const item: ErpAttendance = {
      ...rec,
      id: 'att_' + rec.employee_id + '_' + rec.date,
      created_at: new Date().toISOString(),
    };
    await OfflineSyncService.saveItem('erp_attendance', item);
    saved.push(item);
  }
  return saved;
};
