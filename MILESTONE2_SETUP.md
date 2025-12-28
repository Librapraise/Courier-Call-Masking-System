# Milestone 2 Setup Instructions

## Overview
Milestone 2 adds comprehensive call routing, logging, daily reset functionality, and production-ready features to the automated calling system.

## Database Migration

Run the new migration to add enhanced call logging, settings, and archiving:

```sql
-- Run this in your Supabase SQL editor
-- File: supabase/migration_milestone2.sql
```

This migration adds:
- Enhanced `call_logs` table with all required fields
- `settings` table for system configuration
- `archived_calls` table for daily reset archiving
- Helper functions for phone masking and timestamps

## Environment Variables

Ensure these environment variables are set:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Application URL (must be publicly accessible for Twilio webhooks)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Supabase (already configured from Milestone 1)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional: For cron job authentication
CRON_SECRET=your_secret_token_for_cron_jobs
```

## Installing Dependencies

```bash
npm install
```

This will install `node-cron` and its types for the daily reset functionality.

## Twilio Webhook Configuration

### 1. Incoming Call Webhook
In your Twilio Console, configure the phone number's Voice webhook:
- **URL**: `https://your-domain.com/api/call/incoming`
- **Method**: POST

### 2. Status Callback
Status callbacks are automatically configured when initiating calls, but you can also set a default in Twilio Console:
- **URL**: `https://your-domain.com/api/call/status`
- **Method**: POST

## Daily Reset Configuration

The system includes two ways to run the daily reset:

### Option 1: Automated Cron Job (Recommended for Production)
For production deployments, use your hosting platform's cron job feature:

**Vercel Cron Jobs** (if using Vercel):
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/admin/reset",
    "schedule": "0 21 * * *"
  }]
}
```

**Other Platforms**:
Set up a cron job to call:
```
POST https://your-domain.com/api/admin/reset
Header: X-Cron-Secret: your_cron_secret
```

### Option 2: Manual Reset
Use the "Reset List" button in the admin panel (Customer Management page).

## Testing

1. Navigate to `/admin/testing` in the admin panel
2. Click "Run All Tests" to verify all functionality
3. Review test results and fix any issues

## New Features

### Admin Dashboard (`/admin/dashboard`)
- Today's call statistics
- Success rate and average duration
- System health status
- Recent call activity

### Call Logs (`/admin/logs`)
- View all call logs with filtering
- Filter by status and date range
- Export logs as CSV
- Summary statistics

### Settings (`/admin/settings`)
- Configure daily reset time
- Set incoming call behavior
- Customize incoming call message
- Set business phone number

### Testing Suite (`/admin/testing`)
- 8 comprehensive test scenarios
- Run all tests or individual tests
- Verify system functionality

### User Guide (`/admin/guide`)
- Complete admin user documentation
- Step-by-step instructions
- Troubleshooting guide

## API Endpoints

### New Endpoints

- `POST /api/call/incoming` - Handles incoming calls (plays message)
- `POST /api/call/status` - Receives Twilio call status updates
- `POST /api/admin/reset` - Daily reset endpoint (admin only)
- `GET /api/health` - System health check

### Updated Endpoints

- `POST /api/call/initiate` - Enhanced with comprehensive logging and status callbacks
- `POST /api/call/connect` - Enhanced with caller ID masking and validation

## Security Features

1. **Webhook Validation**: All Twilio webhooks are validated using signature verification
2. **Phone Masking**: Customer phone numbers are masked in logs (last 4 digits only)
3. **Authentication**: All admin endpoints require authentication
4. **Environment Variables**: Sensitive data stored in environment variables

## Production Checklist

Before going live:

- [ ] Run database migration
- [ ] Set all environment variables
- [ ] Configure Twilio webhooks
- [ ] Set up daily reset cron job
- [ ] Test all functionality using testing suite
- [ ] Configure settings (reset time, incoming call message)
- [ ] Verify caller ID masking works
- [ ] Test incoming call handling
- [ ] Review call logs functionality
- [ ] Export test CSV to verify format

## Troubleshooting

### Calls Not Connecting
1. Check `/api/health` endpoint for system status
2. Verify Twilio credentials are correct
3. Ensure webhook URL is publicly accessible
4. Check call logs for error messages

### Daily Reset Not Running
1. Verify cron job is configured correctly
2. Check CRON_SECRET matches in environment
3. Review server logs for errors
4. Use manual reset button as fallback

### Webhook Validation Failing
1. Ensure TWILIO_AUTH_TOKEN is set correctly
2. Check that webhook URL matches Twilio configuration
3. Verify request is coming from Twilio (check IP if needed)

## Support

For issues or questions:
1. Check the admin user guide at `/admin/guide`
2. Review call logs for error details
3. Use the testing suite to identify issues
4. Check system health endpoint

