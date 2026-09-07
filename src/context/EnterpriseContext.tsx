import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Organization, OrgMembership, OrgProject, OrgSite, OrgDepartment } from '../types/enterprise';
import {
  getOrganizations,
  getPrimaryOrg,
  getActiveOrgId,
  setActiveOrgId,
  getUserMembership,
  requestJoinOrg,
  OWNER_EMAIL,
} from '../services/enterpriseService';
import { useAuth } from './AuthContext';

interface EnterpriseContextType {
  isEnterpriseMode: boolean;
  setEnterpriseMode: (enabled: boolean) => void;
  organizations: Organization[];
  currentOrg: Organization | null;
  switchOrg: (id: string) => void;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  userMembership: OrgMembership | null;
  requestJoin: () => Promise<void>;
  isJoining: boolean;
  hasRequestedJoin: boolean;
  reloadEnterpriseData: () => Promise<void>;
  isLoading: boolean;
  // Backward-compatibility stubs for deactivated ERP views
  projects: OrgProject[];
  selectedProject: OrgProject | null;
  selectProject: (id: string | null) => void;
  sites: OrgSite[];
  selectedSite: OrgSite | null;
  selectSite: (id: string | null) => void;
  departments: OrgDepartment[];
  selectedDepartment: OrgDepartment | null;
  selectDepartment: (id: string | null) => void;
}

const EnterpriseContext = createContext<EnterpriseContextType | undefined>(undefined);

export const EnterpriseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userEmail } = useAuth();
  const [isEnterpriseMode, setIsEnterpriseMode] = useState<boolean>(() => {
    return localStorage.getItem('tasker_mode') === 'enterprise';
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [userMembership, setUserMembership] = useState<OrgMembership | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [hasRequestedJoin, setHasRequestedJoin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Determine owner status
  const isOwner = Boolean(
    (userEmail && userEmail.toLowerCase() === OWNER_EMAIL.toLowerCase()) ||
    (currentOrg?.owner_id && user?.id && currentOrg.owner_id === user.id)
  );

  // Determine admin status
  const isAdmin = Boolean(
    isOwner ||
    userMembership?.role === 'org_owner' ||
    userMembership?.role === 'org_admin'
  );

  // Determine member status
  const isMember = Boolean(isOwner || userMembership);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const orgs = await getOrganizations();
      setOrganizations(orgs);

      let activeOrg: Organization | null = null;
      const activeOrgId = getActiveOrgId();

      if (activeOrgId) {
        activeOrg = orgs.find((o) => o.id === activeOrgId) || null;
      }

      if (!activeOrg) {
        activeOrg = await getPrimaryOrg();
        if (activeOrg) {
          setActiveOrgId(activeOrg.id);
        }
      }

      setCurrentOrg(activeOrg);

      if (activeOrg && user?.id) {
        const membership = await getUserMembership(user.id, activeOrg.id);
        setUserMembership(membership);
      } else {
        setUserMembership(null);
      }
    } catch (err) {
      console.error('Error loading enterprise context data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

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
    window.dispatchEvent(
      new CustomEvent('app-mode-changed', {
        detail: { mode: enabled ? 'enterprise' : 'personal' },
      })
    );
  };

  const switchOrg = (id: string) => {
    setActiveOrgId(id);
    loadData();
  };

  const handleRequestJoin = async () => {
    if (!currentOrg || !user?.id || !userEmail) return;
    setIsJoining(true);
    try {
      await requestJoinOrg(currentOrg.id, userEmail, user.id);
      setHasRequestedJoin(true);
    } catch (err) {
      console.error('Error requesting join:', err);
      throw err;
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <EnterpriseContext.Provider
      value={{
        isEnterpriseMode,
        setEnterpriseMode: toggleMode,
        organizations,
        currentOrg,
        switchOrg,
        isOwner,
        isAdmin,
        isMember,
        userMembership,
        requestJoin: handleRequestJoin,
        isJoining,
        hasRequestedJoin,
        reloadEnterpriseData: loadData,
        isLoading,
        projects: [],
        selectedProject: null,
        selectProject: () => {},
        sites: [],
        selectedSite: null,
        selectSite: () => {},
        departments: [],
        selectedDepartment: null,
        selectDepartment: () => {},
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
