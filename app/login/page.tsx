'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { EyeIcon, EyeOffIcon } from '@/components/crm/CrmIcons'
import { GhostCrmLogoIcon } from '@/components/crm/GhostCrmLogo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfoMessage(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) throw signInError

      if (data.user) {
        // Fetch user profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle()

        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
        const redirectTo = params?.get('redirectTo')

        if (profile?.role === 'admin') {
          router.push(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/crm')
        } else {
          router.push('/courier')
        }
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)
    setError(null)
    setInfoMessage(null)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to dispatch password reset link.')
      }

      setResetSent(true)
      setInfoMessage(`A password reset link has been dispatched to ${email.trim()}. Please check your inbox and spam folder.`)
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 py-12 selection:bg-[#5D6BB2]/20 font-sans">
      <div className="w-full max-w-[480px] space-y-6">
        {/* Header Block */}
        <div>
          <div className="mb-5">
            <GhostCrmLogoIcon className="w-12 h-12 drop-shadow-md" />
          </div>
          <h1 className="text-[32px] sm:text-[36px] font-bold text-[#1E2238] tracking-tight leading-tight">
            {isForgotPasswordMode ? 'Reset your password' : 'Sign in to your account'}
          </h1>
          <p className="mt-2.5 text-sm sm:text-[15px] text-[#64748B] leading-relaxed">
            {isForgotPasswordMode ? (
              <>
                Enter your account email to receive a password reset link. Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordMode(false)
                    setError(null)
                    setInfoMessage(null)
                  }}
                  className="font-semibold text-[#5D6BB2] hover:text-[#4A559E] transition cursor-pointer"
                >
                  Back to Login
                </button>
              </>
            ) : (
              <>
                Log in to Persian Team Management to access dispatches and operations. Don’t have an account yet?{' '}
                <Link
                  href="/register"
                  className="font-semibold text-[#5D6BB2] hover:text-[#4A559E] transition cursor-pointer"
                >
                  Sign Up
                </Link>
              </>
            )}
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-800">
            {error}
          </div>
        )}
        {infoMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800">
            {infoMessage}
          </div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {isForgotPasswordMode ? (
          <form className="space-y-5" onSubmit={handleForgotPasswordSubmit}>
            <div className="space-y-2">
              <label htmlFor="reset-email" className="block text-sm font-medium text-[#1E293B]">
                Registered Email Address
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition duration-150 focus:border-[#5D6BB2] focus:outline-none focus:ring-4 focus:ring-[#5D6BB2]/10"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="submit"
                disabled={loading || resetSent}
                className="inline-flex items-center justify-center px-9 py-3 rounded-lg bg-[#5D6BB2] hover:bg-[#4E5CA1] text-white text-sm font-semibold shadow-xs transition duration-150 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Sending link...' : resetSent ? 'Link Dispatched' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsForgotPasswordMode(false)
                  setError(null)
                  setInfoMessage(null)
                }}
                className="text-sm font-semibold text-[#64748B] hover:text-[#1E2238] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* STANDARD LOGIN FORM */
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-[#1E293B]">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition duration-150 focus:border-[#5D6BB2] focus:outline-none focus:ring-4 focus:ring-[#5D6BB2]/10"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-[#1E293B]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 pr-11 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition duration-150 focus:border-[#5D6BB2] focus:outline-none focus:ring-4 focus:ring-[#5D6BB2]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#94A3B8] hover:text-[#64748B] transition cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeIcon className="w-5 h-5" />
                  ) : (
                    <EyeOffIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPasswordMode(true)
                  setError(null)
                  setInfoMessage(null)
                }}
                className="text-sm font-semibold text-[#5D6BB2] hover:text-[#4A559E] transition cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {/* Action Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center px-9 py-3 rounded-lg bg-[#5D6BB2] hover:bg-[#4E5CA1] text-white text-sm font-semibold shadow-xs transition duration-150 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
