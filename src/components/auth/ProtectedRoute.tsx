import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthModal } from './AuthModal';
import { Sparkles } from 'lucide-react';

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
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md animate-bounce">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Loading TASKER...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthModal isOpen={true} canDismiss={false} />;
  }

  return <>{children}</>;
};

