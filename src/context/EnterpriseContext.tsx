import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Organization, OrgProject, OrgSite, OrgDepartment } from '../types/enterprise';
import {
  getOrganizations,
  getActiveOrgId,
  setActiveOrgId,
  getOrgProjects,
  getActiveProjectId,
  setActiveProjectId,
  getOrgSites,
  getActiveSiteId,
  setActiveSiteId,
  getOrgDepartments,
  getActiveDeptId,
  setActiveDeptId,
} from '../services/enterpriseService';

interface EnterpriseContextType {
  isEnterpriseMode: boolean;
  setEnterpriseMode: (enabled: boolean) => void;
  organizations: Organization[];
  currentOrg: Organization | null;
  switchOrg: (id: string) => void;
  projects: OrgProject[];
  selectedProject: OrgProject | null;
  selectProject: (id: string | null) => void;
  sites: OrgSite[];
  selectedSite: OrgSite | null;
  selectSite: (id: string | null) => void;
  departments: OrgDepartment[];
  selectedDepartment: OrgDepartment | null;
  selectDepartment: (id: string | null) => void;
  reloadEnterpriseData: () => Promise<void>;
  isLoading: boolean;
}

const EnterpriseContext = createContext<EnterpriseContextType | undefined>(undefined);

export const EnterpriseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEnterpriseMode, setIsEnterpriseMode] = useState<boolean>(() => {
    return localStorage.getItem('tasker_mode') === 'enterprise';
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<OrgProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<OrgProject | null>(null);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<OrgSite | null>(null);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<OrgDepartment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const orgs = await getOrganizations();
      setOrganizations(orgs);
      const activeOrgId = getActiveOrgId();
      const activeOrg = orgs.find((o) => o.id === activeOrgId) || orgs[0] || null;
      setCurrentOrg(activeOrg);

      if (activeOrg) {
        const prjs = await getOrgProjects(activeOrg.id);
        setProjects(prjs);
        const activePrjId = getActiveProjectId();
        const activePrj = prjs.find((p) => p.id === activePrjId) || null;
        setSelectedProject(activePrj);

        const sts = await getOrgSites(activePrj ? activePrj.id : null, activeOrg.id);
        setSites(sts);
        const activeSiteId = getActiveSiteId();
        const activeSt = sts.find((s) => s.id === activeSiteId) || null;
        setSelectedSite(activeSt);

        const dpts = await getOrgDepartments(activeOrg.id);
        setDepartments(dpts);
        const activeDeptId = getActiveDeptId();
        const activeDpt = dpts.find((d) => d.id === activeDeptId) || null;
        setSelectedDepartment(activeDpt);
      }
    } catch (err) {
      console.error('Error loading enterprise context data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleContextChanged = () => {
      loadData();
    };

    window.addEventListener('enterprise-context-changed', handleContextChanged);
    return () => window.removeEventListener('enterprise-context-changed', handleContextChanged);
  }, [loadData]);

  const toggleMode = (enabled: boolean) => {
    setIsEnterpriseMode(enabled);
    localStorage.setItem('tasker_mode', enabled ? 'enterprise' : 'personal');
    window.dispatchEvent(new CustomEvent('app-mode-changed', { detail: { mode: enabled ? 'enterprise' : 'personal' } }));
  };

  const switchOrg = (id: string) => {
    setActiveOrgId(id);
    setActiveProjectId(null);
    setActiveSiteId(null);
    setActiveDeptId(null);
    loadData();
  };

  const selectProject = (id: string | null) => {
    setActiveProjectId(id);
    setActiveSiteId(null);
    loadData();
  };

  const selectSite = (id: string | null) => {
    setActiveSiteId(id);
    loadData();
  };

  const selectDepartment = (id: string | null) => {
    setActiveDeptId(id);
    loadData();
  };

  return (
    <EnterpriseContext.Provider
      value={{
        isEnterpriseMode,
        setEnterpriseMode: toggleMode,
        organizations,
        currentOrg,
        switchOrg,
        projects,
        selectedProject,
        selectProject,
        sites,
        selectedSite,
        selectSite,
        departments,
        selectedDepartment,
        selectDepartment,
        reloadEnterpriseData: loadData,
        isLoading,
      }}
    >
      {children}
    </EnterpriseContext.Provider>
  );
};

export const useEnterprise = (): EnterpriseContextType => {
  const context = useContext(EnterpriseContext);
  if (!context) {
    throw new Error('useEnterprise must be used within an EnterpriseProvider');
  }
  return context;
};
