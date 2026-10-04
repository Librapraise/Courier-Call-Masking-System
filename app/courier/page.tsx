'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import type { CustomerPublic } from '@/types/database'
import Navigation from '@/components/Navigation'

export default function CourierPage() {
  const [customers, setCustomers] = useState<CustomerPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [calling, setCalling] = useState<string | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [courierEmail, setCourierEmail] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    loadCourierDeliveries()
  }, [])

  const loadCourierDeliveries = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login?redirectTo=/courier')
        return
      }

      setCourierEmail(session.user.email || '')

      // Verify user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile && profile.role !== 'courier') {
        // If an admin lands on /courier, redirect to /crm or /admin
        router.push('/crm')
        return
      }

      // Security: Fetch ONLY customers assigned to this courier via dedicated API
      const response = await fetch('/api/courier/customers', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      })

      if (response.ok) {
        const result = await response.json()
        setCustomers(result.customers || [])
      } else {
        // Fallback: direct Supabase query strictly scoped to session.user.id
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, is_active, is_completed, created_at')
          .eq('is_active', true)
          .eq('assigned_courier_id', session.user.id)
          .order('name', { ascending: true })

        if (error) throw error
        setCustomers(data || [])
      }
    } catch (err: any) {
      console.error('Error fetching assigned courier deliveries:', err)
      setMessage({ type: 'error', text: 'Error loading assigned deliveries' })
    } finally {
      setLoading(false)
    }
  }

  const handleCall = async (customerId: string) => {
    setCalling(customerId)
    setMessage(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/call/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          customerId,
          accessToken: session.access_token, // Pass access token explicitly
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to initiate call')
      }

      setMessage({ type: 'success', text: 'Call initiated successfully!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to initiate call' })
    } finally {
      setCalling(null)
    }
  }

  const handleComplete = async (customerId: string) => {
    setCompleting(customerId)
    setMessage(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/delivery/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          accessToken: session.access_token,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete delivery')
      }

      // Update customer state locally to mark completed
      setCustomers(prev =>
        prev.map(c => c.id === customerId ? { ...c, is_completed: true } : c)
      )

      if (result.whatsAppSent) {
        setMessage({ type: 'success', text: 'Delivery completed successfully and feedback WhatsApp sent to customer!' })
      } else if (result.smsSent) {
        setMessage({ type: 'success', text: 'Delivery completed successfully and feedback SMS sent to customer!' })
      } else {
        const errorDetail = result.whatsAppError || result.smsError || 'Unknown Twilio error'
        setMessage({
          type: 'success',
          text: `Delivery completed successfully! (Note: SMS and WhatsApp failed to send: ${errorDetail})`,
        })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to complete delivery' })
    } finally {
      setCompleting(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        title="Courier Dashboard"
        links={[
          { href: '/courier/settings', label: 'Settings', isPrimary: true },
        ]}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Assigned Deliveries</h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              Only customers assigned specifically to your queue are visible here. Click "Call" to initiate a masked call.
            </p>
          </div>
          {courierEmail && (
            <div className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Courier: <strong className="text-slate-800">{courierEmail}</strong></span>
            </div>
          )}
        </div>

        {message && (
          <div
            className={`mb-4 rounded-md p-4 ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {customers.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900">No Deliveries Assigned Yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Your queue is currently clear. Once your Persian Team dispatcher assigns delivery orders to your account, they will automatically appear here with one-tap masked calling.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Customer Name
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">
                      {customer.name}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right text-sm">
                      <div className="flex flex-row justify-end items-center gap-2">
                        <button
                          onClick={() => handleCall(customer.id)}
                          disabled={calling === customer.id}
                          className="w-full sm:w-auto rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400"
                        >
                          {calling === customer.id ? 'Calling...' : 'Call'}
                        </button>
                        {customer.is_completed ? (
                          <button
                            disabled
                            className="w-full sm:w-auto rounded-md bg-green-100 border border-green-300 px-4 py-2 text-sm text-green-800 font-semibold cursor-not-allowed flex items-center justify-center gap-1"
                          >
                            <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Completed
                          </button>
                        ) : (
                          <button
                            onClick={() => handleComplete(customer.id)}
                            disabled={completing === customer.id}
                            className="w-full sm:w-auto rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400"
                          >
                            {completing === customer.id ? 'Completing...' : 'Completed'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

