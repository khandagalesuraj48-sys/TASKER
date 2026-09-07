import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { adminService } from '../services/adminService';
import { PlatformAdmin, AdminDashboardMetrics } from '../types/admin';

interface AdminContextValue {
  isPlatformAdmin: boolean;
  adminProfile: PlatformAdmin | null;
  metrics: AdminDashboardMetrics | null;
  isLoadingAdmin: boolean;
  refreshAdminStatus: () => Promise<void>;
  refreshMetrics: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean>(false);
  const [adminProfile, setAdminProfile] = useState<PlatformAdmin | null>(null);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState<boolean>(true);

  const checkAdmin = useCallback(async () => {
    if (!user?.id) {
      setIsPlatformAdmin(false);
      setAdminProfile(null);
      setMetrics(null);
      setIsLoadingAdmin(false);
      return;
    }

    try {
      setIsLoadingAdmin(true);
      const isAdmin = await adminService.isPlatformAdmin(user.id);
      setIsPlatformAdmin(isAdmin);

      if (isAdmin) {
        const [profile, metricData] = await Promise.all([
          adminService.getAdminProfile(user.id),
          adminService.getDashboardMetrics(),
        ]);
        setAdminProfile(profile);
        setMetrics(metricData);
      } else {
        setAdminProfile(null);
        setMetrics(null);
      }
    } catch (err) {
      console.warn('Admin check error:', err);
      setIsPlatformAdmin(false);
    } finally {
      setIsLoadingAdmin(false);
    }
  }, [user?.id]);

  const refreshMetrics = useCallback(async () => {
    if (!isPlatformAdmin) return;
    try {
      const data = await adminService.getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Error refreshing metrics:', err);
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

  return (
    <AdminContext.Provider
      value={{
        isPlatformAdmin,
        adminProfile,
        metrics,
        isLoadingAdmin,
        refreshAdminStatus: checkAdmin,
        refreshMetrics,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = (): AdminContextValue => {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return ctx;
};

