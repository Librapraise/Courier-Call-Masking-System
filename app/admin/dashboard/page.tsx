'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import type { CallLog } from '@/types/database'

interface DashboardStats {
  totalCallsToday: number
  successfulCalls: number
  failedCalls: number
  averageDuration: number
  activeCustomers: number
  recentCalls: CallLog[]
  systemStatus: {
    twilio_connected: boolean
    database_connected: boolean
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [nextResetTime, setNextResetTime] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchDashboardData()
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

  const fetchDashboardData = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      // Fetch today's call logs
      const { data: callLogs, error: logsError } = await supabase
        .from('call_logs')
        .select('*')
        .gte('call_timestamp', todayISO)
        .order('call_timestamp', { ascending: false })

      if (logsError) throw logsError

      // Fetch active customers count
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)

      if (customersError) throw customersError

      // Fetch system health
      const healthResponse = await fetch('/api/health')
      const health = await healthResponse.json()

      // Calculate statistics
      const totalCalls = callLogs?.length || 0
      const successfulCalls = callLogs?.filter(log => 
        ['completed', 'connected'].includes(log.call_status)
      ).length || 0
      const failedCalls = callLogs?.filter(log => 
        ['failed', 'no-answer', 'busy'].includes(log.call_status)
      ).length || 0

      const completedCalls = callLogs?.filter(log => 
        log.call_status === 'completed' && log.call_duration
      ) || []
      const avgDuration = completedCalls.length > 0
        ? Math.round(
            completedCalls.reduce((sum, log) => sum + (log.call_duration || 0), 0) /
            completedCalls.length
          )
        : 0

      // Get next reset time
      const { data: resetSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'last_reset_date')
        .single()

      setStats({
        totalCallsToday: totalCalls,
        successfulCalls,
        failedCalls,
        averageDuration: avgDuration,
        activeCustomers: customers?.length || 0,
        recentCalls: callLogs?.slice(0, 10) || [],
        systemStatus: {
          twilio_connected: health.twilio_connected || false,
          database_connected: health.database_connected || false,
        },
      })

      // Calculate next reset time
      const { data: timeSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'daily_reset_time')
        .single()

      const resetTime = timeSetting?.value || '00:00'
      const [hours, minutes] = resetTime.split(':').map(Number)
      const nextReset = new Date()
      nextReset.setHours(hours, minutes, 0, 0)
      if (nextReset <= new Date()) {
        nextReset.setDate(nextReset.getDate() + 1)
      }
      setNextResetTime(nextReset.toLocaleString('en-US', { 
        timeZone: 'Asia/Jerusalem',
        dateStyle: 'short',
        timeStyle: 'short'
      }))
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Failed to load dashboard</p>
      </div>
    )
  }

  const successRate = stats.totalCallsToday > 0
    ? Math.round((stats.successfulCalls / stats.totalCallsToday) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
            <div className="flex gap-4">
              <Link
                href="/admin"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage Customers
              </Link>
              <Link
                href="/admin/logs"
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Call Logs
              </Link>
              <Link
                href="/admin/settings"
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Settings
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

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
          <p className="mt-1 text-sm text-gray-600">Today's call statistics and system status</p>
        </div>

        {/* System Status */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={`rounded-lg p-4 ${
            stats.systemStatus.twilio_connected ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <p className="text-sm font-medium text-gray-600">Twilio Status</p>
            <p className={`text-lg font-semibold ${
              stats.systemStatus.twilio_connected ? 'text-green-800' : 'text-red-800'
            }`}>
              {stats.systemStatus.twilio_connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div className={`rounded-lg p-4 ${
            stats.systemStatus.database_connected ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <p className="text-sm font-medium text-gray-600">Database Status</p>
            <p className={`text-lg font-semibold ${
              stats.systemStatus.database_connected ? 'text-green-800' : 'text-red-800'
            }`}>
              {stats.systemStatus.database_connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm font-medium text-gray-600">Total Calls Today</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalCallsToday}</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm font-medium text-gray-600">Success Rate</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{successRate}%</p>
            <p className="mt-1 text-xs text-gray-500">
              {stats.successfulCalls} successful / {stats.failedCalls} failed
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm font-medium text-gray-600">Avg. Duration</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {stats.averageDuration > 0 ? `${stats.averageDuration}s` : 'N/A'}
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-sm font-medium text-gray-600">Active Customers</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.activeCustomers}</p>
          </div>
        </div>

        {/* Next Reset Time */}
        {nextResetTime && (
          <div className="mb-6 rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              Next Daily Reset: {nextResetTime} (Israel Time)
            </p>
          </div>
        )}

        {/* Recent Calls */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Call Activity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {stats.recentCalls.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No calls today
                    </td>
                  </tr>
                ) : (
                  stats.recentCalls.map((call) => (
                    <tr key={call.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {call.customer_name || 'Unknown'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {call.agent_name || 'Unknown'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                            call.call_status === 'completed' || call.call_status === 'connected'
                              ? 'bg-green-100 text-green-800'
                              : call.call_status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {call.call_status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {call.call_duration ? `${call.call_duration}s` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {call.call_timestamp
                          ? new Date(call.call_timestamp).toLocaleTimeString()
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

