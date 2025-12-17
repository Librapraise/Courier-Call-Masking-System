# Setup Guide for Courier Call Masking System

## Prerequisites

- Node.js 18+ installed
- Supabase account
- Twilio account with a phone number

## Step-by-Step Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for the database to be ready

2. **Run Database Schema**
   - Go to SQL Editor in Supabase Dashboard
   - Copy and paste the entire contents of `supabase/schema.sql`
   - Click "Run" to execute

3. **Configure Authentication Settings** (Important!)
   - Go to **Authentication** → **Providers** → **Email**
   - **Disable "Confirm email"** for development (uncheck the toggle)
   - This allows users to log in immediately after registration without email confirmation
   - For production, you can enable this for better security
   - Save the changes

4. **Get Supabase Credentials**
   - Go to **Settings** (gear icon in left sidebar) → **API**
   - You'll see a section called "Project API keys"
   - Copy the following:
     - **Project URL** (looks like `https://xxxxxxxxxxxxx.supabase.co`) 
       → Use for `NEXT_PUBLIC_SUPABASE_URL`
     - **anon public** key (starts with `eyJ...`)
       → Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role** key (starts with `eyJ...`, click "Reveal" to see it)
       → Use for `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret! Never expose in frontend)

### 4. Twilio Setup

1. **Create Twilio Account**
   - Go to [twilio.com](https://twilio.com)
   - Sign up for an account
   - Verify your phone number

2. **Get Twilio Phone Number**
   - Go to Phone Numbers > Manage > Buy a number
   - Purchase a phone number (choose one that supports voice calls)
   - Note the phone number (E.164 format, e.g., +1234567890)

3. **Get Twilio Credentials**
   - Go to Console Dashboard
   - Copy:
     - Account SID → `TWILIO_ACCOUNT_SID`
     - Auth Token → `TWILIO_AUTH_TOKEN`
     - Phone Number → `TWILIO_PHONE_NUMBER`

### 5. Environment Variables

1. **Create `.env.local` file** in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

2. **For Production (Vercel)**, add these same variables in Vercel Dashboard > Settings > Environment Variables
   - Update `NEXT_PUBLIC_APP_URL` to your Vercel URL (e.g., `https://your-app.vercel.app`)

### 6. Create Test Users

1. **Create Admin User**
   - Go to Supabase Dashboard > Authentication
   - Click "Add user" > "Create new user"
   - Enter email and password
   - Copy the user ID (UUID)

2. **Set Admin Role**
   - Go to SQL Editor
   - Run:
     ```sql
     UPDATE profiles 
     SET role = 'admin' 
     WHERE id = 'your-user-id-here';
     ```

3. **Create Courier User**
   - **Option 1**: Use the registration form at `/register` - couriers can add their phone number during signup!
   - **Option 2**: Create manually in Authentication, then set phone number:
     ```sql
     UPDATE profiles 
     SET phone_number = '+1234567890' 
     WHERE id = 'courier-user-id-here';
     ```
   - (Default role is 'courier', so no need to update)
   
   **Note**: Couriers can add or update their phone number:
   - During registration (optional field)
   - In their settings page at `/courier/settings` after logging in

### 7. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with your admin or courier account.

## Testing the System

1. **As Admin:**
   - Log in with admin credentials
   - Add a test customer with name and phone number
   - Verify customer appears in the list

2. **As Courier:**
   - Log in with courier credentials
   - Verify you can see customer names but NOT phone numbers
   - Click "Call" button
   - Verify Twilio initiates the call

3. **Verify Security:**
   - Open browser DevTools > Network tab
   - As courier, try to call a customer
   - Verify no phone numbers appear in any API responses

## Troubleshooting

### Calls Not Working

1. **Check Twilio Credentials**
   - Verify all Twilio env variables are correct
   - Check Twilio Console for error logs

2. **Check Courier Phone Number**
   - Ensure courier has a phone_number in profiles table
   - Phone number must be in E.164 format (+1234567890)

3. **Check Twilio Webhook URL**
   - For production, ensure `NEXT_PUBLIC_APP_URL` is correct
   - Twilio needs to reach `/api/call/connect` endpoint

### Database Issues

1. **RLS Policies Not Working**
   - Verify schema.sql was run completely
   - Check Supabase Dashboard > Authentication > Policies

2. **Users Can't See Data**
   - Verify user role is set correctly in profiles table
   - Check RLS policies are enabled

### Authentication Issues

1. **Can't Log In**
   - Verify user exists in Supabase Auth
   - Check email/password are correct
   - Verify profile was created (check profiles table)

## Production Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add all environment variables
   - Deploy

3. **Update Twilio Webhook**
   - Update `NEXT_PUBLIC_APP_URL` in Vercel to your production URL
   - Redeploy if needed

## Next Steps

After Milestone 1 is complete:
- Add courier phone number management UI
- Add call history view
- Add more call status tracking
- Improve error handling and user feedback

