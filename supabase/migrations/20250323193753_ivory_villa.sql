/*
  # Update Roles System

  1. Changes
    - Modify profiles table to support new roles
    - Update existing RLS policies to accommodate new role hierarchy
    - Add new policies for supervisors

  2. Security
    - Maintain RLS with updated role-based permissions
    - Implement hierarchical access control
*/

-- Update the role check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'supervisor', 'staff'));

-- Update existing roles to 'staff'
UPDATE profiles SET role = 'staff' WHERE role = 'employee';

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;

-- Create new profile policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Super admins have full access"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage non-super-admin profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      WHERE p1.id = auth.uid() AND p1.role = 'admin'
    ) AND
    (SELECT role FROM profiles p2 WHERE p2.id = profiles.id) != 'super_admin'
  );

CREATE POLICY "Supervisors can view and update staff profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    ) AND
    role = 'staff'
  );

-- Update time_records policies
DROP POLICY IF EXISTS "Admins can read all time records" ON time_records;
DROP POLICY IF EXISTS "Admins can delete time records" ON time_records;

CREATE POLICY "Super admins have full access to time records"
  ON time_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage all time records"
  ON time_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Supervisors can view staff time records"
  ON time_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      WHERE p1.id = auth.uid() AND p1.role = 'supervisor'
    ) AND
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = time_records.user_id AND p2.role = 'staff'
    )
  );