'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import type { Customer, Profile } from '@/types/database'
import { formatPhoneForDisplay, formatPhoneForStorage, isValidPhoneFormat } from '@/lib/utils/phone'

export default function AdminPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [couriers, setCouriers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({ name: '', phone_number: '', assigned_courier_id: '' })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchCustomers()
    fetchCouriers()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    setCurrentUserId(session.user.id)

    // Verify user is an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/courier')
    }
  }

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setCustomers(data || [])
    } catch (err: any) {
      console.error('Error fetching customers:', err)
      setMessage({ type: 'error', text: 'Failed to fetch customers' })
    } finally {
      setLoading(false)
    }
  }

  const fetchCouriers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, phone_number, created_at')
        .eq('role', 'courier')
        .order('email', { ascending: true })

      if (error) {
        console.error('Error fetching couriers:', error)
        setMessage({ type: 'error', text: `Failed to load couriers: ${error.message}` })
        return
      }
      
      console.log('Fetched couriers:', data?.length || 0)
      setCouriers(data || [])
      
      if (!data || data.length === 0) {
        console.warn('No couriers found. Make sure you have courier accounts registered.')
      }
    } catch (err: any) {
      console.error('Error fetching couriers:', err)
      setMessage({ type: 'error', text: `Error loading couriers: ${err.message}` })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    // Validate phone number format
    if (!isValidPhoneFormat(formData.phone_number)) {
      setMessage({ type: 'error', text: 'Please enter a valid phone number' })
      return
    }
    
    // Format phone number for storage (adds +972 if needed)
    const formattedPhone = formatPhoneForStorage(formData.phone_number)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const assignedCourierId = formData.assigned_courier_id || null

      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone_number: formattedPhone,
            assigned_courier_id: assignedCourierId,
          })
          .eq('id', editingCustomer.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Customer updated successfully!' })
      } else {
        // Create new customer
        const { error } = await supabase
          .from('customers')
          .insert({
            name: formData.name,
            phone_number: formattedPhone,
            assigned_courier_id: assignedCourierId,
            created_by: session.user.id,
          })

        if (error) throw error
        setMessage({ type: 'success', text: 'Customer added successfully!' })
      }

      setFormData({ name: '', phone_number: '', assigned_courier_id: '' })
      setShowAddForm(false)
      setEditingCustomer(null)
      fetchCustomers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save customer' })
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({ 
      name: customer.name, 
      phone_number: formatPhoneForDisplay(customer.phone_number),
      assigned_courier_id: customer.assigned_courier_id || ''
    })
    setShowAddForm(true)
  }

  const handleAssignCourier = async (customerId: string, courierId: string | null) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ assigned_courier_id: courierId })
        .eq('id', customerId)

      if (error) throw error
      fetchCustomers()
      setMessage({ type: 'success', text: 'Customer assignment updated!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update assignment' })
    }
  }

  const handleDeleteCourier = async (courierId: string) => {
    // Prevent self-deletion
    if (currentUserId === courierId) {
      setMessage({ type: 'error', text: 'You cannot delete your own account' })
      return
    }

    if (!confirm('⚠️ WARNING: This will permanently delete this courier account and all associated data (call logs, customer assignments). This action cannot be undone. Are you sure?')) {
      return
    }

    try {
      // Get access token for API call
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setMessage({ type: 'error', text: 'Session expired. Please log in again.' })
        return
      }

      // Call API route that uses admin client to bypass RLS
      const response = await fetch('/api/admin/delete-courier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courierId,
          accessToken: session.access_token,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete courier')
      }

      setMessage({ type: 'success', text: 'Courier deleted successfully!' })
      fetchCouriers()
      fetchCustomers() // Refresh customers in case assignments changed
    } catch (err: any) {
      console.error('Error deleting courier:', err)
      setMessage({ type: 'error', text: err.message || 'Failed to delete courier' })
    }
  }

  const handleDeactivate = async (customerId: string) => {
    if (!confirm('Are you sure you want to deactivate this customer?')) return

    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', customerId)

      if (error) throw error
      setMessage({ type: 'success', text: 'Customer deactivated successfully!' })
      fetchCustomers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to deactivate customer' })
    }
  }

  const handleDelete = async (customerId: string) => {
    if (!confirm('⚠️ WARNING: This will permanently delete this customer and all associated call logs. This action cannot be undone. Are you sure?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)

      if (error) throw error
      setMessage({ type: 'success', text: 'Customer deleted permanently!' })
      fetchCustomers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete customer' })
    }
  }

  const handleReactivate = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: true })
        .eq('id', customerId)

      if (error) throw error
      setMessage({ type: 'success', text: 'Customer reactivated successfully!' })
      fetchCustomers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to reactivate customer' })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleReset = async () => {
    if (!confirm('⚠️ WARNING: This will clear all customers and cannot be undone. Are you sure?')) {
      return
    }

    setResetting(true)
    setMessage(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          accessToken: session.access_token,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Reset failed')
      }

      setMessage({ type: 'success', text: 'Daily reset completed successfully!' })
      fetchCustomers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to reset list' })
    } finally {
      setResetting(false)
    }
  }

  const activeCustomers = customers.filter((c) => c.is_active)
  
  // Filter customers based on search query
  const filteredCustomers = searchQuery.trim()
    ? customers.filter((customer) =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        formatPhoneForDisplay(customer.phone_number).toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : customers

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex lg:h-16 md:h-24 flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-3 sm:py-0">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Customer Management</h1>
            <div className="flex flex-wrap gap-2 sm:gap-4">
              <Link
                href="/admin/dashboard"
                className="rounded-md bg-blue-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/logs"
                className="rounded-md bg-gray-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-gray-700"
              >
                Call Logs
              </Link>
              <Link
                href="/admin/settings"
                className="rounded-md bg-gray-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-gray-700"
              >
                Settings
              </Link>
              <Link
                href="/admin/testing"
                className="rounded-md bg-gray-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-gray-700"
              >
                Testing
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md bg-gray-200 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Customer Management</h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              Manage customers and their contact information
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm)
                setEditingCustomer(null)
                setFormData({ name: '', phone_number: '', assigned_courier_id: '' })
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm sm:text-base text-white hover:bg-blue-700"
            >
              {showAddForm ? 'Cancel' : 'Add Customer'}
            </button>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm sm:text-base text-white hover:bg-red-700 disabled:bg-gray-400"
              title="Reset daily list - clears all customers"
            >
              {resetting ? 'Resetting...' : 'Reset List'}
            </button>
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

        {showAddForm && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md text-black border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number * (e.g., 050-123-4567)
                </label>
                <input
                  type="tel"
                  id="phone"
                  required
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="mt-1 block w-full rounded-md text-black border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="050-123-4567"
                />
              </div>
              <div>
                <label htmlFor="assigned_courier" className="block text-sm font-medium text-gray-700">
                  Assign to Courier (Optional)
                </label>
                <select
                  id="assigned_courier"
                  value={formData.assigned_courier_id}
                  onChange={(e) => setFormData({ ...formData, assigned_courier_id: e.target.value })}
                  className="mt-1 block w-full rounded-md text-black border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="">Unassigned (visible to all couriers)</option>
                  {couriers.length === 0 ? (
                    <option value="" disabled>No couriers available - Check console for errors</option>
                  ) : (
                    couriers.map((courier) => (
                      <option key={courier.id} value={courier.id}>
                        {courier.email}
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {couriers.length === 0 
                    ? 'No couriers found. Register courier accounts first. Check browser console for errors.'
                    : `Assign this customer to a specific courier. Unassigned customers are visible to all couriers. (${couriers.length} courier${couriers.length !== 1 ? 's' : ''} available)`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  {editingCustomer ? 'Update' : 'Add'} Customer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingCustomer(null)
                    setFormData({ name: '', phone_number: '', assigned_courier_id: '' })
                  }}
                  className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">All Customers</h3>
              <p className="text-sm text-gray-600">
                {activeCustomers.length} active, {customers.length - activeCustomers.length} inactive
                {searchQuery.trim() && ` • ${filteredCustomers.length} match${filteredCustomers.length !== 1 ? 'es' : ''}`}
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search customers by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-80 rounded-md border border-gray-300 px-4 py-2 text-black shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="text-gray-600">No customers found. Add your first customer above.</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="text-gray-600">No customers match your search "{searchQuery}".</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden sm:table-cell">
                    Phone Number
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Assigned Courier
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{customer.name}</span>
                        <span className="text-xs text-gray-500 sm:hidden mt-1">{formatPhoneForDisplay(customer.phone_number)}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-500">
                      {formatPhoneForDisplay(customer.phone_number)}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm">
                      <select
                        value={customer.assigned_courier_id || ''}
                        onChange={(e) => handleAssignCourier(customer.id, e.target.value || null)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-black focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        title="Quick assign courier"
                      >
                        <option value="">Unassigned</option>
                        {couriers.map((courier) => (
                          <option key={courier.id} value={courier.id}>
                            {courier.email}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                          customer.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {customer.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right text-sm">
                      <div className="flex flex-col sm:flex-row justify-end gap-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="rounded-md bg-blue-600 px-2 sm:px-3 py-1 text-xs sm:text-sm text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        {customer.is_active ? (
                          <>
                            <button
                              onClick={() => handleDeactivate(customer.id)}
                              className="rounded-md bg-orange-600 px-2 sm:px-3 py-1 text-xs sm:text-sm text-white hover:bg-orange-700"
                              title="Deactivate customer (can be reactivated later)"
                            >
                              Deactivate
                            </button>
                            <button
                              onClick={() => handleDelete(customer.id)}
                              className="rounded-md bg-red-600 px-2 sm:px-3 py-1 text-xs sm:text-sm text-white hover:bg-red-700"
                              title="Permanently delete customer"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleReactivate(customer.id)}
                              className="rounded-md bg-green-600 px-2 sm:px-3 py-1 text-xs sm:text-sm text-white hover:bg-green-700"
                            >
                              Reactivate
                            </button>
                            <button
                              onClick={() => handleDelete(customer.id)}
                              className="rounded-md bg-red-600 px-2 sm:px-3 py-1 text-xs sm:text-sm text-white hover:bg-red-700"
                              title="Permanently delete customer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Couriers Management Section */}
        <div className="mt-12">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Couriers Management</h3>
            <p className="text-sm text-gray-600">
              {couriers.length} courier{couriers.length !== 1 ? 's' : ''} registered
            </p>
          </div>

          {couriers.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center shadow">
              <p className="text-gray-600">No couriers found. Couriers will appear here once they register.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Email
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden sm:table-cell">
                      Phone Number
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hidden sm:table-cell">
                      Registered
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {couriers.map((courier) => {
                    const isCurrentUser = currentUserId === courier.id
                    return (
                      <tr key={courier.id}>
                        <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900">
                          <div className="flex flex-col">
                            <span>{courier.email}</span>
                            <span className="text-xs text-gray-500 sm:hidden mt-1">
                              {courier.phone_number ? formatPhoneForDisplay(courier.phone_number) : 'No phone'}
                            </span>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-500">
                          {courier.phone_number ? formatPhoneForDisplay(courier.phone_number) : 'Not set'}
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 text-sm text-gray-500">
                          {courier.created_at 
                            ? new Date(courier.created_at).toLocaleDateString()
                            : 'Unknown'}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-right text-sm">
                          <button
                            onClick={() => handleDeleteCourier(courier.id)}
                            disabled={isCurrentUser}
                            className="rounded-md bg-red-600 px-2 sm:px-3 py-1 text-xs sm:text-sm text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            title={isCurrentUser ? 'You cannot delete your own account' : 'Permanently delete courier'}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}


