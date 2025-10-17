# Setup Guide

## Supabase Configuration Issues

### 400 Bad Request on Login

This error typically occurs due to:

1. **Email Confirmation Required**
   - By default, Supabase requires users to confirm their email before logging in
   - Solution: Disable email confirmation in Supabase Dashboard
   - Go to: Authentication > Settings > Email Auth > Disable "Enable email confirmations"

2. **User Doesn't Exist**
   - You're trying to log in with credentials that haven't been registered
   - Solution: Create an account first using the registration form

3. **Invalid Credentials**
   - Password must be at least 6 characters
   - Email must be valid format

### Steps to Fix

#### Option 1: Disable Email Confirmation (Recommended for Development)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `eixizsqppoxbuybgqbsi`
3. Navigate to **Authentication** > **Settings**
4. Under **Email Auth**, find **Enable email confirmations**
5. Toggle it **OFF**
6. Save changes

#### Option 2: Confirm Email Manually

1. Check your email inbox for confirmation email
2. Click the confirmation link
3. Try logging in again

#### Option 3: Use SQL to Confirm User Manually

Run this in Supabase SQL Editor:
```sql
-- Find your user
SELECT id, email, email_confirmed_at FROM auth.users;

-- Confirm the user manually (replace with your user id)
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'your-email@example.com';
```

### Database Setup

Make sure you've run the SQL scripts in order:

1. Run `scripts/001_create_tables.sql` in Supabase SQL Editor
2. Run `scripts/002_enable_rls.sql` in Supabase SQL Editor
3. Run `scripts/003_create_profile_trigger.sql` in Supabase SQL Editor

### Testing Authentication

Try creating a test user:
- Email: test@example.com
- Password: test123456
- Role: customer

Then try logging in with the same credentials.
