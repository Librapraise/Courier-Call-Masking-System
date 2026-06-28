'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import Navigation from '@/components/Navigation'
import type { Feedback } from '@/types/database'

export default function AdminFeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchFeedback()
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

  const fetchFeedback = async () => {
    try {
      setLoading(true)
      // Query feedback joining customers and profiles (couriers) tables
      const { data, error } = await supabase
        .from('feedback')
        .select(`
          id,
          customer_id,
          courier_id,
          delivery_time_rating,
          product_quality_rating,
          comment,
          created_at,
          customers (
            name
          ),
          profiles (
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        customer_id: item.customer_id,
        courier_id: item.courier_id,
        delivery_time_rating: item.delivery_time_rating,
        product_quality_rating: item.product_quality_rating,
        comment: item.comment,
        created_at: item.created_at,
        customer_name: item.customers?.name || 'Unknown',
        courier_email: item.profiles?.email || 'Unassigned',
      }))

      setFeedbackList(formatted)
    } catch (err: any) {
      console.error('Error fetching feedback:', err)
      setMessage({ type: 'error', text: err.message || 'Failed to load feedback records' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this feedback record?')) return

    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Feedback record deleted successfully!' })
      setFeedbackList(prev => prev.filter(item => item.id !== id))
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete feedback' })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5 text-yellow-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400' : 'text-gray-200 fill-none'}`}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11.48 3.499c.158-.326.628-.326.786 0l2.635 5.337 5.886.856c.36.052.504.497.244.75l-4.258 4.148 1.006 5.86c.061.357-.315.63-.63.462L12 18.18l-5.268 2.768c-.315.168-.691-.105-.63-.463l1.006-5.86L2.85 11.192c-.26-.252-.117-.697.244-.75l5.886-.856 2.635-5.337z"
            />
          </svg>
        ))}
      </div>
    )
  }

  // Calculate statistics
  const totalReviews = feedbackList.length
  const avgDeliveryRating = totalReviews > 0
    ? (feedbackList.reduce((sum, item) => sum + item.delivery_time_rating, 0) / totalReviews).toFixed(1)
    : '0.0'
  
  const avgProductRating = totalReviews > 0
    ? (feedbackList.reduce((sum, item) => sum + item.product_quality_rating, 0) / totalReviews).toFixed(1)
    : '0.0'

  const overallAvg = totalReviews > 0
    ? ((parseFloat(avgDeliveryRating) + parseFloat(avgProductRating)) / 2).toFixed(1)
    : '0.0'

  // Filter feedback list based on search query
  const filteredFeedback = searchQuery.trim()
    ? feedbackList.filter(item =>
        item.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.courier_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.comment?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : feedbackList

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading feedback reviews...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        title="Customer Feedback"
        links={[
          { href: '/admin/dashboard', label: 'Dashboard', isPrimary: true },
          { href: '/admin', label: 'Customers' },
          { href: '/admin/logs', label: 'Call Logs' },
          { href: '/admin/settings', label: 'Settings' },
          { href: '/admin/guide', label: 'Guide' },
        ]}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Customer Reviews</h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              Monitor customer feedback about products and courier services
            </p>
          </div>
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

        {/* Stats Section */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-6 shadow border border-gray-100">
            <p className="text-sm font-semibold text-gray-500">Total Feedbacks</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{totalReviews}</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow border border-gray-100">
            <p className="text-sm font-semibold text-gray-500">Overall Rating</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{overallAvg}</span>
              <span className="text-sm text-gray-400">/ 5.0</span>
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow border border-gray-100">
            <p className="text-sm font-semibold text-gray-500">Delivery & Service Avg</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-cyan-600">{avgDeliveryRating}</span>
              <span className="text-sm text-gray-400">/ 5.0</span>
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow border border-gray-100">
            <p className="text-sm font-semibold text-gray-500">Product Quality Avg</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-indigo-600">{avgProductRating}</span>
              <span className="text-sm text-gray-400">/ 5.0</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by customer name, courier email, or comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-black text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Reviews Table */}
        <div className="overflow-x-auto rounded-xl bg-white shadow border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Courier
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Delivery Speed
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Product Quality
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Comment
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Submitted At
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredFeedback.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    {searchQuery.trim() ? 'No reviews match your query' : 'No customer reviews recorded yet'}
                  </td>
                </tr>
              ) : (
                filteredFeedback.map((feedback) => (
                  <tr key={feedback.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {feedback.customer_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">
                      {feedback.courier_email}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col gap-1">
                        {renderStars(feedback.delivery_time_rating)}
                        <span className="text-xs font-medium text-gray-400">({feedback.delivery_time_rating} / 5)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col gap-1">
                        {renderStars(feedback.product_quality_rating)}
                        <span className="text-xs font-medium text-gray-400">({feedback.product_quality_rating} / 5)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs break-words">
                      {feedback.comment || <span className="text-gray-300 italic">No comment left</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(feedback.created_at).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => handleDelete(feedback.id)}
                        className="rounded-md bg-red-50 text-red-600 px-3 py-1.5 hover:bg-red-100 transition-colors font-medium text-xs"
                      >
                        Delete
                      </button>
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
