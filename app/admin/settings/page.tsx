'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import type { Setting } from '@/types/database'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchSettings()
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

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')

      if (error) throw error

      const settingsMap: Record<string, string> = {}
      data?.forEach(setting => {
        settingsMap[setting.key] = setting.value
      })
      setSettings(settingsMap)
    } catch (err: any) {
      console.error('Error fetching settings:', err)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Update each setting
      const updates = Object.entries(settings).map(([key, value]) =>
        supabase
          .from('settings')
          .update({ value, updated_by: session.user.id })
          .eq('key', key)
      )

      await Promise.all(updates)

      setMessage({ type: 'success', text: 'Settings saved successfully!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
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
              <Link
                href="/admin/logs"
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Call Logs
              </Link>
              <Link
                href="/admin/guide"
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Guide
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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
          <p className="mt-1 text-sm text-gray-600">
            Configure system behavior and preferences
          </p>
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

        <div className="space-y-6">
          {/* Daily Reset Settings */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Reset Configuration</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="reset-time" className="block text-sm font-medium text-gray-700">
                  Reset Time (HH:MM, 24-hour format)
                </label>
                <input
                  type="text"
                  id="reset-time"
                  value={settings.daily_reset_time || '00:00'}
                  onChange={(e) => handleChange('daily_reset_time', e.target.value)}
                  placeholder="00:00"
                  pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Time when daily reset runs (Israel timezone)
                </p>
              </div>
              <div>
                <label htmlFor="reset-timezone" className="block text-sm font-medium text-gray-700">
                  Timezone
                </label>
                <input
                  type="text"
                  id="reset-timezone"
                  value={settings.daily_reset_timezone || 'Asia/Jerusalem'}
                  onChange={(e) => handleChange('daily_reset_timezone', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Incoming Call Settings */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Incoming Call Handling</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="incoming-behavior" className="block text-sm font-medium text-gray-700">
                  Behavior
                </label>
                <select
                  id="incoming-behavior"
                  value={settings.incoming_call_behavior || 'message'}
                  onChange={(e) => handleChange('incoming_call_behavior', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="message">Play Message</option>
                  <option value="block">Block Call</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  How to handle incoming calls to the business number
                </p>
              </div>
              <div>
                <label htmlFor="incoming-message" className="block text-sm font-medium text-gray-700">
                  Message Text
                </label>
                <textarea
                  id="incoming-message"
                  value={settings.incoming_call_message || ''}
                  onChange={(e) => handleChange('incoming_call_message', e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="This number is for outbound calls only..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Message to play when customers call back
                </p>
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="business-phone" className="block text-sm font-medium text-gray-700">
                  Business Phone Number
                </label>
                <input
                  type="text"
                  id="business-phone"
                  value={settings.business_phone_number || ''}
                  onChange={(e) => handleChange('business_phone_number', e.target.value)}
                  placeholder="+1234567890"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Phone number shown as caller ID to customers
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

