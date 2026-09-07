import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Organization, OrgMembership, OrgProject, OrgSite, OrgDepartment } from '../types/enterprise';
import {
  getOrganizations,
  getPrimaryOrg,
  getActiveOrgId,
  setActiveOrgId,
  getUserMembership,
  getUserApprovedOrgs,
  checkUserPendingRequest,
  requestJoinOrg,
} from '../services/enterpriseService';
import { useAuth } from './AuthContext';

interface EnterpriseContextType {
  isEnterpriseMode: boolean;
  setEnterpriseMode: (enabled: boolean) => void;
  organizations: Organization[];
  userApprovedOrgs: Organization[];
  hasApprovedOrg: boolean;
  currentOrg: Organization | null;
  switchOrg: (id: string) => void;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  userMembership: OrgMembership | null;
  requestJoin: (notes?: string) => Promise<void>;
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
  const { user, userEmail, displayName } = useAuth();
  const [isEnterpriseMode, setIsEnterpriseMode] = useState<boolean>(() => {
    return localStorage.getItem('tasker_mode') === 'enterprise';
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [userApprovedOrgs, setUserApprovedOrgs] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [userMembership, setUserMembership] = useState<OrgMembership | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [hasRequestedJoin, setHasRequestedJoin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // User belongs to at least one approved organization
  const hasApprovedOrg = userApprovedOrgs.length > 0;

  // Determine owner status (Strictly database-backed)
  const isOwner = Boolean(
    (currentOrg?.owner_id && user?.id && currentOrg.owner_id === user.id) ||
    userMembership?.role === 'org_owner'
  );

  // Determine admin status
  const isAdmin = Boolean(
    isOwner ||
    userMembership?.role === 'org_admin'
  );

  // Determine member status
  const isMember = Boolean(userMembership);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Fetch public organization list
      const orgs = await getOrganizations();
      setOrganizations(orgs);

      // 2. Fetch user's approved organizations (ONE auth user ID, multiple workspaces)
      let approved: Organization[] = [];
      if (user?.id) {
        approved = await getUserApprovedOrgs(user.id);
        setUserApprovedOrgs(approved);
      } else {
        setUserApprovedOrgs([]);
      }

      // 3. Resolve active organization
      let activeOrg: Organization | null = null;
      const activeOrgId = getActiveOrgId();

      if (activeOrgId) {
        activeOrg = orgs.find((o) => o.id === activeOrgId) || null;
      }

      // If no active org selected or user not approved in selected, pick from approved orgs or primary org
      if (!activeOrg) {
        if (approved.length > 0) {
          activeOrg = approved[0];
          setActiveOrgId(activeOrg.id);
        } else {
          activeOrg = await getPrimaryOrg();
          if (activeOrg) {
            setActiveOrgId(activeOrg.id);
          }
        }
      }

      setCurrentOrg(activeOrg);

      // 4. Load membership and pending join status
      if (activeOrg && user?.id) {
        const [membership, pending] = await Promise.all([
          getUserMembership(user.id, activeOrg.id),
          checkUserPendingRequest(user.id, activeOrg.id),
        ]);
        setUserMembership(membership);
        setHasRequestedJoin(pending);

        // If user has no approved membership, force personal mode
        if (!membership && isEnterpriseMode) {
          setIsEnterpriseMode(false);
          localStorage.setItem('tasker_mode', 'personal');
        }
      } else {
        setUserMembership(null);
        setHasRequestedJoin(false);
        if (isEnterpriseMode) {
          setIsEnterpriseMode(false);
          localStorage.setItem('tasker_mode', 'personal');
        }
      }
    } catch (err) {
      console.error('Error loading enterprise context data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isEnterpriseMode]);

  useEffect(() => {
    loadData();

    const handleContextChanged = () => {
      loadData();
    };

    window.addEventListener('enterprise-context-changed', handleContextChanged);
    return () => window.removeEventListener('enterprise-context-changed', handleContextChanged);
  }, [loadData]);

  // Supabase Realtime: instantly unlock workplace access or update request status without page refresh
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `enterprise-realtime-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_memberships' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_join_requests' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizations' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadData]);

  const toggleMode = (enabled: boolean) => {
    // Cannot enable enterprise mode if user has no approved organization
    if (enabled && !hasApprovedOrg && !isMember) {
      setIsEnterpriseMode(false);
      localStorage.setItem('tasker_mode', 'personal');
      return;
    }
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

  const handleRequestJoin = async (notes?: string) => {
    if (!user?.id || !userEmail) return;
    setIsJoining(true);
    try {
      let targetOrg = currentOrg;
      if (!targetOrg) {
        targetOrg = await getPrimaryOrg();
        if (targetOrg) {
          setCurrentOrg(targetOrg);
        }
      }

      await requestJoinOrg(
        targetOrg?.id || '',
        userEmail,
        user.id,
        displayName || userEmail.split('@')[0],
        notes
      );
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
        userApprovedOrgs,
        hasApprovedOrg,
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
