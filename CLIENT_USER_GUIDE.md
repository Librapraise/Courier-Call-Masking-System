# Automated Calling System - User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Daily Workflow](#daily-workflow)
3. [Managing Customers](#managing-customers)
4. [Monitoring Calls](#monitoring-calls)
5. [System Settings](#system-settings)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Getting Started

### Logging In

1. Navigate to the system URL provided by your administrator
2. Enter your email address and password
3. Click "Sign In"
4. You will be redirected to either:
   - **Admin Dashboard** (if you're an administrator)
   - **Courier Dashboard** (if you're a courier)

### Understanding Your Role

- **Admin**: Can manage customers, view all call logs, configure settings, and reset the daily list
- **Courier**: Can view active customers and initiate calls to them

---

## Daily Workflow

### For Administrators

**Morning Setup (Start of Business Day):**

1. **Add Customers to Today's List**
   - Go to Customer Management page
   - Click "Add Customer"
   - Enter customer name and phone number (format: +1234567890)
   - Click "Add Customer"
   - Repeat for all customers you want to call today

2. **Verify System Status**
   - Check the Dashboard for system health indicators
   - Ensure Twilio and Database show as "Connected" (green)
   - Review today's statistics

**During the Day:**

- Monitor call logs to track call activity
- Check dashboard for real-time statistics
- Reactivate any customers that were accidentally deactivated

**End of Day:**

- The system automatically resets at midnight (Israel time)
- All customers are deactivated and call logs are archived
- No manual action required

### For Couriers

1. **View Active Customers**
   - Log in to see today's list of active customers
   - Customers are shown by name only (phone numbers are hidden for privacy)

2. **Initiate a Call**
   - Click the "Call" button next to the customer's name
   - Your phone will ring first
   - Answer your phone
   - You will be connected to the customer
   - The customer will see your business phone number (not your personal number)

---

## Managing Customers

### Adding a New Customer

1. Navigate to **Customer Management** page
2. Click the **"Add Customer"** button (blue button, top right)
3. Fill in the form:
   - **Name**: Customer's full name
   - **Phone Number**: Must be in E.164 format (e.g., +1234567890)
     - Must start with `+`
     - Include country code
     - No spaces or dashes
4. Click **"Add Customer"**
5. The customer will appear in the list with "Active" status

### Editing a Customer

1. Find the customer in the list
2. Click the **"Edit"** button (blue button)
3. Modify the name or phone number
4. Click **"Update Customer"**

### Deactivating a Customer

1. Find the active customer in the list
2. Click the **"Deactivate"** button (red button)
3. Confirm the action
4. Customer status changes to "Inactive"
5. Inactive customers cannot receive calls

### Reactivating a Customer

1. Find the inactive customer in the list (they will show "Inactive" status)
2. Click the **"Reactivate"** button (green button)
3. Customer status changes to "Active"
4. Customer can now receive calls again

### Bulk Operations

**To reactivate all customers at once:**
- Contact your system administrator to run a database query
- Or manually reactivate each customer using the Reactivate button

---

## Monitoring Calls

### Viewing Call Logs

1. Navigate to **Call Logs** page from the admin menu
2. View all call history with the following information:
   - Customer name
   - Masked phone number (last 4 digits only)
   - Agent who made the call
   - Call status
   - Call duration (if completed)
   - Timestamp
   - Error messages (if call failed)

### Filtering Call Logs

**By Status:**
- Use the "Status Filter" dropdown
- Options: All, Successful, Failed, Attempted, Ringing, Connected, Completed, No Answer, Busy

**By Date:**
- Use the "Date Range" dropdown
- Options: Today, Last 7 Days, All Time

### Understanding Call Statuses

- **attempted** - Call was initiated
- **ringing** - Phone is ringing
- **connected** - Call was answered
- **completed** - Call finished successfully
- **failed** - Call failed to connect
- **no-answer** - Call was not answered
- **busy** - Line was busy

### Exporting Call Logs

1. Go to **Call Logs** page
2. Apply any filters you want (optional)
3. Click **"Export CSV"** button (green button, top right)
4. A CSV file will download with all visible call logs
5. Open in Excel or Google Sheets for analysis

### Dashboard Statistics

The **Dashboard** page shows:
- **Total Calls Today**: Number of calls initiated today
- **Success Rate**: Percentage of successful calls
- **Average Duration**: Average call length in seconds
- **Active Customers**: Number of customers ready to receive calls
- **System Status**: Connection status of Twilio and database
- **Recent Activity**: Last 10 calls with details

---

## System Settings

### Accessing Settings

1. Navigate to **Settings** page from the admin menu
2. Modify any configuration as needed
3. Click **"Save Settings"** to apply changes

### Available Settings

**Daily Reset Configuration:**
- **Reset Time**: Time when automatic daily reset runs (24-hour format, e.g., 00:00)
- **Timezone**: Timezone for reset (default: Asia/Jerusalem)

**Incoming Call Handling:**
- **Behavior**: Choose how to handle customer callbacks
  - "Play Message": Plays a recorded message
  - "Block Call": Rejects the call
- **Message Text**: Customize the message played to callers

**Business Information:**
- **Business Phone Number**: The phone number shown as caller ID to customers

---

## Troubleshooting

### Calls Not Connecting

**Check System Health:**
1. Go to **Dashboard**
2. Verify both "Twilio Status" and "Database Status" show "Connected" (green)
3. If either shows "Disconnected" (red), contact your system administrator

**Review Call Logs:**
1. Go to **Call Logs** page
2. Filter by "Failed" status
3. Check error messages for specific issues

**Common Error Messages:**

- **"Twilio webhook URL must be publicly accessible"**
  - **Solution**: This is a development issue. Contact your system administrator. The system needs to be deployed to a public URL (not localhost).

- **"Courier phone number not configured"**
  - **Solution**: Add your phone number to your courier profile in Settings, or ask your administrator to set the COURIER_PHONE_NUMBER environment variable.

- **"Call failed"**
  - **Solution**: Check Twilio account balance and verify phone numbers are valid. Contact your system administrator if issues persist.

### Customers Not Showing

- Verify customers are marked as "Active" (green badge)
- Check if daily reset has run (customers are deactivated at midnight)
- Reactivate customers if needed using the "Reactivate" button

### Cannot Access Admin Features

- Verify you're logged in with an admin account
- Contact your system administrator to check your user role
- Only users with "admin" role can access admin features

### Daily Reset Not Working

- Check Settings page for reset time configuration
- Verify timezone is set correctly
- Manual reset is always available via "Reset List" button
- Contact administrator if automatic reset fails

---

## Best Practices

### Daily Operations

1. **Start of Day:**
   - Add all customers you plan to call today
   - Verify system is healthy (check dashboard)
   - Review any failed calls from previous day

2. **During the Day:**
   - Monitor call logs regularly
   - Reactivate customers if needed
   - Export call logs for record-keeping

3. **End of Day:**
   - Review today's call statistics
   - Export call logs if needed
   - System automatically resets at midnight

### Customer Management

- **Phone Number Format**: Always use E.164 format (+country code + number)
  - Example: +1234567890 (US number)
  - Example: +972501234567 (Israel number)
- **Deactivate vs Delete**: Use "Deactivate" to temporarily remove customers. They can be reactivated later.
- **Bulk Import**: For adding many customers, contact your administrator for bulk import options.

### Call Quality

- **Caller ID Masking**: Customers always see your business number, not the courier's personal number
- **Call Logging**: All calls are automatically logged with status, duration, and timestamps
- **Privacy**: Customer phone numbers are masked in logs (only last 4 digits shown)

### Security

- **Never share login credentials**
- **Log out when finished** (especially on shared computers)
- **Report suspicious activity** to your administrator immediately
- **Keep passwords secure** and change them regularly

---

## Quick Reference

### Keyboard Shortcuts
- None currently available

### Important URLs
- Login: `/login`
- Admin Dashboard: `/admin/dashboard`
- Customer Management: `/admin`
- Call Logs: `/admin/logs`
- Settings: `/admin/settings`
- User Guide: `/admin/guide`

### Support Contacts

**For Technical Issues:**
- Contact your system administrator
- Check the system health endpoint: `/api/health`
- Review error messages in call logs

**For Account Issues:**
- Contact your system administrator to:
  - Reset password
  - Change user role
  - Configure phone numbers
  - Set up new users

---

## Frequently Asked Questions

**Q: Can I call a customer multiple times in one day?**
A: Yes, you can initiate multiple calls to the same customer. Each call will be logged separately.

**Q: What happens if I deactivate a customer by mistake?**
A: Simply click the "Reactivate" button next to the customer's name to make them active again.

**Q: Can I see the customer's full phone number?**
A: Only administrators can see full phone numbers. Couriers only see customer names for privacy.

**Q: How do I know if a call was successful?**
A: Check the Call Logs page. Successful calls show status "completed" or "connected" with a green badge.

**Q: What time does the daily reset happen?**
A: By default, midnight Israel time (00:00). You can change this in Settings.

**Q: Can I recover call logs after the daily reset?**
A: Yes, call logs are archived before reset. Contact your administrator to access archived logs.

**Q: Why can't I see some customers?**
A: They may be inactive. Check the customer list and look for "Inactive" status badges. Reactivate them if needed.

**Q: How do I add my phone number as a courier?**
A: Go to Settings page (if you have access) or contact your administrator to add your phone number to your profile.

---

## Appendix

### Phone Number Format Examples

**United States:**
- Format: +1XXXXXXXXXX
- Example: +15551234567

**Israel:**
- Format: +972XXXXXXXXX
- Example: +972501234567

**United Kingdom:**
- Format: +44XXXXXXXXXX
- Example: +442071234567

**Always include:**
- `+` sign at the beginning
- Country code (no leading zero)
- Area code (if applicable)
- Phone number
- No spaces, dashes, or parentheses

### Call Status Flow

```
attempted → ringing → connected → completed
                ↓
            (if fails)
                ↓
         failed/no-answer/busy
```

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**For System Version:** Milestone 2

---

*This guide covers the basic operations of the Automated Calling System. For advanced features or technical support, please contact your system administrator.*

