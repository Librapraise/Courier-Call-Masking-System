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
  const [isSyncing, setIsSyncing] = useState(false)
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
      
      let query = supabase
        .from('call_logs')
        .select('*')

      if (filter !== 'all') {
        if (filter === 'success') {
          query = query.in('call_status', ['completed', 'connected'])
        } else if (filter === 'failed') {
          query = query.in('call_status', ['failed', 'no-answer', 'busy'])
        } else {
          query = query.eq('call_status', filter)
        }
      }

      if (dateFilter !== 'all') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        let startDate: Date

        if (dateFilter === 'today') {
          startDate = today
        } else {
          startDate = new Date(today)
          startDate.setDate(today.getDate() - 7)
        }

        query = query.gte('created_at', startDate.toISOString())
      }

      query = query.order('created_at', { ascending: false }).limit(1000)

      const { data, error } = await query

      if (error) {
        console.error('Supabase query error:', error)
        throw new Error(error.message || 'Failed to fetch call logs')
      }
      
      setLogs(data || [])
    } catch (err: any) {
      console.error('Error fetching logs:', err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const handleSyncTwilio = async () => {
    try {
      setIsSyncing(true)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/sync-logs', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        }
      })
      const data = await res.json()
      if (res.ok) {
        await fetchLogs()
      } else {
        alert(`Sync failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      console.error('Sync error:', err)
    } finally {
      setIsSyncing(false)
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
      const response = await fetch('/api/call/recording', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId: log.id,
          recordingSid: log.recording_sid,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        alert(result.error || 'Failed to delete recording')
        return
      }
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
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncTwilio}
              disabled={isSyncing}
              className="inline-flex items-center rounded-md border border-blue-600 bg-blue-50 px-4 py-2 text-sm sm:text-base font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync with Twilio'}
            </button>
            <button
              onClick={handleExportCSV}
              className="rounded-md bg-green-600 px-4 py-2 text-sm sm:text-base text-white hover:bg-green-700"
            >
              Export CSV
            </button>
          </div>
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
                            src={`/api/call/recording/stream/${log.id}`}
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
                              className="text-gray-400 hover:text-red-600 p-1"
                              title="Delete recording"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No recording</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 text-sm text-gray-500">
                      {log.call_timestamp ? new Date(log.call_timestamp).toLocaleString() : '-'}
                    </td>
                    <td className="hidden xl:table-cell px-6 py-4 text-sm text-red-600">
                      {log.error_message || '-'}
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
