'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import type { CallLog } from '@/types/database'

export default function CallLogsPage() {
  const [logs, setLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('today')
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchLogs()
  }, [filter, dateFilter])

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

  const fetchLogs = async () => {
    try {
      setLoading(true)
      
      // Start with a simple query to test access
      let query = supabase
        .from('call_logs')
        .select('*')

      // Apply status filter first (simpler)
      if (filter !== 'all') {
        if (filter === 'success') {
          query = query.in('call_status', ['completed', 'connected'])
        } else if (filter === 'failed') {
          query = query.in('call_status', ['failed', 'no-answer', 'busy'])
        } else {
          query = query.eq('call_status', filter)
        }
      }

      // Calculate date range and apply filter
      if (dateFilter !== 'all') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        let startDate: Date

        if (dateFilter === 'today') {
          startDate = today
        } else {
          // week
          startDate = new Date(today)
          startDate.setDate(today.getDate() - 7)
        }

        // Use created_at for filtering (guaranteed to exist)
        // If call_timestamp exists and has values, we can filter by it in post-processing
        query = query.gte('created_at', startDate.toISOString())
      }

      // Order by created_at (always exists)
      query = query.order('created_at', { ascending: false }).limit(1000)

      const { data, error } = await query

      if (error) {
        // Better error logging for Supabase errors
        const errorInfo = {
          message: error.message || 'Unknown error',
          details: error.details || 'No details',
          hint: error.hint || 'No hint',
          code: error.code || 'No code',
        }
        console.error('Supabase query error:', errorInfo)
        console.error('Raw error object keys:', Object.keys(error))
        
        // Check if it's a column/table issue
        if (error.message?.includes('column') || error.code === 'PGRST116') {
          console.warn('Possible migration issue: Column or table may not exist. Please run migration_milestone2.sql')
        }
        
        throw new Error(error.message || 'Failed to fetch call logs')
      }
      
      setLogs(data || [])
    } catch (err: any) {
      console.error('Error fetching logs:', err)
      
      // Try to extract meaningful error message
      const errorMessage = err?.message || err?.toString() || 'Unknown error occurred'
      console.error('Error message:', errorMessage)
      
      // Set empty array on error to prevent UI crash
      setLogs([])
      
      // Optionally show error to user (you can add a toast/alert here)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    const headers = ['Customer Name', 'Phone (Masked)', 'Agent', 'Status', 'Duration (s)', 'Timestamp', 'Error']
    const rows = logs.map(log => [
      log.customer_name || '',
      log.customer_phone_masked || '',
      log.agent_name || '',
      log.call_status,
      log.call_duration?.toString() || '',
      log.call_timestamp ? new Date(log.call_timestamp).toLocaleString() : '',
      log.error_message || '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call-logs-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getStatusColor = (status: string) => {
    if (status === 'completed' || status === 'connected') {
      return 'bg-green-100 text-green-800'
    }
    if (status === 'failed' || status === 'no-answer' || status === 'busy') {
      return 'bg-red-100 text-red-800'
    }
    if (status === 'ringing' || status === 'attempted') {
      return 'bg-yellow-100 text-yellow-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  // Calculate summary stats
  const totalCalls = logs.length
  const successfulCalls = logs.filter(log => 
    ['completed', 'connected'].includes(log.call_status)
  ).length
  const failedCalls = logs.filter(log => 
    ['failed', 'no-answer', 'busy'].includes(log.call_status)
  ).length
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Loading call logs...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Call Logs</h1>
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Call Logs</h2>
            <p className="mt-1 text-sm text-gray-600">
              View and export call history
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            Export CSV
          </button>
        </div>

        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm font-medium text-gray-600">Total Calls</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totalCalls}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm font-medium text-gray-600">Successful</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{successfulCalls}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm font-medium text-gray-600">Failed</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{failedCalls}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm font-medium text-gray-600">Success Rate</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{successRate}%</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">
              Status Filter
            </label>
            <select
              id="status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="mt-1 block rounded-md text-gray-500 border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="success">Successful</option>
              <option value="failed">Failed</option>
              <option value="attempted">Attempted</option>
              <option value="ringing">Ringing</option>
              <option value="connected">Connected</option>
              <option value="completed">Completed</option>
              <option value="no-answer">No Answer</option>
              <option value="busy">Busy</option>
            </select>
          </div>
          <div>
            <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700">
              Date Range
            </label>
            <select
              id="date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="mt-1 block rounded-md text-gray-500 border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Phone (Masked)
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
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    No call logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {log.customer_name || 'Unknown'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {log.customer_phone_masked || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {log.agent_name || 'Unknown'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${getStatusColor(log.call_status)}`}>
                        {log.call_status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {log.call_duration ? `${log.call_duration}s` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {log.call_timestamp
                        ? new Date(log.call_timestamp).toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.error_message ? (
                        <span className="text-red-600" title={log.error_message}>
                          {log.error_message.length > 50
                            ? log.error_message.substring(0, 50) + '...'
                            : log.error_message}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

