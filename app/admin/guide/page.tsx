'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function AdminGuide() {
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/courier')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Admin User Guide</h1>
            <div className="flex gap-4">
              <Link
                href="/admin/dashboard"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Dashboard
              </Link>
              <Link
                href="/admin"
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Customers
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin User Guide</h1>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Getting Started</h2>
            <p className="text-gray-700 mb-4">
              Welcome to the automated calling system admin panel. This guide will help you manage
              customers, initiate calls, and monitor system activity.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Adding Customers to Daily List</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Navigate to the <strong>Customer Management</strong> page from the dashboard</li>
              <li>Click the <strong>"Add Customer"</strong> button</li>
              <li>Enter the customer's name and phone number (E.164 format: +1234567890)</li>
              <li>Click <strong>"Add Customer"</strong> to save</li>
              <li>The customer will appear in the active customers list</li>
            </ol>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Tip:</strong> Only active customers can receive calls. Use the "Remove" button to
                deactivate customers without deleting them.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Initiating Calls</h2>
            <p className="text-gray-700 mb-4">
              Calls are initiated by couriers from their dashboard. As an admin, you can:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>View call logs to see all call activity</li>
              <li>Monitor call success rates and statistics</li>
              <li>Check system health and status</li>
            </ul>
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-900">
                <strong>Note:</strong> The system uses caller ID masking. Customers will see your business
                phone number, not the courier's personal number.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Viewing Call Logs</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Go to the <strong>Call Logs</strong> page from the navigation menu</li>
              <li>Use the status filter to view specific call types (successful, failed, etc.)</li>
              <li>Use the date range filter to view calls from different time periods</li>
              <li>Click <strong>"Export CSV"</strong> to download call logs for reporting</li>
            </ol>
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-900 font-semibold">
                <strong>Call Statuses:</strong>
              </p>
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li className="text-green-800 font-medium"><strong>attempted</strong> - Call was initiated</li>
                <li className="text-green-800 font-medium"><strong>ringing</strong> - Phone is ringing</li>
                <li className="text-green-800 font-medium"><strong>connected</strong> - Call was answered</li>
                <li className="text-green-800 font-medium"><strong>completed</strong> - Call finished successfully</li>
                <li className="text-green-800 font-medium"><strong>failed</strong> - Call failed to connect</li>
                <li className="text-green-800 font-medium"><strong>no-answer</strong> - Call was not answered</li>
                <li className="text-green-800 font-medium"><strong>busy</strong> - Line was busy</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Resetting the Daily List</h2>
            <p className="text-gray-700 mb-4">
              The system automatically resets at midnight (Israel time) each day. You can also manually
              reset the list:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Go to the <strong>Customer Management</strong> page</li>
              <li>Click the <strong>"Reset List"</strong> button (red button in the top right)</li>
              <li>Confirm the warning message</li>
              <li>The system will archive all call logs and deactivate all customers</li>
            </ol>
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-900">
                <strong>⚠️ Warning:</strong> Resetting the list cannot be undone. All customers will be
                deactivated and call logs will be archived. Only use this for testing or emergency situations.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Configuring Settings</h2>
            <p className="text-gray-700 mb-4">
              Access the <strong>Settings</strong> page to configure:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Daily Reset Time:</strong> When the automatic reset runs (default: 00:00)</li>
              <li><strong>Incoming Call Behavior:</strong> How to handle customer callbacks (play message or block)</li>
              <li><strong>Incoming Call Message:</strong> Customize the message played to callers</li>
              <li><strong>Business Phone Number:</strong> The number shown as caller ID to customers</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Troubleshooting Failed Calls</h2>
            <p className="text-gray-700 mb-4">
              If calls are failing, check the following:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Check the <strong>Dashboard</strong> for system status (Twilio and database connections)</li>
              <li>Review <strong>Call Logs</strong> to see error messages for failed calls</li>
              <li>Verify Twilio credentials are configured in environment variables</li>
              <li>Ensure the webhook URL is publicly accessible (not localhost)</li>
              <li>Check that courier phone numbers are configured correctly</li>
            </ol>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-900 font-semibold">
                <strong>Common Issues:</strong>
              </p>
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li className="text-gray-800 font-medium"><strong>"Twilio webhook URL must be publicly accessible"</strong> - Deploy to a public URL or use ngrok for local testing</li>
                <li className="text-gray-800 font-medium"><strong>"Courier phone number not configured"</strong> - Add phone number to courier profile or set COURIER_PHONE_NUMBER env var</li>
                <li className="text-gray-800 font-medium"><strong>"Call failed"</strong> - Check Twilio account balance and phone number validity</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Dashboard Overview</h2>
            <p className="text-gray-700 mb-4">
              The dashboard provides a quick overview of:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Today's Statistics:</strong> Total calls, success rate, average duration</li>
              <li><strong>Active Customers:</strong> Number of customers ready to receive calls</li>
              <li><strong>System Status:</strong> Twilio and database connection status</li>
              <li><strong>Recent Activity:</strong> Last 10 calls with status and details</li>
              <li><strong>Next Reset Time:</strong> When the automatic daily reset will run</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Testing the System</h2>
            <p className="text-gray-700 mb-4">
              Use the <strong>Testing Suite</strong> page to verify all functionality:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Navigate to the Testing page (accessible from admin menu)</li>
              <li>Click <strong>"Run All Tests"</strong> to execute all test scenarios</li>
              <li>Or run individual tests to check specific functionality</li>
              <li>Review test results and fix any issues before going live</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Best Practices</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Add customers at the start of each business day</li>
              <li>Monitor the dashboard regularly to ensure system health</li>
              <li>Export call logs weekly for record-keeping</li>
              <li>Review failed calls daily and address issues promptly</li>
              <li>Test the system after any configuration changes</li>
              <li>Keep Twilio account credentials secure and never commit them to code</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Need Help?</h2>
            <p className="text-gray-700 mb-4">
              If you encounter issues not covered in this guide:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Check the system health endpoint: <code className="bg-gray-100 px-2 py-1 rounded">/api/health</code></li>
              <li>Review call logs for detailed error messages</li>
              <li>Verify all environment variables are set correctly</li>
              <li>Contact your system administrator for technical support</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}

