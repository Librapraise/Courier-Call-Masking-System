'use client'

import React, { useState, useEffect } from 'react'
import {
  UserIcon,
  ShieldIcon,
  TelegramIcon,
  TagIcon,
  SettingsIcon,
  DatabaseIcon,
  CheckIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  DownloadIcon,
  RefreshIcon,
  KeyIcon,
  EyeIcon,
  EyeOffIcon,
  SearchIcon,
  BoxIcon,
  UsersIcon,
  PhoneIcon
} from '@/components/crm/CrmIcons'
import { Brand, Courier, Order } from '@/components/crm/CrmRouteViews'
import { supabase } from '@/lib/supabase/client'

interface CrmSettingsViewProps {
  userProfile: {
    id?: string
    email: string
    role: string
    name: string
    phone_number?: string
    telegram_id?: string
  } | null
  orders: Order[]
  brands: Brand[]
  products: any[]
  couriers: Courier[]
  lang: 'en' | 'he'
  isRtl: boolean
  activeTab: 'profile' | 'brands' | 'bot' | 'team' | 'data'
  onTabChange: (tab: 'profile' | 'brands' | 'bot' | 'team' | 'data') => void
  onOpenAddBrand: () => void
  onOpenEditBrand: (brand: any) => void
  onOpenDeleteBrand: (brand: any) => void
  onExportCSV: () => void
  onPurgeDemo: () => void
  onUpdateProfile: (updated: { name: string; phone_number?: string; telegram_id?: string }) => Promise<void> | void
}

