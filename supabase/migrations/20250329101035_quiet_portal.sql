/*
  # Enhance User Profiles

  1. Changes
    - Add employee number to profiles
    - Add additional user details
    - Add audit fields

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS employee_number text UNIQUE,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS hire_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Create function to generate employee number
CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS text AS $$
DECLARE
  company_code text;
  year_code text;
  sequence_num int;
  emp_number text;
BEGIN
  -- Get current year (last 2 digits)
  year_code := to_char(CURRENT_DATE, 'YY');
  
  -- Get next sequence number
  WITH RECURSIVE sequence AS (
    SELECT 1 as num
    UNION ALL
    SELECT num + 1
    FROM sequence
    WHERE num < 9999
  )
  SELECT num INTO sequence_num
  FROM sequence
  WHERE NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE employee_number LIKE '%' || LPAD(num::text, 4, '0')
  )
  LIMIT 1;

  -- Generate employee number (format: YY-XXXX)
  emp_number := year_code || '-' || LPAD(sequence_num::text, 4, '0');
  
  RETURN emp_number;
END;
$$ LANGUAGE plpgsql;