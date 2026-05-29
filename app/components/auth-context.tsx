"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  collectionCount: number;
  setCollectionCount: (n: number | ((prev: number) => number)) => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  collectionCount: 0,
  setCollectionCount: () => {},
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectionCount, setCollectionCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setCollectionCount(0);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch count whenever user changes
  useEffect(() => {
    const user = session?.user;
    if (!user) { setCollectionCount(0); return; }
    supabase
      .from("collections")
      .select("box_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count: c }) => setCollectionCount(c ?? 0));
  }, [session?.user?.id]);

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/collection` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, collectionCount, setCollectionCount, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
