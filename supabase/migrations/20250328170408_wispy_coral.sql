/*
  # Add Super Admin User

  1. Changes
    - Create initial super admin user
    - Set up authentication and profile

  Note: The password will be 'superadmin123' - this should be changed after first login
*/

-- Create the super admin user
DO $$
DECLARE
  super_admin_id uuid;
BEGIN
  -- Check if super admin already exists
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = 'super.admin@company.com'
  ) THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'super.admin@company.com',
      crypt('superadmin123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO super_admin_id;

    -- Insert into profiles
    INSERT INTO profiles (
      id,
      email,
      role,
      created_at
    )
    VALUES (
      super_admin_id,
      'super.admin@company.com',
      'super_admin',
      now()
    );
  END IF;
END $$;