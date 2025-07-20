import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, checkSupabaseConnection } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  initialized: boolean;
  error: string | null;
  isLoading: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    initialized: false,
    error: null,
    isLoading: true,
    connectionStatus: 'connecting',
  });

  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;

    async function initializeAuth() {
      if (!mounted) return;
      
      try {
        setAuthState(prev => ({ ...prev, isLoading: true, connectionStatus: 'connecting' }));
        
        // Check connection first
        const isConnected = await checkSupabaseConnection();
        if (!mounted) return;
        
        if (!isConnected) {
          throw new Error('Unable to connect to server');
        }

        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        if (mounted) {
          setAuthState({
            session,
            initialized: true,
            error: null,
            isLoading: false,
            connectionStatus: 'connected',
          });
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize auth';
          setAuthState({
            session: null,
            initialized: true,
            error: errorMessage,
            isLoading: false,
            connectionStatus: 'disconnected',
          });
          
          // Retry connection after delay
          retryTimeout = setTimeout(() => {
            if (mounted) {
              initializeAuth();
            }
          }, 3000);
        }
      }
    }

    // Initialize auth state
    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        console.log('Auth state changed:', event, !!session);
        setAuthState(prev => ({
          ...prev,
          session,
          initialized: true,
          error: null,
          isLoading: false,
          connectionStatus: session ? 'connected' : 'disconnected',
        }));
      }
    });

    // Cleanup
    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Sign out failed',
        isLoading: false 
      }));
    }
  };

  const refreshSession = async () => {
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  };

  return { 
    ...authState,
    signOut,
    refreshSession,
  };
}