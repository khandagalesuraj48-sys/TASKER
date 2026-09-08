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
  checkAnyPendingRequest,
  getOrgSites,
  getUserAssignedSites,
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
  requestJoin: (notes?: string, targetOrgId?: string) => Promise<void>;
  isJoining: boolean;
  hasRequestedJoin: boolean;
  reloadEnterpriseData: () => Promise<void>;
  isLoading: boolean;
  // Multi-Site Architecture inside Organization
  projects: OrgProject[];
  selectedProject: OrgProject | null;
  selectProject: (id: string | null) => void;
  sites: OrgSite[];
  allSites: OrgSite[];
  selectedSite: OrgSite | null;
  selectSite: (id: string | null) => void;
  userAssignedSiteIds: string[];
  refreshSites: () => Promise<void>;
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

  // Multi-Site Architecture inside Organization
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [allSites, setAllSites] = useState<OrgSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<OrgSite | null>(null);
  const [userAssignedSiteIds, setUserAssignedSiteIds] = useState<string[]>([]);

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
      // If user has NO approved organizations, DO NOT default to Rachana or primary org!
      let activeOrg: Organization | null = null;
      const activeOrgId = getActiveOrgId();

      if (activeOrgId && approved.some((o) => o.id === activeOrgId)) {
        activeOrg = approved.find((o) => o.id === activeOrgId) || null;
      }

      if (!activeOrg && approved.length > 0) {
        activeOrg = approved[0];
        setActiveOrgId(activeOrg.id);
      }

      setCurrentOrg(activeOrg);

      // 4. Load membership, sites, and pending join status
      if (activeOrg && user?.id) {
        const [membership, pending, loadedSites, assignedSites] = await Promise.all([
          getUserMembership(user.id, activeOrg.id),
          checkUserPendingRequest(user.id, activeOrg.id),
          getOrgSites(activeOrg.id),
          getUserAssignedSites(user.id, activeOrg.id),
        ]);
        setUserMembership(membership);
        setHasRequestedJoin(pending);

        const isUserAdminOrOwner = Boolean(
          (activeOrg.owner_id && user.id && activeOrg.owner_id === user.id) ||
          membership?.role === 'org_owner' ||
          membership?.role === 'org_admin'
        );

        // Strict Site Filtering:
        // Admin / Owner sees all sites
        // Regular members ONLY see their explicitly assigned sites
        const visibleSites = isUserAdminOrOwner
          ? loadedSites
          : loadedSites.filter((s) => assignedSites.includes(s.id));

        setSites(visibleSites);
        setAllSites(loadedSites);
        setUserAssignedSiteIds(assignedSites);

        setSelectedSite((prev) => {
          if (!prev) {
            if (!isUserAdminOrOwner && visibleSites.length === 1) {
              return visibleSites[0];
            }
            return null;
          }
          return visibleSites.find((s) => s.id === prev.id) || null;
        });

        // Note: Do NOT automatically reset isEnterpriseMode. The user's choice is persistent
        // until the user explicitly toggles modes via the UI.
      } else {
        setUserMembership(null);
        setSites([]);
        setAllSites([]);
        setSelectedSite(null);
        setUserAssignedSiteIds([]);

        if (user?.id) {
          const anyPending = await checkAnyPendingRequest(user.id);
          setHasRequestedJoin(anyPending);
        } else {
          setHasRequestedJoin(false);
        }
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

  const selectSite = (id: string | null) => {
    if (!id || id === 'all') {
      setSelectedSite(null);
      return;
    }
    const found = sites.find((s) => s.id === id);
    setSelectedSite(found || null);
  };

  const refreshSites = async () => {
    if (!currentOrg) return;
    try {
      const [loadedSites, assignedSites] = await Promise.all([
        getOrgSites(currentOrg.id),
        user?.id ? getUserAssignedSites(user.id, currentOrg.id) : Promise.resolve([]),
      ]);

      const isUserAdminOrOwner = isOwner || isAdmin;
      const visibleSites = isUserAdminOrOwner
        ? loadedSites
        : loadedSites.filter((s) => assignedSites.includes(s.id));

      setSites(visibleSites);
      setAllSites(loadedSites);
      setUserAssignedSiteIds(assignedSites);

      setSelectedSite((prev) => {
        if (!prev) {
          if (!isUserAdminOrOwner && visibleSites.length === 1) {
            return visibleSites[0];
          }
          return null;
        }
        return visibleSites.find((s) => s.id === prev.id) || null;
      });
    } catch (err) {
      console.warn('Failed refreshing sites:', err);
    }
  };

  const handleRequestJoin = async (notes?: string, targetOrgId?: string) => {
    if (!user?.id || !userEmail) return;
    setIsJoining(true);
    try {
      let orgId = targetOrgId || currentOrg?.id;
      if (!orgId) {
        const primary = await getPrimaryOrg();
        orgId = primary?.id || '';
      }

      await requestJoinOrg(
        orgId,
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
        sites,
        allSites,
        selectedSite,
        selectSite,
        userAssignedSiteIds,
        refreshSites,
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
