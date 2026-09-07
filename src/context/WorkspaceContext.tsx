import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Workspace, WorkspaceType } from '../types/workspace';
import {
  getWorkspaces,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  createWorkspace as createWsService,
} from '../services/workspaceService';

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (id: string) => void;
  createWorkspace: (input: { name: string; type: WorkspaceType; icon?: string; color?: string }) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true);
      const wsList = await getWorkspaces();
      setWorkspaces(wsList);
      const activeId = getActiveWorkspaceId();
      const active = wsList.find((w) => w.id === activeId) || wsList[0] || null;
      setCurrentWorkspace(active);
    } catch (err) {
      console.error('Error loading workspaces:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();

    const handleWorkspaceChanged = (e: any) => {
      const newId = e.detail?.workspaceId;
      if (newId) {
        setWorkspaces((prev) => {
          const found = prev.find((w) => w.id === newId);
          if (found) setCurrentWorkspace(found);
          return prev;
        });
      }
    };

    window.addEventListener('workspace-changed', handleWorkspaceChanged);
    return () => window.removeEventListener('workspace-changed', handleWorkspaceChanged);
  }, [loadWorkspaces]);

  const switchWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    const found = workspaces.find((w) => w.id === id);
    if (found) setCurrentWorkspace(found);
  };

  const createWorkspace = async (input: { name: string; type: WorkspaceType; icon?: string; color?: string }) => {
    const ws = await createWsService(input);
    await loadWorkspaces();
    switchWorkspace(ws.id);
    return ws;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        switchWorkspace,
        createWorkspace,
        refreshWorkspaces: loadWorkspaces,
        isLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
