/*
  # Add Companies Support

  1. New Tables
    - companies
      - Basic company information and settings
      - Branding configuration
    - company_locations
      - Multiple locations per company
      - Geofencing support

  2. Changes
    - Update profiles table to link with companies
    - Add company-specific settings

  3. Security
    - Company-specific RLS policies
    - Location-based access control
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#007AFF',
  secondary_color text DEFAULT '#FF3B30',
  created_at timestamptz DEFAULT now(),
  settings jsonb DEFAULT '{}'::jsonb,
  subscription_status text DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'suspended')),
  subscription_ends_at timestamptz
);

-- Create company_locations table
CREATE TABLE IF NOT EXISTS company_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  radius numeric(10,2) DEFAULT 100, -- Geofencing radius in meters
  created_at timestamptz DEFAULT now()
);

-- Add company_id to profiles
ALTER TABLE profiles 
ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
ADD COLUMN location_id uuid REFERENCES company_locations(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Super admins can manage all companies"
  ON companies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Company admins can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND company_id = companies.id
    )
  );

-- Locations policies
CREATE POLICY "Company users can view their locations"
  ON company_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND company_id = company_locations.company_id
    )
  );

CREATE POLICY "Company admins can manage their locations"
  ON company_locations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND company_id = company_locations.company_id 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Update time_records to include location
ALTER TABLE time_records
ADD COLUMN location_id uuid REFERENCES company_locations(id) ON DELETE SET NULL;

-- Function to check if a point is within a location's radius
CREATE OR REPLACE FUNCTION is_within_location_radius(
  point_lat numeric,
  point_lng numeric,
  loc_id uuid
) RETURNS boolean AS $$
DECLARE
  location_record RECORD;
  distance numeric;
BEGIN
  SELECT * INTO location_record FROM company_locations WHERE id = loc_id;
  
  IF location_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- Calculate distance using the Haversine formula
  SELECT
    6371000 * 2 * ASIN(
      SQRT(
        POWER(SIN((point_lat - location_record.latitude) * PI() / 180 / 2), 2) +
        COS(point_lat * PI() / 180) *
        COS(location_record.latitude * PI() / 180) *
        POWER(SIN((point_lng - location_record.longitude) * PI() / 180 / 2), 2)
      )
    ) INTO distance;
  
  RETURN distance <= location_record.radius;
END;
$$ LANGUAGE plpgsql;

-- Add check constraint to ensure clock in/out is within location radius
ALTER TABLE time_records
ADD CONSTRAINT check_location_radius
CHECK (
  location_id IS NULL OR
  is_within_location_radius(latitude, longitude, location_id)
);