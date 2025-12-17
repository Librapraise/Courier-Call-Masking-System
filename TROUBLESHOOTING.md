# Troubleshooting Guide

## Email Confirmation Issues

### Problem: "Email not confirmed" error when logging in

**Solution 1: Disable Email Confirmation (Recommended for Development)**

1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Find the **"Confirm email"** toggle
4. **Turn it OFF** (uncheck it)
5. Save changes
6. Now users can log in immediately after registration

**Solution 2: Confirm Email Manually (For Testing)**

If you want to keep email confirmation enabled:

1. After registration, check your email inbox
2. Look for the confirmation email from Supabase
3. Click the confirmation link
4. Then try logging in again

**Solution 3: Confirm Email via Supabase Dashboard**

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Find the user you just created
3. Click on the user
4. Click **"Confirm email"** button
5. The user can now log in

## Other Common Issues

### Twilio Configuration Errors

**Error: "accountSid must start with AC"**
- Make sure `TWILIO_ACCOUNT_SID` in `.env.local` starts with "AC"
- Get your Account SID from Twilio Console Dashboard
- Format: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Error: "Twilio configuration is missing"**
- Check that all Twilio environment variables are set in `.env.local`
- Required variables:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`

### Database/RLS Issues

**Error: "permission denied for table"**
- Make sure you ran the `schema.sql` file completely
- Check that RLS policies are created (run `supabase/verify.sql`)
- Verify user role is set correctly in profiles table

**Error: "relation does not exist"**
- Run the `schema.sql` file in Supabase SQL Editor
- Check that tables were created (go to Table Editor)

### Authentication Issues

**Error: "Invalid login credentials"**
- Double-check email and password
- Make sure user exists in Supabase Auth
- If email confirmation is enabled, verify the email first

**Error: "User not found"**
- User might not have a profile created
- Check profiles table in Supabase
- The trigger should create it automatically, but you can create manually:
  ```sql
  INSERT INTO profiles (id, email, role)
  VALUES ('user-uuid-here', 'user@example.com', 'courier');
  ```

### Call Functionality Issues

**Error: "Courier phone number not configured"**
- Add phone number to courier's profile:
  ```sql
  UPDATE profiles 
  SET phone_number = '+1234567890' 
  WHERE id = 'courier-user-id';
  ```
- Or set `COURIER_PHONE_NUMBER` in `.env.local` as fallback

**Calls not connecting**

**Error: "Twilio webhook URL must be publicly accessible"**
- Twilio cannot reach `localhost` URLs for webhooks
- For local development, use **ngrok** to expose your localhost:
  1. Install ngrok: `npm install -g ngrok` or download from ngrok.com
  2. Run: `ngrok http 3000` (or your port)
  3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
  4. Update `.env.local`: `NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io`
  5. Restart your dev server
- For production, ensure `NEXT_PUBLIC_APP_URL` points to your deployed URL (e.g., `https://your-app.vercel.app`)

**Other call issues:**
- Verify Twilio phone number is correct format (E.164: +1234567890)
- Check Twilio Console for call logs and errors
- Ensure courier phone number is set in profiles table

## Still Having Issues?

1. Check browser console for errors
2. Check server logs (terminal where `npm run dev` is running)
3. Check Supabase logs (Dashboard → Logs)
4. Check Twilio logs (Console → Monitor → Logs)

