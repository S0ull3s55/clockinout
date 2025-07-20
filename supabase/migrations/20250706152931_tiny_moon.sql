/*
  # Fix Employee Number Generation Function

  1. Changes
    - Replace the problematic recursive CTE with a more efficient approach
    - Fix infinite recursion issue
    - Improve performance for large datasets

  2. Function Logic
    - Get the highest existing employee number for current year
    - Increment by 1 or start at 1 if none exist
    - Format as YY-XXXX
*/

CREATE OR REPLACE FUNCTION public.generate_employee_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  year_code text;
  sequence_num int;
  emp_number text;
BEGIN
  -- Get current year (last 2 digits)
  year_code := to_char(CURRENT_DATE, 'YY');
  
  -- Get next sequence number - fixed to avoid infinite recursion
  -- and improved for performance
  SELECT COALESCE(
    (SELECT MAX(CAST(SUBSTRING(employee_number FROM 4) AS integer)) + 1
     FROM profiles
     WHERE employee_number LIKE year_code || '-%'
       AND employee_number ~ '^[0-9]{2}-[0-9]{4}$'), 
    1) INTO sequence_num;
  
  -- Generate employee number (format: YY-XXXX)
  emp_number := year_code || '-' || LPAD(sequence_num::text, 4, '0');
  
  RETURN emp_number;
END;
$function$;