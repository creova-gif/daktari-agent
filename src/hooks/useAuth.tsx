import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, getCHWProfile } from '../lib/supabase';
import { registerPushToken, deregisterPushToken } from '../lib/notifications';
import type { CHWProfile } from '../types';
import type { Session, User } from '@supabase/supabase-js';

// ─── Context Shape ────────────────────────────────────────────────────────────
interface AuthContextValue {
  session: Session | null;
  user: User | null;
  chw: CHWProfile | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [chw, setCHW] = useState<CHWProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load persisted session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadCHWProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadCHWProfile(session.user.id);
      } else {
        setCHW(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadCHWProfile(authUserId: string) {
    try {
      const profile = await getCHWProfile(authUserId);
      setCHW(profile);
      // Register push notification token after profile is confirmed
      await registerPushToken(profile.id).catch(err =>
        console.warn('[Auth] Push token registration failed:', err)
      );
    } catch (err) {
      console.error('[Auth] Failed to load CHW profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(phone: string, password: string) {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ phone, password });
    if (error) { setLoading(false); throw error; }
    if (data.user) await loadCHWProfile(data.user.id);
  }

  async function signOut() {
    if (chw) {
      await deregisterPushToken(chw.id).catch(() => {});
    }
    await supabase.auth.signOut();
    setCHW(null);
    setSession(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, chw, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
