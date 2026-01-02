'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { formatPhoneForDisplay, formatPhoneForStorage, isValidPhoneFormat } from '@/lib/utils/phone'
import Navigation from '@/components/Navigation'

export default function CourierSettingsPage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchProfile()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // Verify user is a courier
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'courier') {
      router.push('/admin')
    }
  }

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', session.user.id)
        .single()

      if (error) throw error
      setPhoneNumber(formatPhoneForDisplay(profile?.phone_number || ''))
    } catch (err: any) {
      console.error('Error fetching profile:', err)
      setMessage({ type: 'error', text: 'Failed to load profile' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    // Validate phone number format
    if (phoneNumber && !isValidPhoneFormat(phoneNumber)) {
      setMessage({ type: 'error', text: 'Please enter a valid phone number' })
      setSaving(false)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Format phone number for storage (adds +972 if needed)
      const formattedPhone = phoneNumber.trim() ? formatPhoneForStorage(phoneNumber) : null

      const { error } = await supabase
        .from('profiles')
        .update({ phone_number: formattedPhone })
        .eq('id', session.user.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Phone number updated successfully!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update phone number' })
    } finally {
      setSaving(false)
    }
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
        title="Courier Settings"
        links={[
          { href: '/courier', label: 'Back to Dashboard', isPrimary: true },
        ]}
      />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-4 sm:p-6 shadow">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Profile Settings</h2>

          {message && (
            <div
              className={`mb-4 rounded-md p-4 ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                Phone Number <span className="text-gray-500">(Required for calls)</span>
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="050-123-4567"
              />
              <p className="mt-1 text-sm text-gray-500">
                Your phone number is required to make calls to customers. Enter your Israeli phone number (e.g., 050-123-4567)
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

