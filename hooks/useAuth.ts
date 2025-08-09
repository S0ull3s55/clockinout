import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  initialized: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    initialized: false,
    connectionStatus: 'connecting',
  });

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          setAuthState({
            session,
            initialized: true,
            connectionStatus: 'connected',
          });
        }
      } catch (error) {
        if (mounted) {
          setAuthState({
            session: null,
            initialized: true,
            connectionStatus: 'disconnected',
          });
        }
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setAuthState(prev => ({
          ...prev,
          session,
          initialized: true,
          connectionStatus: 'connected',
        }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...authState, signOut };
}