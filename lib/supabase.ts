import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is not defined');
}

if (!supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is not defined');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL is not a valid URL');
}

// Connection state management
let connectionRetries = 0;
const MAX_RETRIES = 3;
let isConnected = false;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-Client-Info': 'expo-router',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Enhanced auth state change handler with cleanup
let authSubscription: any = null;

const setupAuthListener = () => {
  if (authSubscription) {
    authSubscription.unsubscribe();
  }

  authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
    try {
      console.log('Auth event:', event, session?.user?.id);
      
      if (event === 'SIGNED_OUT') {
        // Clear all cached data
        await AsyncStorage.multiRemove([
          'supabase.auth.token',
          'user-profile',
          'company-data',
        ]);
        isConnected = false;
      } else if (event === 'SIGNED_IN' && session) {
        isConnected = true;
        connectionRetries = 0;
        
        // Ensure profile exists
        await ensureProfileExists(session.user);
      } else if (event === 'TOKEN_REFRESHED') {
        isConnected = true;
      }
    } catch (error) {
      console.error('Auth state change error:', error);
      if (connectionRetries < MAX_RETRIES) {
        connectionRetries++;
        setTimeout(setupAuthListener, 1000 * connectionRetries);
      }
    }
  });
};

// Ensure profile exists for authenticated users
const ensureProfileExists = async (user: any) => {
  try {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingProfile) {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          role: 'staff',
          status: 'pending',
        });
      
      if (error && !error.message.includes('duplicate key')) {
        console.error('Profile creation error:', error);
      }
    }
  } catch (error) {
    console.error('Profile check error:', error);
  }
};

// Initialize auth listener
setupAuthListener();

// Handle app state changes for connection management
AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'active' && !isConnected) {
    setupAuthListener();
  }
});

// Cleanup function
export const cleanupSupabase = () => {
  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }
};

// Enhanced health check with retry logic
export async function checkSupabaseConnection(): Promise<boolean> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const { error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      if (!error) {
        isConnected = true;
        return true;
      }
    } catch (error) {
      console.error(`Connection attempt ${i + 1} failed:`, error);
    }
    
    if (i < MAX_RETRIES - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  isConnected = false;
  return false;
}

// Connection status getter
export const getConnectionStatus = () => isConnected;
supabase.auth.onAuthStateChange((event, session) => {
  try {
    if (event === 'SIGNED_OUT') {
      // Clear any cached data when user signs out
      AsyncStorage.clear().catch(error => {
        console.error('Error clearing AsyncStorage:', error);
      });
    }
  } catch (error) {
    console.error('Auth state change error:', error);
  }
});

// Add health check function
export async function checkSupabaseConnection() {
  try {
    const { error } = await supabase.from('profiles').select('count').limit(1);
    return !error;
  } catch {
    return false;
  }
}