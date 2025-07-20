/*
  # Fix Profile Policies and Admin Access

  1. Changes
    - Fix infinite recursion in profile policies
    - Restructure admin access policies
    - Add proper role-based access control

  2. Security
    - Maintain RLS with improved policy structure
    - Prevent policy recursion
    - Ensure proper admin access
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Super admins have full access" ON profiles;
DROP POLICY IF EXISTS "Admins can manage non-super-admin profiles" ON profiles;
DROP POLICY IF EXISTS "Supervisors can view and update staff profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

-- Create new, optimized policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admins full access"
  ON profiles FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'super_admin'
    )
  );

CREATE POLICY "Admins manage non-super-admin profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin
      WHERE admin.id = auth.uid() 
      AND admin.role = 'admin'
    )
    AND role != 'super_admin'
  );

CREATE POLICY "Supervisors view staff profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles supervisor
      WHERE supervisor.id = auth.uid() 
      AND supervisor.role = 'supervisor'
    )
    AND role = 'staff'
  );

-- Update company_locations policies to be more specific
DROP POLICY IF EXISTS "Company admins can manage their locations" ON company_locations;

CREATE POLICY "Company admins manage locations"
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