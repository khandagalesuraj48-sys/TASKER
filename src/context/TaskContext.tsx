import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CreateTaskInput, TaskStats } from '../types/task';
import { getTaskStats } from '../services/taskService';
import { isSupabaseConfigured } from '../lib/supabase';

interface TaskContextValue {
  refreshKey: number;
  triggerRefresh: () => void;
  isCreateModalOpen: boolean;
  openCreateModal: (defaults?: Partial<CreateTaskInput>) => void;
  closeCreateModal: () => void;
  createModalDefaults?: Partial<CreateTaskInput>;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  stats: TaskStats;
  reloadStats: () => Promise<void>;
  isConfigured: boolean;
}

const initialStats: TaskStats = {
  pending: 0,
  inProgress: 0,
  partial: 0,
  completed: 0,
  overdue: 0,
  totalActive: 0,
  binCount: 0,
};

const TaskContext = createContext<TaskContextValue | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createModalDefaults, setCreateModalDefaults] = useState<Partial<CreateTaskInput> | undefined>(undefined);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [stats, setStats] = useState<TaskStats>(initialStats);
  const isConfigured = isSupabaseConfigured();

  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const openCreateModal = useCallback((defaults?: Partial<CreateTaskInput>) => {
    setCreateModalDefaults(defaults);
    setIsCreateModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
    setCreateModalDefaults(undefined);
  }, []);

  const reloadStats = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const data = await getTaskStats();
      setStats(data);
    } catch (err) {
      console.warn('Could not reload stats:', err);
    }
  }, [isConfigured]);

  useEffect(() => {
    reloadStats();
  }, [refreshKey, reloadStats]);

  return (
    <TaskContext.Provider
      value={{
        refreshKey,
        triggerRefresh,
        isCreateModalOpen,
        openCreateModal,
        closeCreateModal,
        createModalDefaults,
        globalSearch,
        setGlobalSearch,
        stats,
        reloadStats,
        isConfigured,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = (): TaskContextValue => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};

