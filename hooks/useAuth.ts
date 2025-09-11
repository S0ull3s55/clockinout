import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Safe environment variable access
const getEnvVar = (key: string, fallback: string = '') => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
};

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
        const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL');
        const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');
        
        if (!supabaseUrl || !supabaseAnonKey) {
          if (mounted) {
            setAuthState({
              session: null,
              initialized: true,
              connectionStatus: 'disconnected',
            });
          }
          return;
        }

        if (!supabase) {
          if (mounted) {
            setAuthState({
              session: null,
              initialized: true,
              connectionStatus: 'disconnected',
            });
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          setAuthState({
            session,
            initialized: true,
            connectionStatus: 'connected',
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
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

    let subscription: any = null;
    
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (mounted) {
          setAuthState(prev => ({
            ...prev,
            session,
            initialized: true,
            connectionStatus: 'connected',
          }));
        }
      });
      subscription = data;
    }

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  return { ...authState, signOut };
}