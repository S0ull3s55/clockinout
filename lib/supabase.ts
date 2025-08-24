import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const supabase = typeof window !== 'undefined'
  ? createClient(process.env.EXPO_PUBLIC_SUPABASE_URL || '', process.env.EXPO_PUBLIC_ANON_KEY || '')
  : null;
