"use client";

/**
 * Authentication hook for Firebase Auth state management.
 */

import { useState, useEffect, useCallback } from "react";
import {
  onAuthChange,
  signIn as firebaseSignIn,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
  type User,
} from "@/lib/firebase";

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  loginWithGoogle: () => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await firebaseSignIn(email, password);
    return { error: result.error };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const result = await firebaseSignInWithGoogle();
    if (result.user) {
      setUser(result.user);
    }
    return { error: result.error };
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut();
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithGoogle,
    logout,
  };
}
