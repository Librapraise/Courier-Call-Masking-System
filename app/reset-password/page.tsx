'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { EyeIcon, EyeOffIcon, CheckIcon } from '@/components/crm/CrmIcons'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if recovery session or token is active
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setReady(true)
    }

    checkSession()

    // Listen to auth state changes (e.g. PASSWORD_RECOVERY event)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.')
      return
    }

    setLoading(true)

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password
      })

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Your reset link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 py-12 selection:bg-[#5D6BB2]/20 font-sans">
      <div className="w-full max-w-[480px] space-y-6">
        {/* Header Block */}
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-bold text-[#1E2238] tracking-tight leading-tight">
            Create new password
          </h1>
          <p className="mt-2.5 text-sm sm:text-[15px] text-[#64748B] leading-relaxed">
            Please enter your new password below to regain access to Persian Team Management.
          </p>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-800">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800 flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-600" />
            <span>Password updated successfully! Redirecting you to login...</span>
          </div>
        )}

        {/* Form */}
        {!success ? (
          <form className="space-y-5" onSubmit={handleUpdatePassword}>
            {/* New Password */}
            <div className="space-y-2">
              <label htmlFor="newPassword" className="block text-sm font-medium text-[#1E293B]">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 pr-11 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition duration-150 focus:border-[#5D6BB2] focus:outline-none focus:ring-4 focus:ring-[#5D6BB2]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#94A3B8] hover:text-[#64748B] transition cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeIcon className="w-5 h-5" /> : <EyeOffIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#1E293B]">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition duration-150 focus:border-[#5D6BB2] focus:outline-none focus:ring-4 focus:ring-[#5D6BB2]/10"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center px-9 py-3 rounded-lg bg-[#5D6BB2] hover:bg-[#4E5CA1] text-white text-sm font-semibold shadow-xs transition duration-150 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Update Password'}
              </button>

              <Link
                href="/login"
                className="text-sm font-semibold text-[#64748B] hover:text-[#1E2238] transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        ) : (
          <div className="pt-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full px-9 py-3 rounded-lg bg-[#1E2235] text-white text-sm font-semibold hover:bg-[#4352E8] transition"
            >
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
