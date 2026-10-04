'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { formatPhoneForStorage, isValidPhoneFormat } from '@/lib/utils/phone'
import { EyeIcon, EyeOffIcon } from '@/components/crm/CrmIcons'
import { GhostCrmLogoIcon } from '@/components/crm/GhostCrmLogo'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [countryCode, setCountryCode] = useState('+972')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    // Validate password confirmation match
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.')
      setLoading(false)
      return
    }

    // Validate phone number format if provided
    let fullPhone = phoneNumber.trim()
    if (fullPhone) {
      if (!fullPhone.startsWith('+')) {
        fullPhone = fullPhone.startsWith('0')
          ? `${countryCode}${fullPhone.slice(1)}`
          : `${countryCode}${fullPhone}`
      }
      if (!isValidPhoneFormat(fullPhone) && !isValidPhoneFormat(phoneNumber)) {
        setError('Please enter a valid phone number')
        setLoading(false)
        return
      }
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'courier',
            phone_number: fullPhone ? formatPhoneForStorage(fullPhone) : undefined,
          },
        },
      })

      if (signUpError) throw signUpError

      if (data.user) {
        // Update profile with phone number if provided
        const updatePayload: Record<string, any> = {}
        if (fullPhone) {
          updatePayload.phone_number = formatPhoneForStorage(fullPhone)
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', data.user.id)

          if (profileError) {
            console.error('Error updating profile metadata:', profileError)
          }
        }

        setSuccess(true)
        // If session exists, email confirmation is disabled - redirect immediately
        if (data.session) {
          setTimeout(() => {
            router.push('/courier')
          }, 1500)
        } else {
          // Email confirmation required - redirect to login
          setTimeout(() => {
            router.push('/login')
          }, 2500)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
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
            Create an account
          </h1>
          <p className="mt-2.5 text-sm sm:text-[15px] text-[#64748B] leading-relaxed">
            Sign up for Persian Team Management and gain access to delivery operations. Do you already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-[#5D6BB2] hover:text-[#4A559E] transition cursor-pointer"
            >
              Login
            </Link>
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-800">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800">
            Account created successfully! Redirecting...
          </div>
        )}

        {/* Form */}
        <form className="space-y-5" onSubmit={handleRegister}>
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

          {/* Phone Number with Prefix Dropdown */}
          <div className="space-y-2">
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-[#1E293B]">
              Phone Number
            </label>
            <div className="flex rounded-xl border border-[#CBD5E1] bg-white overflow-hidden transition duration-150 focus-within:border-[#5D6BB2] focus-within:ring-4 focus-within:ring-[#5D6BB2]/10">
              <div className="flex items-center gap-1 px-3 bg-slate-50 border-r border-[#CBD5E1] text-xs font-semibold text-slate-700 shrink-0">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer py-1"
                >
                  <option value="+972">+972</option>
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                  <option value="+234">+234</option>
                </select>
              </div>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0501234567"
                className="w-full bg-transparent px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
              />
            </div>
          </div>

          {/* Password with Eye Icon */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-[#1E293B]">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={6}
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

          {/* Confirm Password with Eye Icon */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#1E293B]">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 pr-11 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition duration-150 focus:border-[#5D6BB2] focus:outline-none focus:ring-4 focus:ring-[#5D6BB2]/10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#94A3B8] hover:text-[#64748B] transition cursor-pointer"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <EyeIcon className="w-5 h-5" />
                ) : (
                  <EyeOffIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={loading || success}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-lg bg-[#5D6BB2] hover:bg-[#4E5CA1] text-white text-sm font-semibold shadow-xs transition duration-150 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Creating account...' : success ? 'Account created!' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
