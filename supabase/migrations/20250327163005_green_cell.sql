/*
  # Add Geofencing Settings

  1. Changes
    - Add geofencing settings to companies table
    - Update time_records validation
    - Add location selection to time records

  2. Security
    - Maintain existing RLS policies
    - Add validation for location requirements
*/

-- Update companies settings with geofencing options
ALTER TABLE companies
ALTER COLUMN settings SET DEFAULT jsonb_build_object(
  'requireLocation', false,
  'allowRemoteWork', true,
  'geofencing', jsonb_build_object(
    'enabled', false,
    'strictMode', false,
    'defaultRadius', 100
  )
);

-- Add location validation function
CREATE OR REPLACE FUNCTION validate_time_record_location()
RETURNS TRIGGER AS $$
DECLARE
  company_settings jsonb;
BEGIN
  -- Get company settings
  SELECT c.settings INTO company_settings
  FROM companies c
  JOIN profiles p ON p.company_id = c.id
  WHERE p.id = NEW.user_id;

  -- Check if location is required
  IF (company_settings->>'requireLocation')::boolean = true THEN
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RAISE EXCEPTION 'Location is required for time records';
    END IF;
  END IF;

  -- Check geofencing if enabled and not in remote work mode
  IF (company_settings->'geofencing'->>'enabled')::boolean = true 
     AND (company_settings->>'allowRemoteWork')::boolean = false THEN
    IF NEW.location_id IS NULL THEN
      RAISE EXCEPTION 'Location selection is required when geofencing is enabled';
    END IF;
    
    -- Strict mode requires exact location match
    IF (company_settings->'geofencing'->>'strictMode')::boolean = true THEN
      IF NOT is_within_location_radius(NEW.latitude, NEW.longitude, NEW.location_id) THEN
        RAISE EXCEPTION 'You must be within the designated location radius to clock in/out';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for location validation
DROP TRIGGER IF EXISTS validate_time_record_location_trigger ON time_records;
CREATE TRIGGER validate_time_record_location_trigger
  BEFORE INSERT OR UPDATE ON time_records
  FOR EACH ROW
  EXECUTE FUNCTION validate_time_record_location();