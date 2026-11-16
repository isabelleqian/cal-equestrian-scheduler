import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { checkIsAdmin, getMyProfile, type Profile } from './api';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

function cleanAuthParams() {
  const u = new URL(window.location.href);
  if (u.searchParams.has('code') || u.searchParams.has('error') || u.searchParams.has('error_description')) {
    window.history.replaceState(null, '', u.origin + u.pathname + u.hash);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    try {
      const [p, a] = await Promise.all([getMyProfile(s.user.id), checkIsAdmin()]);
      setProfile(p);
      setIsAdmin(a);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      void load(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN') cleanAuthParams();
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Defer so we do not call Supabase inside its own callback.
        setTimeout(() => void load(s), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refreshProfile = useCallback(async () => {
    if (session) setProfile(await getMyProfile(session.user.id));
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider value={{ loading, session, profile, isAdmin, refreshProfile, signOut }}>{children}</Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
