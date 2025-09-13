import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  initialized: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    initialized: false,
  });

  useEffect(() => {
    if (!supabase) {
      setAuthState({ session: null, initialized: true });
      return;
    }

    let mounted = true;

    async function getSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setAuthState({ session, initialized: true });
        }
      } catch (error) {
        console.error('Auth error:', error);
        if (mounted) {
          setAuthState({ session: null, initialized: true });
        }
      }
    }

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setAuthState(prev => ({ ...prev, session }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  return { ...authState, signOut };
}