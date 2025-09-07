import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  settings: {
    requireLocation?: boolean;
    allowRemoteWork?: boolean;
    workHours?: {
      start: string;
      end: string;
    };
  };
}

export interface CompanyLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLocations = async () => {
    try {
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profile?.company_id) {
        const { data: locationData } = await supabase
          .from('company_locations')
          .select('*')
          .eq('company_id', profile.company_id);

        if (locationData) {
          setLocations(locationData);
        }
      }
    } catch (err) {
      console.error('Error refreshing locations:', err);
    }
  };

  useEffect(() => {
    async function loadCompanyData() {
      try {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          setError('Supabase client not available');
          setLoading(false);
          return;
        }

        // Set default company data for demo purposes
        const defaultCompany: Company = {
          id: 'demo-company',
          name: 'The Cleaning Method Limited',
          logo_url: 'https://images.pexels.com/photos/4099354/pexels-photo-4099354.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2',
          primary_color: '#007AFF',
          secondary_color: '#FF3B30',
          settings: {
            requireLocation: false,
            allowRemoteWork: true,
            workHours: {
              start: '09:00',
              end: '17:00'
            }
          }
        };

        setCompany(defaultCompany);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

          if (profile?.company_id) {
            // Try to load actual company data
            const { data: companyData } = await supabase
              .from('companies')
              .select('*')
              .eq('id', profile.company_id)
              .single();

            if (companyData) {
              setCompany(companyData);
            }

            // Load company locations
            const { data: locationData } = await supabase
              .from('company_locations')
              .select('*')
              .eq('company_id', profile.company_id);

            if (locationData) {
              setLocations(locationData);
            }
          }
        }
      } catch (err) {
        console.error('Error loading company data:', err);
        setError('Error loading company data');
      } finally {
        setLoading(false);
      }
    }

    loadCompanyData();
  }, []);

  return { company, locations, loading, error, refreshLocations };
}