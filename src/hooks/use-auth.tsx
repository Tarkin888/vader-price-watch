import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  last_sign_in_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();
    let prof = data as UserProfile | null;

    // Belt-and-braces: if owner account is stuck as pending, self-repair
    if (email?.toLowerCase() === "zrezvi@gmail.com" && prof && prof.status !== "approved") {
      await supabase.rpc("repair_owner_account");
      const { data: refreshed } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (refreshed) prof = refreshed as UserProfile;
    }

    setProfile(prof);
    return prof;
  }, []);

  const updateLastSignIn = useCallback(async (userId: string) => {
    await supabase
      .from("user_profiles")
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq("id", userId);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);

        if (sess?.user) {
          // Use setTimeout to avoid deadlock with Supabase auth
          setTimeout(async () => {
            await fetchProfile(sess.user.id, sess.user.email);
            if (event === "SIGNED_IN") {
              await updateLastSignIn(sess.user.id);
              // Fire-and-forget audit log
              supabase.from("page_views").insert({
                page: "USER_SIGNED_IN:" + sess.user.email,
                user_agent: navigator.userAgent,
              });
            }
            setIsLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (sess?.user) {
        setSession(sess);
        setUser(sess.user);
        fetchProfile(sess.user.id, sess.user.email).then(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, updateLastSignIn]);

  const signOut = useCallback(async () => {
    const email = user?.email;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    // Fire-and-forget audit
    if (email) {
      supabase.from("page_views").insert({
        page: "USER_SIGNED_OUT:" + email,
        user_agent: navigator.userAgent,
      });
    }
  }, [user?.email]);

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!user,
    isApproved: profile?.status === "approved",
    isAdmin: profile?.role === "admin" && profile?.status === "approved",
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
