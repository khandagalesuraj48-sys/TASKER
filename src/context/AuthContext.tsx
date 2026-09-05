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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<SignUpResult>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordResetOtp: (email: string) => Promise<void>;
  verifyPasswordResetOtp: (email: string, token: string) => Promise<void>;
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
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    // 2. Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setSession(data.session);
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    name?: string
  ): Promise<SignUpResult> => {
    setIsLoading(true);
    try {
      const redirectUrl = window.location.origin.includes('localhost')
        ? window.location.origin
        : 'https://mytasker-dun.vercel.app';

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: name?.trim() || email.split('@')[0],
          },
        },
      });
      if (error) throw error;

      // When email confirmation is active in Supabase, an existing user returns identities: [] without an error
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('An account with this email address already exists. Please switch to Sign In.');
      }

      const hasSession = Boolean(data.session);
      if (hasSession) {
        setSession(data.session);
        setUser(data.user);
      }

      return {
        needsEmailConfirmation: !hasSession,
        user: data.user,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const resendConfirmationEmail = async (email: string): Promise<void> => {
    const redirectUrl = window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://mytasker-dun.vercel.app';

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) throw error;
  };

  const signInWithGoogle = async (): Promise<void> => {
    const redirectUrl = window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://mytasker-dun.vercel.app';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    if (error) throw error;
  };

  const sendPasswordResetOtp = async (email: string): Promise<void> => {
    const redirectUrl = window.location.origin.includes('localhost')
      ? window.location.origin
      : 'https://mytasker-dun.vercel.app';

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
  };

  const verifyPasswordResetOtp = async (email: string, token: string): Promise<void> => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'recovery',
    });
    if (error) throw error;
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }
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
      setSession(null);
      setUser(null);
      setIsPasswordRecovery(false);
    } finally {
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
        signInWithEmail,
        signUpWithEmail,
        resendConfirmationEmail,
        signInWithGoogle,
        sendPasswordResetOtp,
        verifyPasswordResetOtp,
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
