declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
      EXPO_PUBLIC_WEB_URL: string;
      EXPO_PUBLIC_W3W_API_KEY: string;
    }
  }
}

export {};