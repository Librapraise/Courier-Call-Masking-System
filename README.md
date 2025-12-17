# Courier Call Masking System

A web-based system that allows couriers to call customers without seeing their phone numbers, using Twilio for masked calling and Supabase for the database.

## Features

- **Role-based Authentication**: Separate dashboards for couriers and admins
- **Call Masking**: Couriers can call customers without seeing their phone numbers
- **Customer Management**: Admins can add, edit, and deactivate customers
- **Call Logging**: All call attempts are logged for tracking
- **Row Level Security**: Database-level security ensures couriers never see phone numbers
- **Self-Service Phone Number**: Couriers can add/update their phone number during registration or in settings

## Tech Stack

- **Frontend**: Next.js 16 with React 19
- **Backend**: Next.js API routes (serverless functions)
- **Database**: Supabase (PostgreSQL)
- **Calling Service**: Twilio
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the SQL from `supabase/schema.sql`
3. Get your project URL and API keys from Settings > API

### 2. Twilio Setup

1. Create a Twilio account at [twilio.com](https://twilio.com)
2. Get your Account SID and Auth Token from the Twilio Console
3. Purchase a Twilio phone number
4. Configure your Twilio number to accept incoming calls

### 3. Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Fill in all the required values:
   - Supabase URL and keys
   - Twilio credentials
   - Application URL (for production, use your Vercel URL)

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

### 6. Create Test Users

1. Go to Supabase Dashboard > Authentication
2. Create a user account
3. In the SQL Editor, update the user's role:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
   ```
4. Create another user for courier role (default is 'courier')

## Database Schema

### Tables

- **profiles**: User profiles with roles (admin/courier)
- **customers**: Customer information (phone numbers hidden from couriers)
- **call_logs**: Call attempt tracking

### Row Level Security (RLS)

- Couriers can only SELECT customer names (not phone numbers)
- Admins have full CRUD access to customers
- All authenticated users can insert call logs

## API Documentation

Interactive API documentation is available at `/api-docs` when running the development server.

Visit `http://localhost:3000/api-docs` to view the Swagger UI documentation with:
- Complete API endpoint descriptions
- Request/response schemas
- Authentication requirements
- Example requests and responses
- Try-it-out functionality

### API Routes

#### POST /api/call/initiate

Initiates a masked call between courier and customer.

**Request Body:**
```json
{
  "customerId": "uuid",
  "accessToken": "jwt-token"
}
```

**Response:**
```json
{
  "success": true,
  "callSid": "CA...",
  "message": "Call initiated successfully"
}
```

#### POST /api/call/connect

Internal Twilio webhook endpoint (not for direct use).

## Deployment to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

**Important**: Update `NEXT_PUBLIC_APP_URL` in Vercel to your production URL.

## Security Notes

- Phone numbers are never sent to the frontend for courier role
- API routes verify user authentication and role
- Supabase RLS policies enforce data access at database level
- All secrets stored in environment variables

## Known Limitations

- Courier phone numbers need to be added to profiles table (currently using env variable)
- Basic phone number validation (E.164 format)
- No call recording or advanced call features

## Testing Checklist

- [ ] Create test admin and courier accounts
- [ ] Admin adds multiple test customers
- [ ] Courier logs in - verify phone numbers are NOT visible
- [ ] Courier clicks "Call" - verify Twilio call initiates
- [ ] Inspect network requests - verify no phone numbers exposed
- [ ] Admin removes customer - verify they don't appear in courier list
- [ ] Test on mobile device for responsiveness
