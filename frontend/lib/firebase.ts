/**
 * Firebase configuration and utilities for HomeCare Admin UI.
 * Supports demo mode when Firebase is not configured.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

// Check if Firebase is configured
const isFirebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) {
    return null;
  }
  if (!app) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(firebaseConfig);
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) {
    return null;
  }
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    if (firebaseApp) {
      auth = getAuth(firebaseApp);
    }
  }
  return auth;
}

// Demo mode flag
export function isDemoMode(): boolean {
  return !isFirebaseConfigured;
}

// Demo user for demo mode (mimics Firebase User structure)
const DEMO_USER: Partial<User> = {
  uid: "demo-user-001",
  email: "demo@homecare.ai",
  displayName: "デモユーザー",
} as User;

// Authentication functions
export async function signIn(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  // Demo mode: accept demo credentials
  if (isDemoMode()) {
    if (email === "demo@homecare.ai" && password === "demo1234") {
      // Return a mock user-like object with uid
      return { user: DEMO_USER as User, error: null };
    }
    return { user: null, error: "メールアドレスまたはパスワードが正しくありません" };
  }

  try {
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      return { user: null, error: "Firebase が設定されていません" };
    }
    const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return { user: result.user, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ログインに失敗しました";
    return { user: null, error: message };
  }
}

// Google OAuth sign in
export async function signInWithGoogle(): Promise<{ user: User | null; error: string | null }> {
  if (isDemoMode()) {
    return { user: null, error: "デモモードではGoogle認証は使用できません" };
  }

  try {
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      return { user: null, error: "Firebase が設定されていません" };
    }
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(firebaseAuth, provider);
    return { user: result.user, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Googleログインに失敗しました";
    return { user: null, error: message };
  }
}

export async function signOut(): Promise<void> {
  if (isDemoMode()) {
    // Demo mode: just clear local state (handled by useAuth)
    return;
  }
  const firebaseAuth = getFirebaseAuth();
  if (firebaseAuth) {
    await firebaseSignOut(firebaseAuth);
  }
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  if (isDemoMode()) {
    // Demo mode: check localStorage for demo session
    const demoUser = typeof window !== "undefined" ? localStorage.getItem("demo_user") : null;
    // Use setTimeout to make it async like the real Firebase
    setTimeout(() => {
      callback(demoUser ? (DEMO_USER as User) : null);
    }, 0);
    // Return a no-op unsubscribe function
    return () => {};
  }

  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    setTimeout(() => callback(null), 0);
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, callback);
}

export async function getIdToken(): Promise<string | null> {
  if (isDemoMode()) {
    return "demo-token";
  }
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) return null;
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

// Demo mode helpers
export function setDemoUser(email: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("demo_user", email);
  }
}

export function clearDemoUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("demo_user");
  }
}

// Export types
export type { User };
