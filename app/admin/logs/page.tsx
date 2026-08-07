'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import type { CallLog } from '@/types/database'
import Navigation from '@/components/Navigation'

export default function CallLogsPage() {
  const [logs, setLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('today')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
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
    const headers = ['Customer Name', 'Phone (Masked)', 'Agent', 'Status', 'Duration (s)', 'Timestamp', 'Error', 'Recording URL']
    const rows = logs.map(log => [
      log.customer_name || '',
      log.customer_phone_masked || '',
      log.agent_name || '',
      log.call_status,
      log.call_duration?.toString() || '',
      log.call_timestamp ? new Date(log.call_timestamp).toLocaleString() : '',
      log.error_message || '',
      log.recording_url || '',
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

  const handleDeleteRecording = async (log: CallLog) => {
    if (!log.recording_sid) return
    setDeletingId(log.id)
    setConfirmDeleteId(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/call/recording', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: log.id,
          recordingSid: log.recording_sid,
          accessToken: session?.access_token,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        console.error('[Admin] Failed to delete recording:', result.error)
        alert(`Failed to delete recording: ${result.error}`)
        return
      }
      // Optimistically remove the recording from local state
      setLogs(prev => prev.map(l =>
        l.id === log.id
          ? { ...l, recording_url: null, recording_sid: null, recording_duration: null }
          : l
      ))
    } catch (err: any) {
      console.error('[Admin] Error deleting recording:', err)
      alert('An unexpected error occurred while deleting the recording.')
    } finally {
      setDeletingId(null)
    }
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
      <Navigation
        title="Call Logs"
        links={[
          { href: '/admin/dashboard', label: 'Dashboard', isPrimary: true },
          { href: '/admin', label: 'Customers' },
          { href: '/admin/feedback', label: 'Feedback' },
          { href: '/admin/settings', label: 'Settings' },
          { href: '/admin/testing', label: 'Testing' },
          { href: '/admin/guide', label: 'Guide' },
        ]}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Call Logs</h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              View and export call history
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="rounded-md bg-green-600 px-4 py-2 text-sm sm:text-base text-white hover:bg-green-700"
          >
            Export CSV
          </button>
        </div>

        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-lg bg-white p-3 sm:p-4 shadow">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Total Calls</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">{totalCalls}</p>
          </div>
          <div className="rounded-lg bg-white p-3 sm:p-4 shadow">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Successful</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-green-600">{successfulCalls}</p>
          </div>
          <div className="rounded-lg bg-white p-3 sm:p-4 shadow">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Failed</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-red-600">{failedCalls}</p>
          </div>
          <div className="rounded-lg bg-white p-3 sm:p-4 shadow">
            <p className="text-xs sm:text-sm font-medium text-gray-600">Success Rate</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-blue-600">{successRate}%</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="status-filter" className="block text-xs sm:text-sm font-medium text-gray-700">
              Status Filter
            </label>
            <select
              id="status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="mt-1 block w-full text-gray-500 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
          <div className="flex-1">
            <label htmlFor="date-filter" className="block text-xs sm:text-sm font-medium text-gray-700">
              Date Range
            </label>
            <select
              id="date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="mt-1 block w-full text-gray-500 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden md:table-cell">
                  Phone (Masked)
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden lg:table-cell">
                  Agent
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden sm:table-cell">
                  Duration
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Recording
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden lg:table-cell">
                  Timestamp
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden xl:table-cell">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500">
                    No call logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{log.customer_name || 'Unknown'}</span>
                        <span className="text-xs text-gray-500 md:hidden mt-1">{log.customer_phone_masked || '-'}</span>
                        <span className="text-xs text-gray-500 lg:hidden mt-1">{log.agent_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-500">
                      {log.customer_phone_masked || '-'}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 text-sm text-gray-500">
                      {log.agent_name || 'Unknown'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm">
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${getStatusColor(log.call_status)}`}>
                        {log.call_status}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-500">
                      {log.call_duration ? `${log.call_duration}s` : '-'}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm">
                      {log.recording_url ? (
                        <div className="flex items-center gap-2">
                          <audio
                            controls
                            src={log.recording_url}
                            preload="none"
                            className="h-8 max-w-[200px] sm:max-w-[240px]"
                          />
                          {confirmDeleteId === log.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteRecording(log)}
                                disabled={deletingId === log.id}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                title="Confirm delete"
                              >
                                {deletingId === log.id ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(log.id)}
                              disabled={deletingId === log.id}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 flex-shrink-0"
                              title="Delete recording"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">No recording</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 text-sm text-gray-500">
                      {log.call_timestamp
                        ? new Date(log.call_timestamp).toLocaleString()
                        : '-'}
                    </td>
                    <td className="hidden xl:table-cell px-6 py-4 text-sm text-gray-500">
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

