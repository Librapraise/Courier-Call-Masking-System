'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { Customer } from '@/types/database'

export default function AdminPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({ name: '', phone_number: '' })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchCustomers()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(formData.phone_number)) {
      setMessage({ type: 'error', text: 'Please enter a valid phone number (E.164 format)' })
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone_number: formData.phone_number,
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
            phone_number: formData.phone_number,
            created_by: session.user.id,
          })

        if (error) throw error
        setMessage({ type: 'success', text: 'Customer added successfully!' })
      }

      setFormData({ name: '', phone_number: '' })
      setShowAddForm(false)
      setEditingCustomer(null)
      fetchCustomers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save customer' })
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({ name: customer.name, phone_number: customer.phone_number })
    setShowAddForm(true)
  }

  const handleDelete = async (customerId: string) => {
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const activeCustomers = customers.filter((c) => c.is_active)

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
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
            <button
              onClick={handleLogout}
              className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Customer Management</h2>
            <p className="mt-1 text-sm text-gray-600">
              Manage customers and their contact information
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm)
              setEditingCustomer(null)
              setFormData({ name: '', phone_number: '' })
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {showAddForm ? 'Cancel' : 'Add Customer'}
          </button>
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
                  Phone Number * (E.164 format, e.g., +1234567890)
                </label>
                <input
                  type="tel"
                  id="phone"
                  required
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="mt-1 block w-full rounded-md text-black border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="+1234567890"
                />
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
                    setFormData({ name: '', phone_number: '' })
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
          <h3 className="text-lg font-semibold text-gray-900">Today's Active Customers</h3>
          <p className="text-sm text-gray-600">
            {activeCustomers.length} active customer{activeCustomers.length !== 1 ? 's' : ''}
          </p>
        </div>

        {customers.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="text-gray-600">No customers found. Add your first customer above.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Phone Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {customer.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {customer.phone_number}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
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
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        {customer.is_active && (
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="rounded-md bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                          >
                            Remove
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

