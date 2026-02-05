"use client";

/**
 * Authentication hook for Firebase Auth state management.
 * Supports demo mode when Firebase is not configured.
 */

import { useState, useEffect, useCallback } from "react";
import {
  onAuthChange,
  isDemoMode,
  setDemoUser,
  clearDemoUser,
  signIn as firebaseSignIn,
  signOut as firebaseSignOut,
  type User,
} from "@/lib/firebase";

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const demoMode = isDemoMode();

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await firebaseSignIn(email, password);
    if (result.user && demoMode) {
      setDemoUser(email);
      setUser(result.user);
    }
    return { error: result.error };
  }, [demoMode]);

  const logout = useCallback(async () => {
    if (demoMode) {
      clearDemoUser();
      setUser(null);
    } else {
      await firebaseSignOut();
    }
  }, [demoMode]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isDemoMode: demoMode,
    login,
    logout,
  };
}
