import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthModal } from './AuthModal';
import { Logo } from '../common/Logo';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setHasInitialized(true);
    }
  }, [isLoading]);

  // Only display full-screen cold start loader before the initial session resolution
  if (!hasInitialized && isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-[#090d16]">
        <div className="flex flex-col items-center gap-3">
          <Logo size="lg" variant="full" showTagline={true} animate={true} />
          <div className="w-24 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-blue-600 rounded-full animate-pulse w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthModal isOpen={true} canDismiss={false} />;
  }

  return <>{children}</>;
};

