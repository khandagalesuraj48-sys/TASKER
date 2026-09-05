import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CreateTaskInput, TaskStats } from '../types/task';
import { getTaskStats } from '../services/taskService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface TaskContextValue {
  refreshKey: number;
  triggerRefresh: () => void;
  isCreateModalOpen: boolean;
  openCreateModal: (defaults?: Partial<CreateTaskInput>) => void;
  closeCreateModal: () => void;
  createModalDefaults?: Partial<CreateTaskInput>;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  isUniversalSearchOpen: boolean;
  universalSearchQuery: string;
  openUniversalSearch: (initialQuery?: string) => void;
  closeUniversalSearch: () => void;
  isAIDrawerOpen: boolean;
  openAIDrawer: () => void;
  closeAIDrawer: () => void;
  stats: TaskStats;
  reloadStats: () => Promise<void>;
  isConfigured: boolean;
  isRealtimeConnected: boolean;
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
  const { user, isAuthenticated } = useAuth();
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createModalDefaults, setCreateModalDefaults] = useState<Partial<CreateTaskInput> | undefined>(undefined);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [isUniversalSearchOpen, setIsUniversalSearchOpen] = useState<boolean>(false);
  const [universalSearchQuery, setUniversalSearchQuery] = useState<string>('');
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState<boolean>(false);
  const [stats, setStats] = useState<TaskStats>(initialStats);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);

  const isConfigured = isSupabaseConfigured();
  const refreshDebounceRef = useRef<number | null>(null);

  const triggerRefresh = useCallback(() => {
    // Debounce rapid realtime triggers within 100ms to avoid unnecessary re-renders
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }
    refreshDebounceRef.current = window.setTimeout(() => {
      setRefreshKey((prev) => prev + 1);
    }, 100);
  }, []);

  const openUniversalSearch = useCallback((initialQuery?: string) => {
    setUniversalSearchQuery(initialQuery || '');
    setIsUniversalSearchOpen(true);
  }, []);

  const closeUniversalSearch = useCallback(() => {
    setIsUniversalSearchOpen(false);
  }, []);

  const openAIDrawer = useCallback(() => {
    setIsAIDrawerOpen(true);
  }, []);

  const closeAIDrawer = useCallback(() => {
    setIsAIDrawerOpen(false);
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
    if (!isConfigured || !isAuthenticated) {
      setStats(initialStats);
      return;
    }
    try {
      const data = await getTaskStats();
      setStats(data);
    } catch (err) {
      console.warn('Could not reload stats:', err);
    }
  }, [isConfigured, isAuthenticated]);

  // Reload stats whenever refreshKey changes
  useEffect(() => {
    reloadStats();
  }, [refreshKey, reloadStats]);

  // Reset state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setStats(initialStats);
      setGlobalSearch('');
      setIsUniversalSearchOpen(false);
      setIsAIDrawerOpen(false);
      setIsCreateModalOpen(false);
    }
  }, [isAuthenticated]);

  // Supabase Realtime Subscription: Instant synchronization across devices without page reload
  useEffect(() => {
    if (!isConfigured || !isAuthenticated || !user) {
      setIsRealtimeConnected(false);
      return;
    }

    const channelName = `tasker-realtime-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          triggerRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_notes' },
        () => {
          triggerRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_status_history' },
        () => {
          triggerRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_reminders' },
        () => {
          triggerRefresh();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_attachments' },
        () => {
          triggerRefresh();
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [isConfigured, isAuthenticated, user, triggerRefresh]);

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
        isUniversalSearchOpen,
        universalSearchQuery,
        openUniversalSearch,
        closeUniversalSearch,
        isAIDrawerOpen,
        openAIDrawer,
        closeAIDrawer,
        stats,
        reloadStats,
        isConfigured,
        isRealtimeConnected,
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
