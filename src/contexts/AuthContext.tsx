import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// ── Device fingerprint ──────────────────────────────────────────────────────
function getDeviceId(): string {
  const KEY = 'nxtv_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
// ────────────────────────────────────────────────────────────────────────────

const ADMIN_PASSWORD = 'Tech2028';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  phone: string | null;
  device_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; deviceBlocked?: boolean }>;
  signUp: (email: string, password: string, displayName: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  loginAsAdmin: (password: string) => boolean;
  logoutAdmin: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const ensureProfile = async (userId: string, fallback: { display_name?: string | null; phone?: string | null } = {}) => {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return;

    await (supabase.from('profiles') as any).insert({
      user_id: userId,
      display_name: fallback.display_name || null,
      phone: fallback.phone || null,
      plan: 'free',
      is_active: true,
      device_id: null,
    });
  };

  const fetchProfile = async (userId: string) => {
    await supabase.rpc('check_user_subscription', { p_user_id: userId }).catch(() => undefined);
    await ensureProfile(userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.warn('[Auth] profile lookup failed:', error.message);
      return;
    }
    if (data) setProfile(data as Profile);
    else setProfile(null);
  };

  useEffect(() => {
    const adminStored = sessionStorage.getItem('ch_admin');
    if (adminStored === 'true') setIsAdmin(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => fetchProfile(sess.user.id), 0);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) fetchProfile(sess.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null; deviceBlocked?: boolean }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: error as Error | null };

    const deviceId = getDeviceId();

    await ensureProfile(data.user.id, { display_name: data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || null, phone: data.user.user_metadata?.phone || null });

    // Fetch profile to check device_id (cast to any since device_id is new)
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    const profAny = prof as any;
    if (profAny) {
      if (!profAny.device_id) {
        // First login — lock to this device
        await (supabase.from('profiles') as any)
          .update({ device_id: deviceId })
          .eq('user_id', data.user.id);
      } else if (profAny.device_id !== deviceId) {
        // Different device — block login
        await supabase.auth.signOut();
        return {
          error: new Error('DEVICE_BLOCKED'),
          deviceBlocked: true,
        };
      }
      // device matches → allow
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, displayName: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, phone: phone || '' },
        emailRedirectTo: window.location.origin,
      },
    });
    if (!error && phone) {
      setTimeout(async () => {
        const { data: { session: sess } } = await supabase.auth.getSession();
        if (sess?.user) {
          const deviceId = getDeviceId();
          await ensureProfile(sess.user.id, { display_name: displayName, phone });
          await (supabase.from('profiles') as any)
            .update({ phone, device_id: deviceId })
            .eq('user_id', sess.user.id);
        }
      }, 1000);
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    sessionStorage.removeItem('ch_admin');
  };

  const loginAsAdmin = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      sessionStorage.setItem('ch_admin', 'true');
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('ch_admin');
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, loading, signIn, signUp, signOut, loginAsAdmin, logoutAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
