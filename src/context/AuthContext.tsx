import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SignUpResult {
  needsEmailConfirmation: boolean;
  user: User | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPasswordRecovery: boolean;
  userEmail: string;
  displayName: string;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<SignUpResult>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  resetPasswordRecoveryState: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (!error && currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      } else {
        setSession(null);
        setUser(null);
      }
      setIsLoading(false);
    }).catch(() => {
      setSession(null);
      setUser(null);
      setIsLoading(false);
    });

    // 2. Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setIsLoading(false);
          return;
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsLoading(false);
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signInWithPassword = async (email: string, password: string): Promise<void> => {
    const cleanEmail = email.trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) throw error;
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    name?: string
  ): Promise<SignUpResult> => {
    const cleanEmail = email.trim();
    const displayName = name?.trim() || cleanEmail.split('@')[0];
    const redirectUrl = window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://mytasker-dun.vercel.app';

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
          name: displayName,
        },
      },
    });
    if (error) throw error;

    // When email confirmation is active in Supabase, an existing user returns identities: [] without an error
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email address already exists. Please switch to Sign In.');
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }

    return {
      needsEmailConfirmation: !Boolean(data.session),
      user: data.user,
    };
  };

  const sendPasswordResetEmail = async (email: string): Promise<void> => {
    const redirectUrl = window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://mytasker-dun.vercel.app';

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    setIsPasswordRecovery(false);
  };

  const resetPasswordRecoveryState = (): void => {
    setIsPasswordRecovery(false);
  };

  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
    } finally {
      setSession(null);
      setUser(null);
      setIsPasswordRecovery(false);
      setIsLoading(false);
    }
  };

  const userEmail = useMemo(() => {
    return user?.email || '';
  }, [user]);

  const displayName = useMemo(() => {
    if (!user) return '';
    return (
      (user.user_metadata?.display_name as string) ||
      (user.user_metadata?.full_name as string) ||
      user.email?.split('@')[0] ||
      'User'
    );
  }, [user]);

  const isAuthenticated = useMemo(() => {
    return Boolean(user && session);
  }, [user, session]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated,
        isPasswordRecovery,
        userEmail,
        displayName,
        signInWithPassword,
        signUpWithEmail,
        sendPasswordResetEmail,
        updatePassword,
        resetPasswordRecoveryState,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
