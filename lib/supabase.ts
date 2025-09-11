import { createClient } from '@supabase/supabase-js';

// Safe environment variable access for static rendering
const getEnvVar = (key: string, fallback: string = '') => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
};

const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    }) : null;