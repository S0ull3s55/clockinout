import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'expo-router',
    },
  },
});

// Add error handling and retry logic for auth state changes
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