export function CrmSettingsView({
  userProfile,
  orders,
  brands,
  products,
  couriers,
  lang,
  isRtl,
  activeTab,
  onTabChange,
  onOpenAddBrand,
  onOpenEditBrand,
  onOpenDeleteBrand,
  onExportCSV,
  onPurgeDemo,
  onUpdateProfile
}: CrmSettingsViewProps) {
  // Profile Form State
  const [fullName, setFullName] = useState(userProfile?.name || '')
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phone_number || '')
  const [telegramId, setTelegramId] = useState(userProfile?.telegram_id || '')
  const [savedAlert, setSavedAlert] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Security Form State
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  // System Config State
  const [deliveryFee, setDeliveryFee] = useState('40')
  const [lowStockThreshold, setLowStockThreshold] = useState('50')
  const [fuzzyTolerance, setFuzzyTolerance] = useState('2')
  const [soundAlerts, setSoundAlerts] = useState(true)
  const [botTokenMasked, setBotTokenMasked] = useState(true)
  const [webhookCopied, setWebhookCopied] = useState(false)

  // Brand Search Filter
  const [brandSearch, setBrandSearch] = useState('')
  const [brandActiveMap, setBrandActiveMap] = useState<Record<string, boolean>>({})

  // Team Member Management State (Pre-seeded with current managers & couriers)
  const [teamMembers, setTeamMembers] = useState([
    {
      id: 'admin-1',
      name: userProfile?.name || 'feelgee8',
      email: userProfile?.email || 'admin@persiancrm.internal',
      role: 'System Admin',
      telegram_id: userProfile?.telegram_id || '5338301589',
      status: 'Active',
      phone: userProfile?.phone_number || '050-1234567'
    },
    {
      id: 'disp-1',
      name: 'תומר מנהל משמרת',
      email: 'tomer.dispatch@ghostcrm.internal',
      role: 'Dispatcher',
      telegram_id: '891048201',
      status: 'Active',
      phone: '052-9988771'
    },
    {
      id: 'disp-2',
      name: 'שרון תפעול לילה',
      email: 'sharon.ops@ghostcrm.internal',
      role: 'Dispatcher',
      telegram_id: '650192841',
      status: 'Active',
      phone: '054-3322110'
    },
    ...couriers.slice(0, 4).map((c, i) => ({
      id: `courier-${c.id || i}`,
      name: c.name,
      email: `courier.${i + 1}@ghostcrm.internal`,
      role: 'Courier',
      telegram_id: '50' + (1000000 + i * 23145),
      status: 'On Shift',
      phone: c.phone_number || '052-1112233'
    }))
  ])

  // Sync profile when userProfile prop updates
  useEffect(() => {
    if (userProfile?.name) setFullName(userProfile.name)
    if (userProfile?.phone_number !== undefined) setPhoneNumber(userProfile.phone_number || '')
    if (userProfile?.telegram_id !== undefined) setTelegramId(userProfile.telegram_id || '')

    setTeamMembers(prev =>
      prev.map(m =>
        m.id === 'admin-1'
          ? {
              ...m,
              name: userProfile?.name || m.name,
              phone: userProfile?.phone_number || m.phone,
              telegram_id: userProfile?.telegram_id || m.telegram_id
            }
          : m
      )
    )
  }, [userProfile])

  // Count orders per brand
  const brandOrderCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    orders.forEach(o => {
      const bName = o.brands?.name || 'אחר'
      counts[bName] = (counts[bName] || 0) + 1
    })
    return counts
  }, [orders])

  // Filtered brands
  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  )

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setIsSavingProfile(true)
    try {
      await onUpdateProfile({
        name: fullName.trim() || 'Admin',
        phone_number: phoneNumber.trim(),
        telegram_id: telegramId.trim()
      })
      setSavedAlert(true)
      setTimeout(() => setSavedAlert(false), 4000)
    } catch (err: any) {
      console.error('[GhostCRM] Error saving profile:', err)
      setProfileError(err?.message || (lang === 'he' ? 'שגיאה בשמירת הפרופיל' : 'Failed to save profile changes.'))
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 6) {
      setPasswordError(lang === 'he' ? 'סיסמה חייבת להכיל לפחות 6 תווים' : 'Password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(lang === 'he' ? 'הסיסמאות אינן תואמות' : 'Passwords do not match. Please verify.')
      return
    }

    setPasswordLoading(true)

    try {
      // 1. Try server-side API with admin privilege
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: newPassword,
          userId: userProfile?.id
        })
      })

      const data = await res.json()

      if (!res.ok) {
        // Fallback: try client-side Supabase updateUser directly
        const { error: clientErr } = await supabase.auth.updateUser({
          password: newPassword
        })
        if (clientErr) {
          throw new Error(data.error || clientErr.message || 'Failed to update password.')
        }
      }

      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 4500)
    } catch (err: any) {
      console.error('[GhostCRM] Error resetting password:', err)
      setPasswordError(err.message || (lang === 'he' ? 'שגיאה בעדכון הסיסמה' : 'Failed to update password.'))
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleCopyWebhook = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/webhook` : 'https://api.ghostcrm.internal/api/telegram/webhook'
    navigator.clipboard.writeText(url)
    setWebhookCopied(true)
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  const toggleBrandActive = (brandId: string) => {
    setBrandActiveMap(prev => ({
      ...prev,
      [brandId]: prev[brandId] === false ? true : false
    }))
  }

  // Dictionary for Settings
  const t = {
    title: lang === 'he' ? 'הגדרות ופרופיל ניהול' : 'Settings & Profile Management',
    subtitle: lang === 'he' ? 'שליטה מרכזית בפרופיל משתמש, ניהול מותגים, קונפיגורציית בוט טלגרם והרשאות צוות' : 'Central control for dispatcher profile, brand personas, Telegram ingestion bot, and team permissions',
    tabProfile: lang === 'he' ? 'פרופיל אישי' : 'Personal Profile',
    tabBrands: lang === 'he' ? 'ניהול מותגים' : 'Brand Management',
    tabBot: lang === 'he' ? 'הגדרות בוט ומערכת' : 'Bot & System Config',
    tabTeam: lang === 'he' ? 'ניהול צוות והרשאות' : 'Team Access',
    tabData: lang === 'he' ? 'ניהול נתונים וגיבויים' : 'Data Management',
    saveChanges: lang === 'he' ? 'שמור שינויים' : 'Save Changes',
    savedSuccess: lang === 'he' ? 'הפרופיל עודכן בהצלחה!' : 'Profile updated successfully!',
    personalInfoTitle: lang === 'he' ? 'פרטים אישיים והרשאות' : 'Personal Details & Permissions',
    telegramWhitelistTitle: lang === 'he' ? 'שיוך מזהה טלגרם (Telegram Whitelist ID)' : 'Telegram Whitelist ID Binding',
    telegramWhitelistDesc: lang === 'he' ? 'רק הודעות שמועברות או נשלחות ממזהה טלגרם זה יתקבלו על ידי הבוט ויוזנו למערכת. זהו מנגנון אבטחה קריטי שמונע ספאם והזמנות לא מורשות.' : 'Only orders forwarded or sent from this specific numeric Telegram User ID will be parsed by the bot. This guarantees strict OPSEC and blocks unauthorized order injection.',
    uiPrefsTitle: lang === 'he' ? 'העדפות ממשק והתראות' : 'UI & Notification Preferences',
    securityTitle: lang === 'he' ? 'אבטחה ואיפוס סיסמה' : 'Security & Password Reset',
    brandTableTitle: lang === 'he' ? 'ספקי ומותגי פרסונה פעילים' : 'Active Brand & Persona Aliases',
    addNewBrand: lang === 'he' ? '+ הוסף מותג חדש' : '+ Add New Brand',
    botOnline: lang === 'he' ? 'בוט טלגרם: מחובר ופעיל' : 'Telegram Bot: Online & Operational',
    webhookUrl: lang === 'he' ? 'כתובת Webhook לטלגרם' : 'Telegram Webhook URL',
    copy: lang === 'he' ? 'העתק' : 'Copy',
    copied: lang === 'he' ? 'הועתק!' : 'Copied!',
    deliveryFee: lang === 'he' ? 'דמי משלוח ברירת מחדל' : 'Default Delivery Fee',
    lowStockThreshold: lang === 'he' ? 'סף התראת מלאי נמוך (גרם/יח)' : 'Low Stock Threshold (g/units)',
    fuzzyTolerance: lang === 'he' ? 'סובלנות שגיאות כתיב (Levenshtein)' : 'Fuzzy Typo Tolerance (Distance)',
    teamTableTitle: lang === 'he' ? 'חברי צוות, תפקידים ומזהי טלגרם' : 'Team Members, Roles & Telegram IDs',
    inviteMember: lang === 'he' ? '+ צרף חבר צוות' : '+ Invite Team Member',
    dataBackupTitle: lang === 'he' ? 'ייצוא נתונים וגיבוי בלחיצה אחת' : '1-Click Data Exports & Backups',
    exportOrders: lang === 'he' ? 'ייצוא היסטוריית הזמנות (Excel)' : 'Export Orders History (Excel/CSV)',
    exportInventory: lang === 'he' ? 'ייצוא מלאי מחסן חי (CSV)' : 'Export Live Warehouse Stock (CSV)',
    purgeDemoTitle: lang === 'he' ? 'איפוס וניקוי הזמנות דמו (מעבר למבצעי)' : 'Purge Demo Orders (Live Handover)'
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1E2235] to-[#4352E8] text-white flex items-center justify-center font-black text-xl shadow-md ring-4 ring-slate-100 dark:ring-slate-800">
            {userProfile?.name?.slice(0, 2).toUpperCase() || 'GA'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {t.title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#4352E8]/10 text-[#4352E8] dark:text-indigo-400 border border-[#4352E8]/20">
                {userProfile?.role || 'System Admin'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Global Action / Quick Status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t.botOnline}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Strip */}
      <div className="bg-slate-100/80 dark:bg-[#0F1420] p-1.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex flex-wrap gap-1 transition-colors">
        <button
          onClick={() => onTabChange('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-[#1E2235] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60'
          }`}
        >
          <UserIcon className={`w-4 h-4 ${activeTab === 'profile' ? 'text-[#4352E8] dark:text-indigo-400' : 'text-slate-400'}`} />
          <span>{t.tabProfile}</span>
        </button>

        <button
          onClick={() => onTabChange('brands')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'brands'
              ? 'bg-white dark:bg-[#1E2235] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60'
          }`}
        >
          <TagIcon className={`w-4 h-4 ${activeTab === 'brands' ? 'text-[#4352E8] dark:text-indigo-400' : 'text-slate-400'}`} />
          <span>{t.tabBrands}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
            {brands.length}
          </span>
        </button>

        <button
          onClick={() => onTabChange('bot')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'bot'
              ? 'bg-white dark:bg-[#1E2235] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60'
          }`}
        >
          <TelegramIcon className={`w-4 h-4 ${activeTab === 'bot' ? 'text-[#0088cc]' : 'text-slate-400'}`} />
          <span>{t.tabBot}</span>
        </button>

        <button
          onClick={() => onTabChange('team')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'team'
              ? 'bg-white dark:bg-[#1E2235] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60'
          }`}
        >
          <UsersIcon className={`w-4 h-4 ${activeTab === 'team' ? 'text-[#4352E8] dark:text-indigo-400' : 'text-slate-400'}`} />
          <span>{t.tabTeam}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
            {teamMembers.length}
          </span>
        </button>

        <button
          onClick={() => onTabChange('data')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'data'
              ? 'bg-white dark:bg-[#1E2235] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60'
          }`}
        >
          <DatabaseIcon className={`w-4 h-4 ${activeTab === 'data' ? 'text-[#4352E8] dark:text-indigo-400' : 'text-slate-400'}`} />
          <span>{t.tabData}</span>
        </button>
      </div>

      {/* TAB 1: PERSONAL PROFILE */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Profile Info Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSaveProfile} className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5 transition-colors">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <UserIcon className="w-5 h-5 text-[#4352E8] dark:text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.personalInfoTitle}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {savedAlert && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 animate-fadeIn">
                      <CheckIcon className="w-3.5 h-3.5" />
                      {t.savedSuccess}
                    </span>
                  )}
                  {profileError && (
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
                      {profileError}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'he' ? 'שם מלא / כינוי מנהל' : 'Full Name / Dispatcher Alias'}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#4352E8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'he' ? 'כתובת אימייל' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    value={userProfile?.email || 'admin@persiancrm.internal'}
                    disabled
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 font-medium cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'he' ? 'מספר טלפון לזיהוי' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="050-1234567"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#4352E8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'he' ? 'תפקיד במערכת' : 'System Role'}
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 font-bold text-xs">
                    <ShieldIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{userProfile?.role || 'System Admin'}</span>
                  </div>
                </div>
              </div>

              {/* Telegram Whitelist ID Binding Card */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="rounded-xl bg-gradient-to-r from-blue-50/70 to-indigo-50/70 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/70 dark:border-blue-900/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <TelegramIcon className="w-5 h-5 text-[#0088cc]" />
                    <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200">{t.telegramWhitelistTitle}</h4>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200">OPSEC Guard</span>
                  </div>
                  <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                    {t.telegramWhitelistDesc}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center pt-1">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={telegramId}
                        onChange={e => setTelegramId(e.target.value)}
                        placeholder="e.g. 718492014"
                        className="w-full text-xs px-3.5 py-2 rounded-xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 font-mono font-bold text-blue-950 dark:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1 justify-center border border-emerald-200/60 dark:border-emerald-800">
                      <CheckIcon className="w-3.5 h-3.5" />
                      <span>{lang === 'he' ? 'מורשה להזנת הזמנות' : 'Ingestion Authorized'}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 rounded-xl bg-[#1E2235] hover:bg-[#4352E8] dark:bg-[#4352E8] dark:hover:bg-[#3442c7] disabled:opacity-60 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isSavingProfile ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{lang === 'he' ? 'שומר שינויים...' : 'Saving Changes...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-4 h-4" />
                      <span>{t.saveChanges}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Security & Password Reset Form */}
            <form onSubmit={handlePasswordReset} className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
                <KeyIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.securityTitle}</h3>
              </div>

              {passwordError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                  <CheckIcon className="w-4 h-4" />
                  <span>{lang === 'he' ? 'הסיסמה עודכנה בהצלחה!' : 'Password updated successfully!'}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'he' ? 'סיסמה חדשה' : 'New Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#4352E8]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 end-0 px-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'he' ? 'אימות סיסמה חדשה' : 'Confirm New Password'}
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#4352E8]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {passwordLoading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                      <span>{lang === 'he' ? 'מעדכן סיסמה...' : 'Updating Password...'}</span>
                    </>
                  ) : (
                    <span>{lang === 'he' ? 'עדכן סיסמה' : 'Update Password'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Side Info Cards */}
          <div className="space-y-6">
            {/* Active Session & Security Overview */}
            <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{lang === 'he' ? 'סטטוס אבטחה וסשן' : 'Security & Session Status'}</span>
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{lang === 'he' ? 'סשן מנהל נוכחי' : 'Current Session'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{lang === 'he' ? 'פעיל ומאומת' : 'Active & Verified'}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{lang === 'he' ? 'הרשאת גישה' : 'Access Level'}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{userProfile?.role || 'Admin'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{lang === 'he' ? 'הגנת שיחות ממוסכות' : 'Twilio Masking'}</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Active</span>
                </div>
              </div>
            </div>

            {/* UI Preferences Card */}
            <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t.uiPrefsTitle}</span>
              </h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {lang === 'he' ? 'התראות קוליות בהזנה חדשה' : 'Sound Alerts on Ingestion'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'he' ? 'השמע צליל כאשר נקלטת הזמנה מטלגרם' : 'Play chime when new batch arrives'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSoundAlerts(!soundAlerts)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                      soundAlerts ? 'bg-[#4352E8]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                        soundAlerts ? (isRtl ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BRAND & PERSONA MANAGEMENT */}
      {activeTab === 'brands' && (
        <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <TagIcon className="w-5 h-5 text-[#4352E8] dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.brandTableTitle}</h3>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {brands.length} {lang === 'he' ? 'מותגים' : 'Brands'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'he'
                  ? 'מותגים אלו מזינים ישירות את מנוע ה-NLP ומזהים את ספק המוצר בעת פענוח הודעות טלגרם.'
                  : 'These supplier personas directly feed the ingestion parser to auto-classify Telegram orders.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-3" />
                <input
                  type="text"
                  value={brandSearch}
                  onChange={e => setBrandSearch(e.target.value)}
                  placeholder={lang === 'he' ? 'חיפוש מותג...' : 'Search brands...'}
                  className="text-xs ps-8 pe-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-[#4352E8]"
                />
              </div>

              <button
                onClick={onOpenAddBrand}
                className="px-4 py-2 rounded-xl bg-[#1E2235] hover:bg-[#4352E8] dark:bg-[#4352E8] dark:hover:bg-[#3442c7] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>{t.addNewBrand}</span>
              </button>
            </div>
          </div>

          {/* Brands Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3 text-start">{lang === 'he' ? 'שם המותג / ספק' : 'Brand / Supplier Persona'}</th>
                  <th className="py-3 px-3 text-start">{lang === 'he' ? 'סה״כ הזמנות' : 'Lifetime Orders'}</th>
                  <th className="py-3 px-3 text-start">{lang === 'he' ? 'סטטוס קליטה' : 'Ingestion Status'}</th>
                  <th className="py-3 px-3 text-end">{lang === 'he' ? 'פעולות' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredBrands.map((brand, idx) => {
                  const orderCount = brandOrderCounts[brand.name] || 0
                  const isActive = brandActiveMap[brand.id] !== false

                  return (
                    <tr key={brand.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs flex items-center justify-center border border-slate-200/60 dark:border-slate-700">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{brand.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-extrabold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                          {orderCount} {lang === 'he' ? 'הזמנות' : 'orders'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => toggleBrandActive(brand.id)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span>{isActive ? (lang === 'he' ? 'פעיל לקליטה' : 'Active') : (lang === 'he' ? 'מושהה' : 'Inactive')}</span>
                        </button>
                      </td>

                      <td className="py-3 px-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenEditBrand(brand)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Edit Brand"
                          >
                            <EditIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenDeleteBrand(brand)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Brand"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BOT & SYSTEM CONFIG */}
      {activeTab === 'bot' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Bot Settings */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5 transition-colors">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
                <TelegramIcon className="w-5 h-5 text-[#0088cc]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.tabBot}</h3>
              </div>

              {/* Bot Online Status Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-[#1E2235] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <TelegramIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Persian Team Ingestion Bot</span>
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-500/25 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ONLINE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {lang === 'he' ? 'מאזין להודעות מועברות בערוץ הטלגרם' : 'Listening for forwarded orders via webhook'}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] font-mono bg-black/30 px-3 py-1.5 rounded-lg border border-white/10">
                  Rate-Limit: OK (0/30s)
                </div>
              </div>

              {/* Webhook Endpoint */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.webhookUrl}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/webhook` : '/api/telegram/webhook'}
                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={handleCopyWebhook}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{webhookCopied ? t.copied : t.copy}</span>
                  </button>
                </div>
              </div>

              {/* Masked Bot Token */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {lang === 'he' ? 'טוקן בוט (TELEGRAM_BOT_TOKEN)' : 'Telegram Bot API Token'}
                </label>
                <div className="relative">
                  <input
                    type={botTokenMasked ? 'password' : 'text'}
                    readOnly
                    value="7796014820:AAF92k1ld8sA9-xLkZ8194kd0L1"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setBotTokenMasked(!botTokenMasked)}
                    className="absolute inset-y-0 end-0 px-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {botTokenMasked ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Thresholds Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.deliveryFee}</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={deliveryFee}
                      onChange={e => setDeliveryFee(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white"
                    />
                    <span className="absolute inset-y-0 end-3 flex items-center text-xs font-bold text-slate-400">₪</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.lowStockThreshold}</label>
                  <input
                    type="number"
                    value={lowStockThreshold}
                    onChange={e => setLowStockThreshold(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.fuzzyTolerance}</label>
                  <input
                    type="number"
                    value={fuzzyTolerance}
                    onChange={e => setFuzzyTolerance(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ingestion Rules & OPSEC Cards */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3 transition-colors">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldIcon className="w-4 h-4 text-[#4352E8] dark:text-indigo-400" />
                <span>{lang === 'he' ? 'חוקי פענוח ו-OPSEC' : 'Parsing Rules & OPSEC'}</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">{lang === 'he' ? '1. חוק הסלאש למלאי (The Slash Rule)' : '1. The Slash Inventory Rule'}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {lang === 'he' ? 'בפורמט "פריט / ניכוי מחסן", מה שאחרי הסלאש מנוכה ישירות מהמלאי.' : 'In "Menu / Warehouse Item", text after the slash deducts live stock.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">{lang === 'he' ? '2. סובלנות איות ועברית' : '2. Fuzzy Spelling Tolerance'}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {lang === 'he' ? 'גרסאות כמו גלקסי / גלאקסי, פופקורן / פופקרן מנותבות לאותו מוצר.' : 'Variants like גלאקסי / גלקסי resolve identically via Levenshtein engine.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">{lang === 'he' ? '3. כתובת בתור שם לקוח' : '3. Customer Display Rule'}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {lang === 'he' ? 'שם הלקוח מוצג לפי כתובת המשלוח. אי-חשיפת שמות פרטיים שומרת על פרטיות.' : 'Address serves as customer display name for operational privacy.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEAM ACCESS CONTROL */}
      {activeTab === 'team' && (
        <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-[#4352E8] dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.teamTableTitle}</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'he' ? 'ניהול משתמשי המערכת, תפקידים, והרשאות קליטה מטלגרם.' : 'Manage system dispatchers, couriers, and linked Telegram ingestion IDs.'}
              </p>
            </div>

            <button
              onClick={() => alert(lang === 'he' ? 'להוספת משתמש חדש, בקש מהשליח/סדרן להירשם ב-/register או הוסף הרשאה ב-Supabase.' : 'To invite a new member, have them sign up at /register or grant privileges in Supabase.')}
              className="px-4 py-2 rounded-xl bg-[#1E2235] hover:bg-[#4352E8] dark:bg-[#4352E8] dark:hover:bg-[#3442c7] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>{t.inviteMember}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3 text-start">{lang === 'he' ? 'שם חבר הצוות' : 'Team Member Name'}</th>
                  <th className="py-3 px-3 text-start">{lang === 'he' ? 'תפקיד' : 'Role'}</th>
                  <th className="py-3 px-3 text-start">{lang === 'he' ? 'מזהה טלגרם מורשה' : 'Telegram Whitelist ID'}</th>
                  <th className="py-3 px-3 text-start">{lang === 'he' ? 'טלפון / אימייל' : 'Contact'}</th>
                  <th className="py-3 px-3 text-start">{lang === 'he' ? 'סטטוס' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {teamMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs flex items-center justify-center border border-slate-700">
                          {member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{member.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        member.role === 'System Admin'
                          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          : member.role === 'Dispatcher'
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {member.role}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">
                        {member.telegram_id}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      <div>{member.email}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{member.phone}</div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: DATA MANAGEMENT & BACKUP */}
      {activeTab === 'data' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Options */}
          <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <DownloadIcon className="w-5 h-5 text-[#4352E8] dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.dataBackupTitle}</h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'he' ? 'הורדת נתוני המערכת בקובץ CSV/Excel עם תמיכה מלאה בעברית (UTF-8 BOM).' : 'Download complete system records in UTF-8 BOM CSV format compatible with Microsoft Excel.'}
            </p>

            <div className="space-y-3 pt-2">
              <button
                onClick={onExportCSV}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#4352E8] dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 transition cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <DownloadIcon className="w-4 h-4 text-[#4352E8] dark:text-indigo-400" />
                  <span>{t.exportOrders}</span>
                </div>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-extrabold">{orders.length} Records</span>
              </button>

              <button
                onClick={onExportCSV}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#4352E8] dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 transition cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <BoxIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t.exportInventory}</span>
                </div>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-extrabold">{products.length} Products</span>
              </button>
            </div>
          </div>

          {/* Database Health & Purge Options */}
          <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <DatabaseIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'he' ? 'בריאות בסיס הנתונים ואיפוס' : 'Database Health & Handover'}
              </h3>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">PostgreSQL Engine</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Connected (Supabase)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Row-Level Security (RLS)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Enforced & Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Courier Isolation</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">Zero-Leakage Guard</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onPurgeDemo}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-950/50 transition text-rose-800 dark:text-rose-300 text-xs font-bold cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <TrashIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>{t.purgeDemoTitle}</span>
                </div>
                <span className="text-[9px] bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 px-1.5 py-0.5 rounded font-extrabold uppercase">Live Mode</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
