'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { TRANSLATIONS, Language } from '@/lib/crm/translations'
import { parseSingleOrderMessage, ParsedDeliveryOrder, getOrderPaymentInfo } from '@/lib/crm/parser'
import { isSuperAdminUser, isStaffUser } from '@/lib/auth/roles'
import { getIsraelDateString } from '@/lib/crm/date-utils'
import GhostCrmLogo, { GhostCrmLogoIcon } from '@/components/crm/GhostCrmLogo'
import {
  GridIcon,
  TruckIcon,
  BoxIcon,
  WalletIcon,
  UsersIcon,
  TelegramIcon,
  LogoutIcon,
  FilterIcon,
  SearchIcon,
  GlobeIcon,
  MapPinIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  PhoneIcon,
  WhatsAppIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  RefreshIcon,
  TagIcon,
  XIcon,
  MenuIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  SettingsIcon,
  UserIcon,
  ChevronRightIcon,
  DatabaseIcon,
  ShieldIcon
} from '@/components/crm/CrmIcons'
import {
  DashboardRouteView,
  OrdersRouteView,
  InventoryRouteView,
  SettlementsRouteView,
  CustomersRouteView,
  TelegramRouteView,
  CashSettlementRecord,
  DayCloseoutRecord
} from '@/components/crm/CrmRouteViews'
import { CrmSettingsView } from '@/components/crm/CrmSettingsView'
import ThemeToggle from '@/components/ThemeToggle'
import {
  ProductModal,
  ProductDeleteModal,
  BrandManagerModal,
  CourierModal,
  CourierDeleteModal,
  OrderDraftModal,
  OrderDeleteModal
} from '@/components/crm/CrmCrudModals'

interface Customer {
  id: string
  address_name: string
  phone_number: string
  city?: string
  telegram_handle?: string
  customer_type?: string
  total_orders?: number
  total_spent?: number
  last_order_at?: string
  brands?: { name: string }
}

interface Brand {
  id: string
  name: string
}

interface Courier {
  id: string
  name: string
  phone_number?: string
  telegram_id?: number | string | null
  is_active?: boolean
  todayCash?: number
  todayBit?: number
  todayOrders?: number
  totalOrdersToday?: number
  totalCashToday?: number
  totalBitToday?: number
  totalGrossToday?: number
  settledOrdersToday?: number
  settledCashToday?: number
  settledBitToday?: number
  settledNetCashToday?: number
  pendingOrdersToday?: number
  pendingCashToday?: number
  pendingBitToday?: number
  isSettledToday?: boolean
  shiftStatus?: 'no_shift' | 'open' | 'reconciled'
  created_at?: string
}

interface Order {
  id: string
  address: string
  city: string
  menu_items: string
  actual_items: string
  total_price: number
  is_settled: boolean
  order_date: string
  courier_id?: string | null
  raw_message?: string
  payment_method?: string | null
  is_prepaid?: boolean | null
  notes?: string | null
  crm_customers?: Customer
  brands?: Brand
  crm_couriers?: Courier
}

interface Product {
  id: string
  name: string
  category: string
  stock_on_hand: number
  unit: string
  min_stock_alert: number
  aliases?: string[]
}

interface DashboardMetrics {
  courierCashToday: number
  totalBitCreditToday?: number
  totalCashToday?: number
  reconciledCashToday?: number
  totalDeliveriesToday: number
  activeCustomers: number
  lowStockAlerts: number
}

const DEFAULT_DELIVERY_HUBS: Record<string, number> = {
  'תל אביב': 0,
  'פתח תקווה': 0,
  'ראשון לציון': 0,
  'רמת גן': 0,
  'חולון': 0,
  'בת ים': 0,
  'גבעתיים': 0,
  'הרצליה': 0,
  'נתניה': 0,
  'כפר סבא': 0,
  'רעננה': 0,
  'הוד השרון': 0,
  'אשדוד': 0,
  'אשקלון': 0,
  'באר שבע': 0,
  'רחובות': 0,
  'נס ציונה': 0,
  'יבנה': 0,
  'מודיעין': 0,
  'לוד': 0,
  'רמלה': 0,
  'ירושלים': 0,
  'חיפה': 0,
  'חדרה': 0,
  'בני עייש': 0,
}

export default function GhostCrmDashboard() {
  const router = useRouter()

  // Localization state (Default LTR English)
  const [lang, setLang] = useState<Language>('en')
  const [mounted, setMounted] = useState(false)

  // Auth User Profile State (Actively Wired to Supabase)
  const [userProfile, setUserProfile] = useState<{
    id?: string
    email: string
    role: string
    name: string
    phone_number?: string
    telegram_id?: string
  } | null>(null)
  const [authChecking, setAuthChecking] = useState(true)

  // Data states
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [cityCounts, setCityCounts] = useState<Record<string, number>>(DEFAULT_DELIVERY_HUBS)
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    courierCashToday: 0,
    totalDeliveriesToday: 0,
    activeCustomers: 0,
    lowStockAlerts: 0
  })

  // Primary Navigation State
  const [activeNav, setActiveNav] = useState<'dashboard' | 'orders' | 'inventory' | 'settlements' | 'customers' | 'telegram' | 'settings'>('dashboard')
  const [settingsTab, setSettingsTab] = useState<'profile' | 'brands' | 'bot' | 'team' | 'data'>('profile')
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'settlements'>('orders')
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  // Structured Filters (Shifted into Sidebar Component)
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL')
  const [brandSearchTerm, setBrandSearchTerm] = useState('')
  const [selectedCity, setSelectedCity] = useState<string>('ALL')
  const [todayOnly, setTodayOnly] = useState(true)
  const [settlementFilter, setSettlementFilter] = useState<'ALL' | 'OPEN' | 'SETTLED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // UI Drawer & Modal States
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<Order | null>(null)
  const [chartTimeframe, setChartTimeframe] = useState<'year' | 'month' | 'week'>('year')
  const [unmaskedPhones, setUnmaskedPhones] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  // Phase 5 Modals
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD')
  const [adjustQty, setAdjustQty] = useState<string>('50')
  const [adjustReason, setAdjustReason] = useState<string>('RESTOCK')
  const [adjustNotes, setAdjustNotes] = useState<string>('')
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false)

  const [settlingCourier, setSettlingCourier] = useState<Courier | null>(null)
  const [grossInput, setGrossInput] = useState<string>('')
  const [bonusInput, setBonusInput] = useState<string>('0')
  const [batYamCountInput, setBatYamCountInput] = useState<number>(0)
  const [settlementNotes, setSettlementNotes] = useState<string>('')
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false)
  const [isPurgingDemo, setIsPurgingDemo] = useState(false)
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isCarouselHovered, setIsCarouselHovered] = useState(false)

  // In-App CRUD Dialog States
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  const [showBrandManagerModal, setShowBrandManagerModal] = useState(false)

  const [showCourierModal, setShowCourierModal] = useState(false)
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null)
  const [deletingCourier, setDeletingCourier] = useState<Courier | null>(null)

  // In-App Order Editing & Cancellation States
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null)

  // Dedicated Route Specific States
  const [customers, setCustomers] = useState<Customer[]>([])
  const [inventoryCategory, setInventoryCategory] = useState<string>('ALL')
  const [inventorySearch, setInventorySearch] = useState<string>('')
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL')
  const [customerSearch, setCustomerSearch] = useState<string>('')
  const [customerCityFilter, setCustomerCityFilter] = useState<string>('ALL')
  const [testTelegramText, setTestTelegramText] = useState<string>(
    `מרקו לויז - הנשיאים 57 פתח תקווה\n054-9876543\n@marko_tlv\nמותג: רפואי לחיים\nפריטים: גלקסי 10 גרם / 10 גרם רפואי גלקסי\nמחיר: 450₪`
  )
  const [parsedTestResult, setParsedTestResult] = useState<ParsedDeliveryOrder | null>(null)
  const [recentSettlements, setRecentSettlements] = useState<CashSettlementRecord[]>([])
  const [dismissedSettlementIds, setDismissedSettlementIds] = useState<string[]>([])

  // Day Closeout (Z-Report) States
  const [recentDayCloseouts, setRecentDayCloseouts] = useState<DayCloseoutRecord[]>([])
  const [latestDayCloseout, setLatestDayCloseout] = useState<DayCloseoutRecord | null>(null)
  const [shiftStartTime, setShiftStartTime] = useState<string | null>(null)
  const [showDayCloseoutModal, setShowDayCloseoutModal] = useState<boolean>(false)
  const [selectedCloseoutDetail, setSelectedCloseoutDetail] = useState<DayCloseoutRecord | null>(null)
  const [isSubmittingDayCloseout, setIsSubmittingDayCloseout] = useState<boolean>(false)
  const [dayCloseoutNotes, setDayCloseoutNotes] = useState<string>('')

  // Translations
  const t = useMemo(() => TRANSLATIONS[lang], [lang])
  const isRtl = lang === 'he'

  // 1. Actively Wire Up Supabase Auth Guard & Restore Navigation Tab on Mount
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('ghostcrm_lang') as Language
    if (saved === 'en' || saved === 'he') {
      setLang(saved)
    }

    // Restore active navigation tab & settings subtab from URL query parameters or localStorage
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const tabParam = urlParams.get('tab')
      const subTabParam = urlParams.get('sub')

      const validTabs = ['dashboard', 'orders', 'inventory', 'settlements', 'customers', 'telegram', 'settings']
      const validSettingsTabs = ['profile', 'brands', 'bot', 'team', 'data']

      let targetNav: any = null
      let targetSub: any = null

      if (tabParam && validTabs.includes(tabParam)) {
        targetNav = tabParam
      } else {
        const savedTab = localStorage.getItem('ghostcrm_active_nav')
        if (savedTab && validTabs.includes(savedTab)) {
          targetNav = savedTab
        }
      }

      if (subTabParam && validSettingsTabs.includes(subTabParam)) {
        targetSub = subTabParam
      } else {
        const savedSub = localStorage.getItem('ghostcrm_settings_tab')
        if (savedSub && validSettingsTabs.includes(savedSub)) {
          targetSub = savedSub
        }
      }

      if (targetNav) {
        setActiveNav(targetNav)
      }
      if (targetSub) {
        setSettingsTab(targetSub)
      }
    } catch (e) {
      console.warn('[GhostCRM] Error restoring tab state on mount:', e)
    }

    async function verifyAuthAndLoadProfile() {
      try {
        setAuthChecking(true)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        const redirectTarget = typeof window !== 'undefined'
          ? encodeURIComponent(window.location.pathname + window.location.search)
          : '/crm'

        if (sessionError || !session?.user) {
          console.warn('[GhostCRM Auth Guard] No authenticated session. Redirecting to login.')
          window.location.href = `/login?redirectTo=${redirectTarget}`
          return
        }

        // 1. First attempt to load fresh profile directly from server API
        try {
          const res = await fetch('/api/auth/update-profile')
          if (res.ok) {
            const data = await res.json()
            if (data.ok && data.profile) {
              setUserProfile(data.profile)
              setAuthChecking(false)
              fetchData()
              return
            }
          }
        } catch {
          // Fallback to client-side auth verification below
        }

        // 2. Client-side fallback with live user_metadata
        const { data: { user } } = await supabase.auth.getUser()
        const activeUser = user || session.user

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, phone_number')
          .eq('id', activeUser.id)
          .single()

        const isSuper = isSuperAdminUser(activeUser)

        if (!isStaffUser(activeUser, profile)) {
          console.warn('[GhostCRM Auth Guard] Unauthorized user attempted to access /crm. Redirecting to courier portal.')
          window.location.href = '/courier'
          return
        }

        const roleName = isSuper || profile?.role === 'super_admin'
          ? 'Super Admin'
          : profile?.role === 'warehouseman' || activeUser.user_metadata?.role === 'warehouseman'
          ? 'Warehouse Manager'
          : profile?.role === 'admin'
          ? 'Dispatcher'
          : 'System Admin'
        const meta = activeUser.user_metadata || {}
        const displayName =
          meta.full_name || meta.name || (activeUser.email ? activeUser.email.split('@')[0] : 'Admin')
        const phone = profile?.phone_number || meta.phone_number || ''
        const tgId = meta.telegram_id || ''

        setUserProfile({
          id: activeUser.id,
          email: activeUser.email || 'admin@persiancrm.internal',
          role: roleName,
          name: displayName,
          phone_number: phone,
          telegram_id: tgId
        })
        setAuthChecking(false)
        fetchData()
      } catch (err) {
        console.error('[GhostCRM Auth Guard] Authentication verification error:', err)
        const redirectTarget = typeof window !== 'undefined'
          ? encodeURIComponent(window.location.pathname + window.location.search)
          : '/crm'
        window.location.href = `/login?redirectTo=${redirectTarget}`
      }
    }

    verifyAuthAndLoadProfile()
  }, [])

  // 1b. Keep URL query parameters and localStorage synchronized with active navigation state
  useEffect(() => {
    if (!mounted) return

    try {
      localStorage.setItem('ghostcrm_active_nav', activeNav)
      if (activeNav === 'settings') {
        localStorage.setItem('ghostcrm_settings_tab', settingsTab)
      }

      const url = new URL(window.location.href)
      const currentTab = url.searchParams.get('tab')
      const currentSub = url.searchParams.get('sub')

      let changed = false
      if (activeNav === 'dashboard') {
        if (currentTab !== 'dashboard') {
          url.searchParams.set('tab', 'dashboard')
          changed = true
        }
        if (currentSub !== null) {
          url.searchParams.delete('sub')
          changed = true
        }
      } else {
        if (currentTab !== activeNav) {
          url.searchParams.set('tab', activeNav)
          changed = true
        }
        if (activeNav === 'settings') {
          if (currentSub !== settingsTab) {
            url.searchParams.set('sub', settingsTab)
            changed = true
          }
        } else if (currentSub !== null) {
          url.searchParams.delete('sub')
          changed = true
        }
      }

      if (changed) {
        window.history.replaceState(null, '', url.pathname + url.search)
      }
    } catch (err) {
      console.warn('[GhostCRM] URL synchronization error:', err)
    }
  }, [activeNav, settingsTab, mounted])

  // 1c. Listen to browser Back / Forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const tabParam = urlParams.get('tab')
        const subTabParam = urlParams.get('sub')
        const validTabs = ['dashboard', 'orders', 'inventory', 'settlements', 'customers', 'telegram', 'settings']
        const validSettingsTabs = ['profile', 'brands', 'bot', 'team', 'data']

        if (tabParam && validTabs.includes(tabParam)) {
          setActiveNav(tabParam as any)
        } else {
          setActiveNav('dashboard')
        }

        if (subTabParam && validSettingsTabs.includes(subTabParam)) {
          setSettingsTab(subTabParam as any)
        }
      } catch (err) {
        console.warn('[GhostCRM] popstate handler error:', err)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Logout Handler (Actively wired to Supabase)
  const handleLogout = async () => {
    try {
      setAuthChecking(true)
      await supabase.auth.signOut()
    } catch (e) {
      console.error('SignOut error:', e)
    } finally {
      // Hard redirect to clear router cache and reset client memory
      window.location.href = '/login'
    }
  }

  // Toggle Language Handler
  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'he' : 'en'
    setLang(nextLang)
    localStorage.setItem('ghostcrm_lang', nextLang)
  }

  // Fetch Dashboard Data
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true)
      const res = await fetch('/api/crm/dashboard')
      if (res.status === 401) {
        const redirectTarget = typeof window !== 'undefined'
          ? encodeURIComponent(window.location.pathname + window.location.search)
          : '/crm'
        window.location.href = `/login?redirectTo=${redirectTarget}`
        return
      }
      if (res.status === 403) {
        window.location.href = '/courier'
        return
      }
      if (!res.ok) throw new Error('Failed to load CRM data')
      const data = await res.json()
      setOrders(data.orders || [])
      setBrands(data.brands || [])
      setProducts(data.products || [])
      setCouriers(data.couriers || [])
      if (data.customers) {
        setCustomers(data.customers)
      }
      setCityCounts(prev => ({
        ...DEFAULT_DELIVERY_HUBS,
        ...(data.cityCounts || {})
      }))
      if (data.metrics) {
        setMetrics(data.metrics)
      }
      if (data.recentSettlements) {
        setRecentSettlements(data.recentSettlements)
      }
      if (data.recentDayCloseouts) {
        setRecentDayCloseouts(data.recentDayCloseouts)
      }
      if (data.latestDayCloseout !== undefined) {
        setLatestDayCloseout(data.latestDayCloseout)
      }
      if (data.shiftStartTime) {
        setShiftStartTime(data.shiftStartTime)
      }
    } catch (err) {
      console.error('[GhostCRM] Fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Auto-scroll Hero Carousel every 6 seconds unless hovered
  useEffect(() => {
    if (isCarouselHovered) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 3)
    }, 6000)
    return () => clearInterval(timer)
  }, [isCarouselHovered])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [notification])
  // Helper to detect if an order or address is in Bat Yam (₪50 courier fee vs ₪100 standard)
  const isBatYamOrder = (o: {
    city?: string | null
    address?: string | null
    raw_message?: string | null
    crm_customers?: { address_name?: string | null; city?: string | null } | null
  }) => {
    const combined = [
      o.city || '',
      o.address || '',
      o.crm_customers?.city || '',
      o.crm_customers?.address_name || '',
      o.raw_message || ''
    ].join(' ').toLowerCase()

    return (
      combined.includes('בת ים') ||
      combined.includes('בת-ים') ||
      combined.includes('בתים') ||
      combined.includes('יוספטל') ||
      combined.includes('יוסף טל') ||
      combined.includes('בלפור') ||
      combined.includes('הקוממיות') ||
      combined.includes('bat yam') ||
      combined.includes('bat-yam') ||
      combined.includes('batyam') ||
      combined.includes('yoseftal')
    )
  }

  // When opening courier settlement modal, auto-detect Bat Yam deliveries in their active unsettled batch
  useEffect(() => {
    if (!settlingCourier) {
      setBatYamCountInput(0)
      return
    }

    const courierOrders = orders.filter(o => {
      const cId = (o as any).crm_couriers?.id || (o as any).courier_id
      if (cId !== settlingCourier.id) return false
      if (o.is_settled) return false
      if (shiftStartTime && o.order_date <= shiftStartTime) return false
      return true
    })

    const detectedBatYam = courierOrders.filter(isBatYamOrder).length
    setBatYamCountInput(detectedBatYam)
  }, [settlingCourier, orders, shiftStartTime])

  // Phone Masking
  const maskPhoneNumber = (phone: string, isUnmasked: boolean) => {
    if (!phone) return '—'
    if (isUnmasked) return phone
    const clean = phone.replace(/[^\d]/g, '')
    if (clean.length === 10) {
      return `${clean.slice(0, 3)}-***-${clean.slice(7)}`
    }
    return phone.replace(/(\d{3})\d{3,4}(\d{2,3})/, '$1-***-$2')
  }

  const handleCopyPhone = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const togglePhoneMask = (id: string) => {
    setUnmaskedPhones(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Real-time Storekeeper Cash Collection Alert
  const latestWarehouseSettlement = useMemo(() => {
    if (!recentSettlements || recentSettlements.length === 0) return null
    const todayIsoDate = getIsraelDateString()
    return (
      recentSettlements.find(s => {
        if (dismissedSettlementIds.includes(s.id)) return false
        const isToday = s.settlement_date === todayIsoDate || (s.created_at && s.created_at.startsWith(todayIsoDate))
        const hasNetCash = Number(s.net_expected || s.amount_received || 0) > 0
        return isToday && hasNetCash
      }) || null
    )
  }, [recentSettlements, dismissedSettlementIds])

  // Brand Order Counts
  const brandOrderCounts = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => {
      const bName = o.brands?.name
      if (bName) {
        map[bName] = (map[bName] || 0) + 1
      }
    })
    return map
  }, [orders])

  // Filtered Brands List in Sidebar
  const filteredBrandsList = useMemo(() => {
    if (!brandSearchTerm.trim()) return brands
    const term = brandSearchTerm.toLowerCase().trim()
    return brands.filter(b => b.name.toLowerCase().includes(term))
  }, [brands, brandSearchTerm])

  // Active Shift Orders Calculation (since last day closeout or today's start)
  const activeShiftOrders = useMemo(() => {
    if (shiftStartTime) {
      return orders.filter(o => o.order_date > shiftStartTime)
    }
    const todayStr = getIsraelDateString()
    return orders.filter(o => {
      const d = o.order_date || ''
      return d.startsWith(todayStr) || (d && new Date(d).toDateString() === new Date().toDateString())
    })
  }, [orders, shiftStartTime])

  // End-of-Day Closeout (Z-Report) Live Preview Computation
  const dayCloseoutPreview = useMemo(() => {
    const activeOrders = activeShiftOrders || []
    const STANDARD_FEE = 100
    const BAT_YAM_FEE = 50

    // Group recorded settlements by courier during this active shift
    const settledPayByCourier = new Map<string, { totalPay: number; totalBonus: number; count: number }>()
    for (const s of recentSettlements || []) {
      if (s.courier_id && !s.notes?.includes('סגירת יום רשמית') && s.status === 'SETTLED') {
        const isWithinShift = shiftStartTime ? (s.created_at && s.created_at > shiftStartTime) : true
        if (isWithinShift) {
          const prev = settledPayByCourier.get(s.courier_id) || { totalPay: 0, totalBonus: 0, count: 0 }
          settledPayByCourier.set(s.courier_id, {
            totalPay: prev.totalPay + (Number(s.courier_pay) || 0),
            totalBonus: prev.totalBonus + (Number(s.bonus_amount) || 0),
            count: prev.count + 1
          })
        }
      }
    }

    const map = new Map<string, {
      courier_id: string
      courier_name: string
      orders_count: number
      gross_collected: number
      cash_collected: number
      bit_collected: number
      crypto_collected: number
      courier_fee: number
      bonus: number
      net_to_safe: number
    }>()

    for (const o of activeOrders) {
      const c = o.crm_couriers
      const cId = c?.id || o.courier_id || 'unassigned'
      const cName = c?.name || (cId === 'unassigned' ? (isRtl ? 'ללא שליח' : 'Unassigned') : 'שליח')

      if (!map.has(cId)) {
        map.set(cId, {
          courier_id: cId,
          courier_name: cName,
          orders_count: 0,
          gross_collected: 0,
          cash_collected: 0,
          bit_collected: 0,
          crypto_collected: 0,
          courier_fee: 0,
          bonus: 0,
          net_to_safe: 0
        })
      }

      const entry = map.get(cId)!
      entry.orders_count += 1
      const price = Number(o.total_price) || 0
      const payInfo = getOrderPaymentInfo(o)
      const physicalCash = payInfo.isPrepaid ? 0 : price
      const isBit = payInfo.paymentMethod === 'BIT'
      const isCrypto = payInfo.paymentMethod === 'CRYPTO'

      entry.gross_collected += price
      entry.cash_collected += physicalCash
      entry.bit_collected += (isBit ? price : 0)
      entry.crypto_collected = (entry.crypto_collected || 0) + (isCrypto ? price : 0)

      const hasSettlements = settledPayByCourier.has(cId)
      if (cId !== 'unassigned') {
        // If courier already did intermediate settlements, ONLY calculate fee for newly added / unsettled orders!
        if (!hasSettlements || !o.is_settled) {
          const isBatYam = isBatYamOrder(o)
          entry.courier_fee += isBatYam ? BAT_YAM_FEE : STANDARD_FEE
        }
      }
    }

    let totalGross = 0
    let totalPhysicalCash = 0
    let totalBitOnly = 0
    let totalCrypto = 0
    let totalBitCredit = 0
    let totalCourierPay = 0
    const couriersList: any[] = []

    map.forEach((entry) => {
      const settledInfo = settledPayByCourier.get(entry.courier_id)
      if (settledInfo) {
        entry.courier_fee += settledInfo.totalPay
        entry.bonus = settledInfo.totalBonus
      }
      // Courier only deposits physical cash in the safe
      entry.net_to_safe = Math.max(0, entry.cash_collected - entry.courier_fee)
      totalGross += entry.gross_collected
      totalPhysicalCash += entry.cash_collected
      totalBitOnly += entry.bit_collected
      totalCrypto += (entry.crypto_collected || 0)
      totalBitCredit += (entry.bit_collected + (entry.crypto_collected || 0))
      totalCourierPay += entry.courier_fee
      couriersList.push(entry)
    })

    const netToSafe = Math.max(0, totalPhysicalCash - totalCourierPay)
    const creditProviderBalance = totalBitCredit
    const totalBusinessNet = netToSafe + creditProviderBalance

    return {
      totalOrders: activeOrders.length,
      totalGross,
      totalPhysicalCash,
      totalBitCredit,
      totalBitOnly,
      totalCrypto,
      totalCourierPay,
      netToSafe,
      creditProviderBalance,
      totalBusinessNet,
      couriersList
    }
  }, [activeShiftOrders, recentSettlements, shiftStartTime, isRtl])

  // Filtered Orders Calculation
  const filteredOrders = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const todayStr = getIsraelDateString()

    return orders.filter(order => {
      // Shift filter
      if (todayOnly) {
        if (shiftStartTime) {
          if (order.order_date <= shiftStartTime) return false
        } else {
          const orderDateStr = order.order_date || ''
          const isToday =
            orderDateStr.startsWith(todayStr) ||
            (orderDateStr && new Date(orderDateStr).toDateString() === new Date().toDateString())
          if (!isToday) return false
        }
      }

      // Settlement filter
      if (settlementFilter === 'OPEN' && order.is_settled) return false
      if (settlementFilter === 'SETTLED' && !order.is_settled) return false

      // Brand filter (from Sidebar)
      if (selectedBrand !== 'ALL') {
        const brandName = order.brands?.name || ''
        if (brandName !== selectedBrand) return false
      }

      // City filter (from Sidebar)
      if (selectedCity !== 'ALL') {
        const orderCity = (order.city || '').trim()
        if (orderCity !== selectedCity.trim() && !order.address?.includes(selectedCity)) {
          return false
        }
      }

      // Omnibox Query
      if (query) {
        const addr = (order.address || '').toLowerCase()
        const custName = (order.crm_customers?.address_name || '').toLowerCase()
        const phone = (order.crm_customers?.phone_number || '').toLowerCase()
        const tg = (order.crm_customers?.telegram_handle || '').toLowerCase()
        const menu = (order.menu_items || '').toLowerCase()
        const actual = (order.actual_items || '').toLowerCase()
        const city = (order.city || '').toLowerCase()
        const brand = (order.brands?.name || '').toLowerCase()

        const matches =
          addr.includes(query) ||
          custName.includes(query) ||
          phone.includes(query) ||
          tg.includes(query) ||
          menu.includes(query) ||
          actual.includes(query) ||
          city.includes(query) ||
          brand.includes(query)

        if (!matches) return false
      }

      return true
    })
  }, [orders, searchQuery, selectedBrand, selectedCity, todayOnly, settlementFilter])

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (selectedBrand !== 'ALL') count++
    if (selectedCity !== 'ALL') count++
    if (!todayOnly) count++
    if (settlementFilter !== 'ALL') count++
    if (searchQuery) count++
    return count
  }, [selectedBrand, selectedCity, todayOnly, settlementFilter, searchQuery])

  const resetAllFilters = () => {
    setSelectedBrand('ALL')
    setSelectedCity('ALL')
    setTodayOnly(true)
    setSettlementFilter('ALL')
    setSearchQuery('')
    setBrandSearchTerm('')
  }

  // Deduplicated Customer Directory list
  const customerList = useMemo(() => {
    if (customers && customers.length > 0) return customers
    const map: Record<string, Customer> = {}
    orders.forEach(o => {
      const phone = o.crm_customers?.phone_number || ''
      if (!phone) return
      if (!map[phone]) {
        map[phone] = {
          id: o.crm_customers?.id || `cust-${phone}`,
          address_name: o.crm_customers?.address_name || o.address,
          phone_number: phone,
          city: o.city,
          telegram_handle: o.crm_customers?.telegram_handle,
          customer_type: o.crm_customers?.customer_type || 'קבוע',
          total_orders: 1,
          total_spent: Number(o.total_price) || 0,
          brands: o.brands ? { name: o.brands.name } : undefined
        }
      } else {
        map[phone].total_orders = (map[phone].total_orders || 1) + 1
        map[phone].total_spent = (map[phone].total_spent || 0) + (Number(o.total_price) || 0)
      }
    })
    return Object.values(map)
  }, [customers, orders])

  const filteredCustomers = useMemo(() => {
    return customerList.filter(c => {
      if (customerCityFilter !== 'ALL' && c.city !== customerCityFilter) return false
      const q = customerSearch.toLowerCase().trim()
      if (!q) return true
      return (
        (c.address_name && c.address_name.toLowerCase().includes(q)) ||
        (c.phone_number && c.phone_number.includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.telegram_handle && c.telegram_handle.toLowerCase().includes(q))
      )
    })
  }, [customerList, customerSearch, customerCityFilter])

  // Inventory Filter selectors
  const inventoryCategories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)))
    return ['ALL', ...cats]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (inventoryCategory !== 'ALL' && p.category !== inventoryCategory) {
        return false
      }
      const stock = Number(p.stock_on_hand) || 0
      const minAlert = Number(p.min_stock_alert) || 10
      if (inventoryStatusFilter === 'LOW' && (stock > minAlert || stock <= 0)) {
        return false
      }
      if (inventoryStatusFilter === 'OUT' && stock > 0) {
        return false
      }
      if (inventorySearch.trim()) {
        const q = inventorySearch.toLowerCase().trim()
        const inName = p.name.toLowerCase().includes(q)
        const inAliases = p.aliases?.some(a => a.toLowerCase().includes(q))
        return inName || inAliases
      }
      return true
    })
  }, [products, inventoryCategory, inventoryStatusFilter, inventorySearch])

  // Telegram test parser handler
  const handleTestParse = () => {
    try {
      const res = parseSingleOrderMessage(testTelegramText)
      setParsedTestResult(res)
    } catch (e: any) {
      console.error('Test parse error:', e)
    }
  }

  // Export to CSV with UTF-8 BOM
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return

    const headers = [
      t.colCustomerName,
      t.colCourier || 'Assigned Courier',
      t.colCity,
      t.colPhone,
      t.colTelegram,
      t.colLastBrand,
      t.colMenuItems,
      t.colActualItems,
      t.colPrice,
      'Date'
    ]

    const rows = filteredOrders.map(o => [
      `"${(o.crm_customers?.address_name || o.address || '').replace(/"/g, '""')}"`,
      `"${(o.crm_couriers?.name || '').replace(/"/g, '""')}"`,
      `"${(o.city || '').replace(/"/g, '""')}"`,
      `"${o.crm_customers?.phone_number || ''}"`,
      `"${o.crm_customers?.telegram_handle || ''}"`,
      `"${(o.brands?.name || '').replace(/"/g, '""')}"`,
      `"${(o.menu_items || '').replace(/"/g, '""')}"`,
      `"${(o.actual_items || '').replace(/"/g, '""')}"`,
      o.total_price || 0,
      `"${new Date(o.order_date).toLocaleString()}"`
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Persian_Team_Management_Orders_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Stock Adjustment Submit
  const handleStockAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustingProduct) return
    const numericQty = parseFloat(adjustQty)
    if (isNaN(numericQty) || numericQty <= 0) {
      alert('Please enter a valid positive quantity')
      return
    }

    const delta = adjustType === 'ADD' ? numericQty : -numericQty

    try {
      setIsSubmittingAdjust(true)
      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADJUST_STOCK',
          productId: adjustingProduct.id,
          adjustmentQuantity: delta,
          reason: adjustReason,
          notes: adjustNotes
        })
      })
      if (!res.ok) throw new Error('Stock adjustment failed')
      setNotification(`${delta > 0 ? '+' : ''}${delta} ${adjustingProduct.unit === 'g' ? t.grams : t.units} updated for ${adjustingProduct.name}`)
      setAdjustingProduct(null)
      fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmittingAdjust(false)
    }
  }

  // Courier Settlement Submit
  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settlingCourier) return

    const gross = parseFloat(grossInput)
    if (isNaN(gross) || gross < 0) {
      alert('Please enter a valid gross cash amount')
      return
    }
    const bonus = Math.max(0, parseFloat(bonusInput) || 0)

    try {
      setIsSubmittingSettle(true)
      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SETTLE_COURIER',
          courierId: settlingCourier.id,
          grossCollected: gross,
          bonusAmount: bonus,
          batYamCount: safeBatYamCount,
          standardCount: safeStandardCount,
          deliveryFees: previewDeliveryFees,
          notes: settlementNotes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Settlement failed')
      setNotification(t.shiftClosedAlert)
      setSettlingCourier(null)
      fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmittingSettle(false)
    }
  }

  // End-of-Day Shift Closeout (Z-Report) Submit
  const handleDayCloseoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSubmittingDayCloseout(true)
      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLOSE_DAY',
          notes: dayCloseoutNotes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to close day')

      setShowDayCloseoutModal(false)
      setDayCloseoutNotes('')
      setNotification(
        isRtl
          ? `יום העבודה נסגר בהצלחה! הדוחות נשלחו בטלגרם למחסנאי (${data.warehouseSent || 0}) ולמנהל החשבונות (${data.accountantSent || 0}). הקופה אופסה לקראת מחר.`
          : `Day shift closed! Reports sent to warehouseman (${data.warehouseSent || 0}) and accountant (${data.accountantSent || 0}). Register reset for tomorrow.`
      )
      fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmittingDayCloseout(false)
    }
  }

  // One-Click Purge Demo Data for Live Telegram Ingestion
  const handlePurgeDemoData = async () => {
    try {
      setIsPurgingDemo(true)
      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PURGE_DEMO_DATA' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to purge demo data')
      setShowPurgeModal(false)
      setNotification('All demo orders purged. Persian Team Management is ready for live Telegram forwarding.')
      fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsPurgingDemo(false)
    }
  }

  // Assign Courier to Order Handler
  const handleAssignCourier = async (orderId: string, courierId: string | null) => {
    try {
      // Optimistic update of local order state
      setOrders(prev => prev.map(o => {
        if (o.id !== orderId) return o
        const matchingCourier = couriers.find(c => c.id === courierId)
        return {
          ...o,
          courier_id: courierId,
          crm_couriers: matchingCourier ? {
            id: matchingCourier.id,
            name: matchingCourier.name,
            phone_number: matchingCourier.phone_number
          } : undefined
        }
      }))

      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ASSIGN_ORDER_COURIER',
          orderId,
          courierId
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign courier')

      const courierName = couriers.find(c => c.id === courierId)?.name
      setNotification(
        courierId
          ? (isRtl ? `המשלוח שובץ בהצלחה לשליח ${courierName}` : `Order assigned to ${courierName}.`)
          : (isRtl ? 'ההזמנה הוחזרה לסטטוס ללא שליח' : 'Order unassigned.')
      )
      fetchData()
    } catch (err: any) {
      alert(err.message)
      fetchData()
    }
  }

  if (!mounted || authChecking) {
    return (
      <div className="min-h-screen bg-[#0A0D14] flex flex-col items-center justify-center text-slate-400 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#4352E8]/10 border border-[#4352E8]/20 flex items-center justify-center shadow-lg shadow-[#4352E8]/20">
          <RefreshIcon className="w-6 h-6 animate-spin text-[#4352E8]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white tracking-wide">Persian Team Management</p>
          <p className="text-xs text-slate-500 mt-1">Verifying authenticated manager session & credentials...</p>
        </div>
      </div>
    )
  }

  // Computed settlement values with accurate Bat Yam (₪50) and Standard (₪100) rates
  const settleOrderCount    = settlingCourier?.todayOrders || 0
  const parsedGross         = parseFloat(grossInput) || 0
  const parsedBonus         = Math.max(0, parseFloat(bonusInput) || 0)
  const safeBatYamCount     = Math.min(settleOrderCount, Math.max(0, batYamCountInput))
  const safeStandardCount   = Math.max(0, settleOrderCount - safeBatYamCount)
  const previewDeliveryFees = (safeStandardCount * 100) + (safeBatYamCount * 50)
  const previewCourierPay   = previewDeliveryFees + parsedBonus
  const previewNet          = Math.max(0, parsedGross - previewCourierPay)

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="h-screen h-[100dvh] w-full max-w-full overflow-hidden bg-[#F8FAFC] dark:bg-[#070A11] text-slate-900 dark:text-slate-100 font-sans flex antialiased transition-colors duration-200"
    >
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 border border-emerald-500 text-white px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
          <CheckIcon className="w-5 h-5" />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* FULL IN-APP CRUD MODALS (PRODUCTS, BRANDS, COURIERS)      */}
      {/* ======================================================== */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false)
          setEditingProduct(null)
        }}
        initialProduct={editingProduct}
        onSuccess={(msg) => {
          setNotification(msg)
          fetchData()
        }}
        isRtl={isRtl}
      />

      <ProductDeleteModal
        product={deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onSuccess={(msg) => {
          setNotification(msg)
          fetchData()
        }}
        isRtl={isRtl}
      />

      <BrandManagerModal
        isOpen={showBrandManagerModal}
        onClose={() => setShowBrandManagerModal(false)}
        brands={brands}
        orders={orders}
        onRefresh={fetchData}
        isRtl={isRtl}
      />

      <CourierModal
        isOpen={showCourierModal}
        onClose={() => {
          setShowCourierModal(false)
          setEditingCourier(null)
        }}
        initialCourier={editingCourier}
        onSuccess={(msg) => {
          setNotification(msg)
          fetchData()
        }}
        isRtl={isRtl}
      />

      <CourierDeleteModal
        courier={deletingCourier}
        onClose={() => setDeletingCourier(null)}
        onSuccess={(msg) => {
          setNotification(msg)
          fetchData()
        }}
        isRtl={isRtl}
      />

      <OrderDraftModal
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        order={editingOrder}
        onSuccess={(msg) => {
          setNotification(msg)
          fetchData()
        }}
        isRtl={isRtl}
        couriers={couriers}
      />

      <OrderDeleteModal
        isOpen={!!deletingOrder}
        onClose={() => setDeletingOrder(null)}
        order={deletingOrder}
        onSuccess={(msg) => {
          setNotification(msg)
          fetchData()
        }}
        isRtl={isRtl}
      />

      {/* ======================================================== */}
      {/* MODAL 1: STOCK ADJUSTMENT                                 */}
      {/* ======================================================== */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div
            className="relative w-full max-w-md my-auto rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BoxIcon className="w-5 h-5 text-[#4352E8] dark:text-indigo-400 shrink-0" />
                <span>{t.adjustStockModalTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStockAdjustmentSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 overscroll-contain">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.productName}</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{adjustingProduct.name}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.stockOnHand}</p>
                    <p className="font-bold text-[#4352E8] dark:text-indigo-400 text-sm">
                      {adjustingProduct.stock_on_hand} {adjustingProduct.unit === 'g' ? t.grams : t.units}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.adjustmentType}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustType('ADD')}
                      className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        adjustType === 'ADD'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {t.addStock}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('DEDUCT')}
                      className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        adjustType === 'DEDUCT'
                          ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {t.deductStock}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.adjustmentAmount} ({adjustingProduct.unit === 'g' ? t.grams : t.units})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={adjustQty}
                    onChange={e => setAdjustQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.reason}
                  </label>
                  <select
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
                  >
                    <option value="RESTOCK">{t.reasonRestock}</option>
                    <option value="PHYSICAL_AUDIT">{t.reasonAudit}</option>
                    <option value="DAMAGED">{t.reasonDamaged}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.notes}
                  </label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={e => setAdjustNotes(e.target.value)}
                    placeholder="Optional audit comment..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="px-5 py-2.5 rounded-xl bg-[#4352E8] hover:bg-[#3844D0] text-white text-xs font-bold transition shadow-md shadow-indigo-200 dark:shadow-indigo-950 cursor-pointer"
                >
                  {isSubmittingAdjust ? 'Saving...' : t.saveAdjustment}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: COURIER SETTLEMENT                               */}
      {/* ======================================================== */}
      {settlingCourier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
          <div
            className="relative w-full max-w-lg h-full max-h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[88vh] rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Modal Header — Pinned at Top */}
            <div className="shrink-0 flex items-center justify-between bg-emerald-600 dark:bg-emerald-700 px-4 sm:px-5 py-3.5 border-b border-emerald-500/30 z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <WalletIcon className="w-5 h-5 text-white shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{t.settleModalTitle}</h3>
                  <p className="text-[11px] text-emerald-100 font-medium truncate">{settlingCourier.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettlingCourier(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 text-base cursor-pointer transition shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Form with Scrollable Content Body */}
            <form onSubmit={handleSettlementSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                {/* Incremental Multi-Run Notice */}
                {settlingCourier.settledOrdersToday && settlingCourier.settledOrdersToday > 0 ? (
                  <div className="p-3 sm:p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-bold">
                      <span className="flex items-center gap-1.5">
                        <span>🔄</span>
                        <span>{t.additionalRunNotice || 'סבב נוסף להיום'}</span>
                      </span>
                      <span className="text-[11px] font-mono bg-white/80 dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 w-fit">
                        {settlingCourier.settledOrdersToday} {t.ordersDelivered || 'משלוחים'} {t.reconciledEarlier || 'כבר נסגרו והועברו'}
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
                      ₪{Number(settlingCourier.settledNetCashToday || settlingCourier.settledCashToday || 0).toLocaleString()} (נטו) כבר נמסרו למחסנאי בסגירה הקודמת. חישוב זה כולל <strong>אך ורק</strong> את המשלוחים החדשים מהסבב הנוכחי!
                    </p>
                  </div>
                ) : null}

                {/* Row 1 — Orders today */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5 truncate">
                      {t.ordersToSettleCount || t.ordersCount}
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{settleOrderCount}</p>
                    {settlingCourier.totalOrdersToday && settlingCourier.totalOrdersToday > settleOrderCount ? (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        (מתוך {settlingCourier.totalOrdersToday} סה״כ היום)
                      </p>
                    ) : null}
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5 truncate">
                      {t.deliveryFeesBreakdown}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-semibold truncate">
                      {safeBatYamCount > 0 ? (
                        <>
                          {safeStandardCount} × ₪100 + {safeBatYamCount} × ₪50 = <span className="text-emerald-600 dark:text-emerald-400 font-black">₪{previewDeliveryFees.toLocaleString()}</span>
                        </>
                      ) : (
                        <>
                          {settleOrderCount} × ₪100 = <span className="text-emerald-600 dark:text-emerald-400 font-black">₪{previewDeliveryFees.toLocaleString()}</span>
                        </>
                      )}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 truncate">
                      {safeBatYamCount > 0
                        ? `(כולל ${safeBatYamCount} בת ים לפי ₪50)`
                        : `(כל המשלוחים רגילים ₪100)`}
                    </p>
                  </div>
                </div>

                {/* Bat Yam Adjustment Stepper */}
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">🌊</span>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        {isRtl ? 'משלוחי בת ים (₪50 למשלוח)' : 'Bat Yam Deliveries (₪50 each)'}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300/80 mt-0.5 truncate">
                      {safeBatYamCount > 0
                        ? (isRtl ? `${safeBatYamCount} בת ים (₪50) + ${safeStandardCount} רגיל (₪100)` : `${safeBatYamCount} Bat Yam (₪50) + ${safeStandardCount} Standard (₪100)`)
                        : (isRtl ? `ללא משלוחי בת ים (כל ${settleOrderCount} המשלוחים לפי ₪100)` : `No Bat Yam deliveries (all ${settleOrderCount} at ₪100)`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 bg-white dark:bg-slate-900 rounded-lg p-1 border border-amber-200 dark:border-amber-800">
                    <button
                      type="button"
                      disabled={safeBatYamCount <= 0}
                      onClick={() => setBatYamCountInput(prev => Math.max(0, prev - 1))}
                      className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-base flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                      title={isRtl ? 'הפחת משלוח בת ים (-1)' : 'Decrease Bat Yam (-1)'}
                    >
                      -
                    </button>
                    <span className="w-7 text-center font-mono font-black text-sm text-amber-900 dark:text-amber-200">
                      {safeBatYamCount}
                    </span>
                    <button
                      type="button"
                      disabled={safeBatYamCount >= settleOrderCount}
                      onClick={() => setBatYamCountInput(prev => Math.min(settleOrderCount, prev + 1))}
                      className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-base flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                      title={isRtl ? 'הוסף משלוח בת ים (+1)' : 'Increase Bat Yam (+1)'}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Prepaid Bit / Credit Notice */}
                {settlingCourier.todayBit && settlingCourier.todayBit > 0 ? (
                  <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-xs text-indigo-950 dark:text-indigo-200 flex flex-col gap-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <span>📱</span>
                        <span>{isRtl ? 'שולם מראש בביט / אשראי:' : 'Prepaid via Bit / Credit:'}</span>
                      </span>
                      <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                        ₪{Number(settlingCourier.todayBit).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
                      {isRtl
                        ? 'סכום זה שולם ישירות בביט / אשראי — השליח אינו מחזיק במזומן זה ואינו נדרש להעבירו למחסנאי.'
                        : 'This amount was paid in advance — the courier did not collect cash and is not required to deposit it.'}
                    </p>
                  </div>
                ) : null}

                {/* Row 2 — Gross cash collected */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.grossCollected}
                    <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-normal text-[10px]">({t.grossCollectedHint})</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={grossInput}
                    onChange={e => setGrossInput(e.target.value)}
                    placeholder="e.g. 1200"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-base font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                {/* Row 3 — Manual bonus */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.bonusAmount}
                    <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-normal text-[10px]">({t.bonusHint})</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={bonusInput}
                    onChange={e => setBonusInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-base font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                {/* Computed Summary Panel */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.courierEarns}</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">₪{previewCourierPay.toLocaleString()}</span>
                  </div>
                  <div className={`px-4 py-3 flex items-center justify-between ${
                    parsedGross > 0
                      ? 'bg-amber-50 dark:bg-amber-500/10'
                      : 'bg-slate-50 dark:bg-slate-900/40'
                  }`}>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.netToWarehouse}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{t.netToWarehouseHint}</p>
                    </div>
                    <span className={`text-xl font-black font-mono ${
                      parsedGross > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                    }`}>
                      ₪{previewNet.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t.notes}</label>
                  <input
                    type="text"
                    value={settlementNotes}
                    onChange={e => setSettlementNotes(e.target.value)}
                    placeholder="Optional shift notes..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                {/* Telegram Notice */}
                <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl px-3.5 py-2.5 border border-slate-100 dark:border-slate-800">
                  <span className="text-base leading-none mt-0.5 shrink-0">📲</span>
                  <span>Telegram receipts will be sent to the courier and the admin group automatically.</span>
                </div>
              </div>

              {/* Modal Footer — Pinned at Bottom */}
              <div className="shrink-0 flex items-center justify-end gap-2 px-4 sm:px-5 py-3 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 z-10">
                <button
                  type="button"
                  onClick={() => setSettlingCourier(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle || !grossInput}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-200 dark:shadow-emerald-950 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSettle ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/></svg>
                      Settling...
                    </>
                  ) : (
                    <>{t.confirmSettlement}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PURGE DEMO DATA CONFIRMATION                     */}
      {/* ======================================================== */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0B0F17] border border-rose-100 dark:border-rose-950/40 shadow-2xl p-6 space-y-5"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <LogoutIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Purge Demo Data</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Wipe demo orders for live Telegram forwarding</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 p-4 space-y-3 text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Are you ready to transition from demo mode to live operations?
              </p>
              <div className="space-y-2 text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-2 text-rose-600 dark:text-rose-400">
                  <span>🗑️</span>
                  <span><strong>Wipes:</strong> All current demonstration orders, customer records, and daily settlement logs.</span>
                </div>
                <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400">
                  <span>🛡️</span>
                  <span><strong>Preserves:</strong> All 37 catalog brands, 29/9 live warehouse products stock, and courier accounts.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                disabled={isPurgingDemo}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handlePurgeDemoData}
                disabled={isPurgingDemo}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPurgingDemo ? (
                  <>
                    <RefreshIcon className="w-4 h-4 animate-spin text-white" />
                    <span>Purging Live Slate...</span>
                  </>
                ) : (
                  <span>Yes, Purge Demo Orders</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: END-OF-DAY CLOSEOUT (Z-REPORT) MODAL             */}
      {/* ======================================================== */}
      {showDayCloseoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-hidden animate-in fade-in">
          <div
            className="w-full max-w-2xl h-full max-h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[90vh] rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Modal Header — Pinned at Top */}
            <div className="shrink-0 flex items-start justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-white dark:bg-[#0B0F17] z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-lg sm:text-xl shrink-0">
                  🌙
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {t.closeDayModalTitle || 'סגירת יום עבודה ודוח סוף יום (Z-Report)'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                    {t.closeDayModalSubtitle || 'סגירת הקופה היומית, איפוס ליום חדש למחר, ושליחת דוחות מפורטים למחסנאי ולהנהלת חשבונות.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDayCloseoutModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form with Scrollable Content Body */}
            <form onSubmit={handleDayCloseoutSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div
                data-scrollbar="hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain no-scrollbar"
              >
                {/* Financial Overview Cards — 4-Card Responsive Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate block">
                      {t.totalGrossDay || 'מחזור כללי'}
                    </span>
                    <p className="text-base sm:text-xl font-black font-mono text-slate-900 dark:text-white">
                      ₪{dayCloseoutPreview.totalGross.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {dayCloseoutPreview.totalOrders} {isRtl ? 'משלוחים שסופקו' : 'orders delivered'}
                    </p>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/40 space-y-1">
                    <span className="text-[10px] sm:text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider truncate block flex items-center gap-1">
                      <span>📱🪙</span>
                      <span>{isRtl ? 'ביט / קריפטו מראש' : 'Bit / Crypto Prepaid'}</span>
                    </span>
                    <p className="text-base sm:text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                      ₪{dayCloseoutPreview.totalBitCredit.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/70 font-medium truncate">
                      {isRtl
                        ? `ביט: ₪${(dayCloseoutPreview.totalBitOnly || 0).toLocaleString()} | קריפטו: ₪${(dayCloseoutPreview.totalCrypto || 0).toLocaleString()}`
                        : `Bit: ₪${(dayCloseoutPreview.totalBitOnly || 0).toLocaleString()} | Crypto: ₪${(dayCloseoutPreview.totalCrypto || 0).toLocaleString()}`}
                    </p>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-1">
                    <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider truncate block">
                      {t.totalCourierFeesDay || 'עמלות שליחים'}
                    </span>
                    <p className="text-base sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                      -₪{dayCloseoutPreview.totalCourierPay.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 font-medium truncate">
                      {isRtl ? '₪100 רגיל / ₪50 בת ים' : '₪100 std / ₪50 Bat Yam'}
                    </p>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1 shadow-xs">
                    <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider truncate block">
                      {t.netToBusinessDay || 'נטו מזומן לכספת'}
                    </span>
                    <p className="text-lg sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      ₪{dayCloseoutPreview.netToSafe.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 font-medium truncate">
                      {isRtl ? 'מזומן פיזי להפקדה' : 'Physical cash to vault'}
                    </p>
                  </div>
                </div>

                {/* Total Business Net Profit Summary Banner */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏦</span>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {isRtl ? 'סה״כ רווח נקי כולל לעסק (כספת + ספק אשראי)' : 'Total Business Net Profit (Vault + Credit Provider)'}
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isRtl
                          ? `₪${dayCloseoutPreview.netToSafe.toLocaleString()} מזומן בכספת + ₪${dayCloseoutPreview.totalBitCredit.toLocaleString()} שמורים אצל ספק האשראי`
                          : `₪${dayCloseoutPreview.netToSafe.toLocaleString()} in safe + ₪${dayCloseoutPreview.totalBitCredit.toLocaleString()} held with credit provider`}
                      </p>
                    </div>
                  </div>
                  <span className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                    ₪{dayCloseoutPreview.totalBusinessNet.toLocaleString()}
                  </span>
                </div>

                {/* Courier Breakdown Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {t.couriersSummaryTable || 'פירוט לפי שליחים'}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {dayCloseoutPreview.couriersList.length} {isRtl ? 'שליחים פעילים' : 'active couriers'}
                    </span>
                  </div>
                  <div className="max-h-44 sm:max-h-48 overflow-y-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs" dir={isRtl ? 'rtl' : 'ltr'}>
                      <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">שליח / Courier</th>
                          <th className="py-2.5 px-3 text-center">משלוחים</th>
                          <th className="py-2.5 px-3">גבייה ברוטו</th>
                          <th className="py-2.5 px-3 text-indigo-600 dark:text-indigo-400">שולם בביט</th>
                          <th className="py-2.5 px-3">עמלת שליח</th>
                          <th className="py-2.5 px-3 font-extrabold text-emerald-600 dark:text-emerald-400">נטו לכספת</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {dayCloseoutPreview.couriersList.length > 0 ? (
                          dayCloseoutPreview.couriersList.map(c => (
                            <tr key={c.courier_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                {c.courier_name}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300">
                                {c.orders_count}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                                ₪{c.gross_collected.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-400">
                                {c.bit_collected > 0 ? `₪${c.bit_collected.toLocaleString()}` : '—'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">
                                -₪{c.courier_fee.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                ₪{c.net_to_safe.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-xs text-slate-400">
                              {isRtl ? 'אין משלוחים פעילים במשמרת זו' : 'No active deliveries in this shift'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.notes}
                  </label>
                  <textarea
                    rows={4}
                    value={dayCloseoutNotes}
                    onChange={e => setDayCloseoutNotes(e.target.value)}
                    placeholder={t.dayCloseoutNotesPlaceholder || 'הערות סיכום יום (אופציונלי)...'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y leading-relaxed font-sans"
                  />
                </div>

                {/* Telegram Auto-Dispatch Indicator Cards */}
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {t.notifiedParties || 'נמעני דוחות אוטומטיים בטלגרם:'}
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="text-base leading-none">📦</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {t.warehouseReportBadge || 'מחסנאי: דוח מעטפות מזומן והפקדה לכספת'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="text-base leading-none">📊</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {t.accountingReportBadge || 'מנהל חשבונות: דוח פיננסי מלא (הכנסות, עמלות, רווח נטו)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer — Pinned at Bottom, ALWAYS Visible */}
              <div className="shrink-0 flex items-center justify-end gap-2 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 z-10">
                <button
                  type="button"
                  onClick={() => setShowDayCloseoutModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDayCloseout}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-black transition shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDayCloseout ? (
                    <>
                      <RefreshIcon className="w-4 h-4 animate-spin text-white" />
                      <span>{isRtl ? 'סוגר משמרת ושולח דוחות...' : 'Closing shift & dispatching...'}</span>
                    </>
                  ) : (
                    <>
                      <span>🌙</span>
                      <span>{t.confirmCloseDay || 'אשר סגירת יום ושלח דוחות'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: PAST CLOSEOUT DETAIL (Z-REPORT AUDIT BREAKDOWN)  */}
      {/* ======================================================== */}
      {selectedCloseoutDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-hidden animate-in fade-in">
          <div
            className="w-full max-w-2xl h-full max-h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[90vh] rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Header — Pinned at Top */}
            <div className="shrink-0 flex items-start justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-white dark:bg-[#0B0F17] z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-lg">
                  📑
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isRtl ? 'דוח סגירת יום מפורט (Z-Report)' : 'Day Closeout Audit Breakdown'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {new Date(selectedCloseoutDetail.shift_end || selectedCloseoutDetail.created_at).toLocaleString([], {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })} • {isRtl ? 'נסגר ע״י' : 'Closed by'}: {selectedCloseoutDetail.closed_by_name || 'מנהל'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCloseoutDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div
              data-scrollbar="hidden"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain no-scrollbar"
            >

            {/* Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">ברוטו שנגבה</span>
                <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  ₪{Number(selectedCloseoutDetail.gross_collected || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {selectedCloseoutDetail.total_orders} {isRtl ? 'משלוחים' : 'orders'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-1">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">עמלות שליחים</span>
                <p className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                  -₪{Number(selectedCloseoutDetail.total_courier_pay || 0).toLocaleString()}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">נטו נשאר בכספת</span>
                <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  ₪{Number(selectedCloseoutDetail.net_to_safe || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                פירוט לפי שליחים
              </h4>
              <div className="max-h-56 overflow-y-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse text-xs" dir={isRtl ? 'rtl' : 'ltr'}>
                  <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 px-3">שליח</th>
                      <th className="py-2 px-3 text-center">משלוחים</th>
                      <th className="py-2 px-3">גבייה ברוטו</th>
                      <th className="py-2 px-3">עמלת שליח</th>
                      <th className="py-2 px-3 font-bold text-emerald-600">נטו לכספת</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {selectedCloseoutDetail.courier_breakdown && selectedCloseoutDetail.courier_breakdown.length > 0 ? (
                      selectedCloseoutDetail.courier_breakdown.map((c: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                            {c.courier_name}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-300">
                            {c.orders_count}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                            ₪{Number(c.gross_collected || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 font-mono text-amber-600 dark:text-amber-400">
                            -₪{Number(c.courier_fee || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ₪{Number(c.net_to_safe || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-xs text-slate-400">
                          אין פירוט שליחים זמין
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes if any */}
            {selectedCloseoutDetail.notes && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-white mr-1.5">הערות:</span>
                {selectedCloseoutDetail.notes}
              </div>
            )}

            </div>

            {/* Modal Footer — Pinned at Bottom */}
            <div className="shrink-0 flex justify-end p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 z-10">
              <button
                type="button"
                onClick={() => setSelectedCloseoutDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. DISPATCH DETAIL DRAWER (Standard CRM Pattern)         */}
      {/* ======================================================== */}
      {selectedOrderForDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
          <div
            data-scrollbar="hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            className="w-full max-w-lg bg-white dark:bg-[#0B0F17] h-full shadow-2xl p-6 overflow-y-auto space-y-6 border-l border-slate-200 dark:border-slate-800 no-scrollbar"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-[#4352E8] dark:text-indigo-400">
                  <TruckIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{t.orderDetails}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    {new Date(selectedOrderForDrawer.order_date).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForDrawer(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Identity Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Customer Identity (Address)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                  {selectedOrderForDrawer.crm_customers?.customer_type || 'REGULAR'}
                </span>
              </div>
              <p className="text-base font-extrabold text-slate-900 dark:text-white">
                {selectedOrderForDrawer.crm_customers?.address_name || selectedOrderForDrawer.address}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <MapPinIcon className="w-4 h-4 text-[#4352E8] dark:text-indigo-400" />
                <span>{selectedOrderForDrawer.city}</span>
              </div>
            </div>

            {/* Phone & Contact Shortcuts */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Secure Contact</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                  {selectedOrderForDrawer.crm_customers?.phone_number || '—'}
                </span>
                <div className="flex items-center gap-2">
                  {selectedOrderForDrawer.crm_customers?.phone_number && (
                    <>
                      <a
                        href={`https://wa.me/${selectedOrderForDrawer.crm_customers.phone_number.replace(/\D/g, '').replace(/^0/, '972')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold text-xs transition flex items-center gap-1.5"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={`tel:${selectedOrderForDrawer.crm_customers.phone_number}`}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-[#4352E8] dark:text-indigo-400 font-semibold text-xs transition flex items-center gap-1.5"
                      >
                        <PhoneIcon className="w-4 h-4" />
                        <span>Call</span>
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Item vs Warehouse Deduction (The Slash Rule) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Customer Menu Order</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedOrderForDrawer.menu_items || '—'}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/30 space-y-1">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Warehouse Stock Deducted</span>
                <p className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">
                  {selectedOrderForDrawer.actual_items || '—'}
                </p>
              </div>
            </div>

            {/* Price & Settlement Info */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cash Collected</span>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  ₪{Number(selectedOrderForDrawer.total_price || 0).toLocaleString()}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${
                  selectedOrderForDrawer.is_settled
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                }`}
              >
                {selectedOrderForDrawer.is_settled ? t.settled : t.pending}
              </span>
            </div>

            {/* Raw Forwarded Telegram Audit Message */}
            {selectedOrderForDrawer.raw_message && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.rawTelegramMessage}</span>
                <pre className="p-3.5 rounded-xl bg-slate-900 dark:bg-slate-950 text-slate-200 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto border border-transparent dark:border-slate-800">
                  {selectedOrderForDrawer.raw_message}
                </pre>
              </div>
            )}

            {/* Quick Actions in Drawer: Edit Draft & Cancel Order */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const targetOrder = selectedOrderForDrawer
                  setSelectedOrderForDrawer(null)
                  setEditingOrder(targetOrder)
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-[#4352E8] dark:text-indigo-400 font-bold text-xs transition cursor-pointer border border-indigo-200 dark:border-indigo-800/40"
              >
                <EditIcon className="w-4 h-4" />
                <span>{isRtl ? 'ערוך טיוטה והזמנה' : 'Edit Draft & Order'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetOrder = selectedOrderForDrawer
                  setSelectedOrderForDrawer(null)
                  setDeletingOrder(targetOrder)
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs transition cursor-pointer border border-rose-200 dark:border-rose-800/40"
              >
                <TrashIcon className="w-4 h-4" />
                <span>{isRtl ? 'בטל ומחק משלוח' : 'Cancel & Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. LEFT SIDEBAR COMPONENT (PROJECT REQUIREMENTS & FILTERS) */}
      {/* ======================================================== */}
      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 lg:hidden animate-in fade-in transition-opacity cursor-pointer"
          aria-hidden="true"
        />
      )}

      <aside
        data-scrollbar="hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className={`w-80 max-w-[85vw] bg-white dark:bg-[#0B0F17] p-5 flex flex-col justify-between shrink-0 select-none overflow-y-auto overflow-x-hidden no-scrollbar transition-all duration-300 z-30 ${
          isMobileSidebarOpen
            ? `fixed inset-y-0 z-50 shadow-2xl h-full h-[100dvh] ${
                isRtl ? 'right-0 border-l border-slate-200/80 dark:border-slate-800/80' : 'left-0 border-r border-slate-200/80 dark:border-slate-800/80'
              }`
            : `hidden lg:flex h-full ${
                isRtl ? 'border-l border-slate-200/80 dark:border-slate-800/80' : 'border-r border-slate-200/80 dark:border-slate-800/80'
              }`
        }`}
      >
        <div className="space-y-6">
          {/* Brand Logo, Persian Team Management Badge, and Mobile Close ('X') Button */}
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => {
                setActiveNav('dashboard')
                setIsMobileSidebarOpen(false)
              }}
              title={lang === 'he' ? 'חזרה ללוח הבקרה' : 'Return to Dashboard'}
            >
              <GhostCrmLogoIcon className="w-10 h-10 drop-shadow-md shrink-0 group-hover:scale-105 transition-transform" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                    {t.appTitle}
                  </h2>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    v2.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Bilingual Ops & Inventory</p>
              </div>
            </div>

            {/* Close Button on Mobile View */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center shrink-0"
              title="Close Menu"
              aria-label="Close Menu"
            >
              <XIcon className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Project-Specific Core Navigation */}
          <nav className="space-y-1">
            <button
              onClick={() => {
                setActiveNav('dashboard')
                setIsMobileSidebarOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-3 transition cursor-pointer ${
                activeNav === 'dashboard'
                  ? 'bg-[#1E2235] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <GridIcon className="w-4 h-4" />
              <span>{t.navDashboard}</span>
            </button>

            <button
              onClick={() => {
                setActiveNav('orders')
                setIsMobileSidebarOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-between transition cursor-pointer ${
                activeNav === 'orders'
                  ? 'bg-[#1E2235] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <TruckIcon className="w-4 h-4" />
                <span>{t.navDispatches}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeNav === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveNav('inventory')
                setIsMobileSidebarOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-between transition cursor-pointer ${
                activeNav === 'inventory'
                  ? 'bg-[#1E2235] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <BoxIcon className="w-4 h-4" />
                <span>{t.navInventory}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeNav === 'inventory' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {products.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveNav('settlements')
                setIsMobileSidebarOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-between transition cursor-pointer ${
                activeNav === 'settlements'
                  ? 'bg-[#1E2235] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <WalletIcon className="w-4 h-4" />
                <span>{t.navSettlements}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeNav === 'settlements' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {couriers.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveNav('customers')
                setIsMobileSidebarOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-between transition cursor-pointer ${
                activeNav === 'customers'
                  ? 'bg-[#1E2235] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <UsersIcon className="w-4 h-4" />
                <span>{t.navCustomers}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeNav === 'customers' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {metrics.activeCustomers}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveNav('telegram')
                setIsMobileSidebarOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-3 transition cursor-pointer ${
                activeNav === 'telegram'
                  ? 'bg-[#1E2235] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <TelegramIcon className="w-4 h-4 text-[#4352E8]" />
              <span>{t.navTelegramBot}</span>
            </button>

            <button
              onClick={() => {
                setActiveNav('settings')
                setIsMobileSidebarOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-3 transition cursor-pointer ${
                activeNav === 'settings'
                  ? 'bg-[#1E2235] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <SettingsIcon className="w-4 h-4 text-[#4352E8]" />
              <span>{lang === 'he' ? 'הגדרות ופרופיל' : 'Settings & Profile'}</span>
            </button>
          </nav>

          {/* ======================================================== */}
          {/* STRUCTURED FILTERS IN SIDEBAR (Standard CRM Architecture)  */}
          {/* ======================================================== */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4 min-w-0 w-full overflow-hidden">
            <div className="flex items-center justify-between min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 min-w-0 truncate">
                <FilterIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.filtersHeader}</span>
              </span>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="text-[10px] text-[#4352E8] dark:text-indigo-400 hover:underline font-bold cursor-pointer shrink-0 ml-1.5"
                >
                  {t.clearAllFilters} ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Shift Filter: Today's Shift vs All Time */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block truncate">{t.filterShiftTitle}</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-transparent dark:border-slate-800 min-w-0">
                <button
                  onClick={() => setTodayOnly(true)}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer truncate min-w-0 ${
                    todayOnly
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.todayShift}
                </button>
                <button
                  onClick={() => setTodayOnly(false)}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer truncate min-w-0 ${
                    !todayOnly
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.allOrders}
                </button>
              </div>
            </div>

            {/* Settlement Status Filter */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block truncate">Settlement</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-[10px] font-bold text-center border border-transparent dark:border-slate-800 min-w-0">
                <button
                  onClick={() => setSettlementFilter('ALL')}
                  className={`py-1 rounded-lg transition cursor-pointer truncate min-w-0 ${
                    settlementFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSettlementFilter('OPEN')}
                  className={`py-1 rounded-lg transition cursor-pointer truncate min-w-0 ${
                    settlementFilter === 'OPEN'
                      ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Open
                </button>
                <button
                  onClick={() => setSettlementFilter('SETTLED')}
                  className={`py-1 rounded-lg transition cursor-pointer truncate min-w-0 ${
                    settlementFilter === 'SETTLED'
                      ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Settled
                </button>
              </div>
            </div>

            {/* Brand Persona Selector */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{t.filterBrandsTitle}</label>
                  <button
                    type="button"
                    onClick={() => setShowBrandManagerModal(true)}
                    className="p-1 rounded-md text-slate-400 hover:text-[#4352E8] dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition cursor-pointer shrink-0"
                    title="Manage Brand Personas (Add, Edit, Delete)"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                {selectedBrand !== 'ALL' && (
                  <button
                    onClick={() => setSelectedBrand('ALL')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0 ml-1.5"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Brand Search Input */}
              <div className="relative min-w-0">
                <input
                  type="text"
                  value={brandSearchTerm}
                  onChange={e => setBrandSearchTerm(e.target.value)}
                  placeholder={t.searchBrands}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#4352E8]"
                />
              </div>

              {/* Scrollable Brands List */}
              <div
                data-scrollbar="hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                className="max-h-36 overflow-y-auto overflow-x-hidden space-y-0.5 pr-1 no-scrollbar min-w-0 w-full"
              >
                <button
                  onClick={() => setSelectedBrand('ALL')}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium flex items-center justify-between cursor-pointer min-w-0 ${
                    selectedBrand === 'ALL'
                      ? 'bg-slate-900 dark:bg-slate-800 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate min-w-0 flex-1">{t.allBrands}</span>
                  <span className="text-[10px] shrink-0 ml-1.5">{orders.length}</span>
                </button>
                {filteredBrandsList.map(b => {
                  const cnt = brandOrderCounts[b.name] || 0
                  const isSel = selectedBrand === b.name
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBrand(b.name)}
                      className={`w-full text-left px-2 py-1 rounded-md text-xs transition flex items-center justify-between cursor-pointer min-w-0 ${
                        isSel
                          ? 'bg-[#4352E8] text-white font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate min-w-0 flex-1">{b.name}</span>
                      {cnt > 0 && (
                        <span className={`text-[10px] px-1.5 rounded-full shrink-0 ml-1.5 ${isSel ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold'}`}>
                          {cnt}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* City Selector */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block truncate">{t.filterCitiesTitle}</label>
              <select
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                className="w-full text-xs px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-[#4352E8] cursor-pointer"
              >
                <option value="ALL">
                  {t.allCities} ({orders.length})
                </option>
                {Object.entries(cityCounts)
                  .sort((a, b) => {
                    // Cities with active orders first, sorted by count descending
                    if (b[1] !== a[1]) return b[1] - a[1]
                    // Alphabetical in Hebrew
                    return a[0].localeCompare(b[0], 'he')
                  })
                  .map(([cityName, count]) => (
                    <option key={cityName} value={cityName}>
                      {cityName} {count > 0 ? `(${count})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Link to Courier Service & Masked Calling Admin */}
        <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-800 min-w-0">
          <Link
            href="/admin"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold text-xs bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition border border-slate-200/80 dark:border-slate-800 shadow-xs group cursor-pointer min-w-0"
            title="Manage Couriers, Masked Calling, Twilio & Call Logs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <PhoneIcon className="w-3.5 h-3.5 text-[#4352E8] group-hover:scale-110 transition shrink-0" />
              <span className="truncate">Courier Masking Admin</span>
            </div>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#4352E8] text-white shrink-0 ml-1.5">/admin</span>
          </Link>
        </div>

        {/* Theme Preference Quick Switcher in Sidebar */}
        <div className="py-2.5 px-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between min-w-0">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
            {lang === 'he' ? 'ערכת נושא' : 'Theme Mode'}
          </span>
          <ThemeToggle lang={lang} showLabel={false} align="end" direction="up" />
        </div>

        {/* Authenticated User Profile Card with Hover/Click Dropdown Reveal */}
        <div className="relative pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 min-w-0">
          {/* Dropdown Container */}
          <div
            className="relative min-w-0"
            onMouseEnter={() => setShowProfileDropdown(true)}
            onMouseLeave={() => setShowProfileDropdown(false)}
          >
            {/* The Trigger Profile Card */}
            <div
              onClick={() => setShowProfileDropdown(prev => !prev)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition cursor-pointer group min-w-0"
              title="Click or hover to reveal Profile & Settings options"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-[#1E2235] text-white flex items-center justify-center font-bold text-xs shadow-xs group-hover:ring-2 group-hover:ring-[#4352E8]/40 transition shrink-0">
                  {userProfile?.name?.slice(0, 2).toUpperCase() || 'GA'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {userProfile?.name || 'Persian Team Manager'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                      {userProfile?.role || 'CRM Manager'}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
            </div>

            {/* Elevated Dropdown Menu Revealed on Hover/Click */}
            {showProfileDropdown && (
              <div className="absolute bottom-full start-0 mb-2 w-full max-w-[260px] bg-white dark:bg-[#0B0F17] rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 py-2.5 z-50 animate-fadeIn space-y-1">
                {/* Header in Dropdown */}
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userProfile?.name || 'Admin'}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{userProfile?.email || 'admin@persiancrm.internal'}</p>
                  <span className="mt-1 inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {userProfile?.role || 'System Admin'}
                  </span>
                </div>

                <div className="px-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      setActiveNav('settings')
                      setSettingsTab('profile')
                      setShowProfileDropdown(false)
                      setIsMobileSidebarOpen(false)
                    }}
                    className="w-full text-start flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-[#4352E8]" />
                    <span>{lang === 'he' ? 'פרופיל אישי' : 'Personal Profile'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveNav('settings')
                      setSettingsTab('brands')
                      setShowProfileDropdown(false)
                      setIsMobileSidebarOpen(false)
                    }}
                    className="w-full text-start flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                  >
                    <TagIcon className="w-4 h-4 text-emerald-600" />
                    <span>{lang === 'he' ? 'ניהול מותגים (37+)' : 'Brand Management'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveNav('settings')
                      setSettingsTab('bot')
                      setShowProfileDropdown(false)
                      setIsMobileSidebarOpen(false)
                    }}
                    className="w-full text-start flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                  >
                    <TelegramIcon className="w-4 h-4 text-[#0088cc]" />
                    <span>{lang === 'he' ? 'הגדרות בוט ומערכת' : 'Bot & System Config'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveNav('settings')
                      setSettingsTab('team')
                      setShowProfileDropdown(false)
                      setIsMobileSidebarOpen(false)
                    }}
                    className="w-full text-start flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                  >
                    <UsersIcon className="w-4 h-4 text-indigo-600" />
                    <span>{lang === 'he' ? 'ניהול צוות והרשאות' : 'Team Access'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveNav('settings')
                      setSettingsTab('data')
                      setShowProfileDropdown(false)
                      setIsMobileSidebarOpen(false)
                    }}
                    className="w-full text-start flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                  >
                    <DatabaseIcon className="w-4 h-4 text-amber-600" />
                    <span>{lang === 'he' ? 'ניהול נתונים וגיבויים' : 'Data & Backups'}</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800 px-1.5 space-y-0.5">
                  <Link
                    href="/admin"
                    onClick={() => setShowProfileDropdown(false)}
                    className="w-full text-start flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>{lang === 'he' ? 'ניהול שליחים ומיסוך' : 'Courier Masking Admin'}</span>
                    </div>
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-1.5 py-0.5 rounded">/admin</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full text-start flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <LogoutIcon className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                    <span>{t.logout}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Purge Demo Data Option when Live Transition Occurs */}
          <button
            type="button"
            onClick={() => setShowPurgeModal(true)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-rose-200/60 dark:border-rose-900/40 transition cursor-pointer"
            title="Wipe demo orders and start clean with real Telegram-forwarded orders"
          >
            <span>Purge Demo Orders</span>
            <span className="text-[9px] bg-rose-200/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">Live Clean</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer pt-1"
          >
            <LogoutIcon className="w-4 h-4 text-slate-400" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MAIN VIEWING CANVAS (CLEAN, UNCLUTTERED, STANDARD CRM) */}
      {/* ======================================================== */}
      <main
        data-scrollbar="hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className="flex-1 h-full min-w-0 max-w-full p-4 sm:p-8 space-y-6 overflow-y-auto overflow-x-hidden no-scrollbar"
      >
        {/* Top Header & Dynamic Navigation Title */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Button for Mobile View */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer flex items-center justify-center shrink-0"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <MenuIcon className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            </button>

            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white transition-colors truncate">
                {activeNav === 'dashboard'
                  ? 'Persian Team Management • Executive Dashboard'
                  : activeNav === 'orders'
                  ? `${t.navDispatches} & Delivery Orders`
                  : activeNav === 'inventory'
                  ? `${t.navInventory} • 29/9 Live Warehouse Catalog`
                  : activeNav === 'settlements'
                  ? `${t.navSettlements} • Daily Courier Cash Reconciliation`
                  : activeNav === 'customers'
                  ? `${t.navCustomers} • Deduplicated Client Registry`
                  : activeNav === 'settings'
                  ? (lang === 'he' ? 'הגדרות מערכת ופרופיל אישי' : 'Settings & Profile Management')
                  : `${t.navTelegramBot} • Live Ingestion Webhook Engine`}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">
                {activeNav === 'dashboard'
                  ? 'Executive overview, daily courier cash metrics, business growth and quick operations.'
                  : activeNav === 'orders'
                  ? 'Track live orders, slash deductions, addresses, phone contacts, and delivery fulfillment.'
                  : activeNav === 'inventory'
                  ? '29/9 warehouse stock on hand, grams & unit deductions, and low stock thresholds.'
                  : activeNav === 'settlements'
                  ? 'Reconcile collected cash from deliveries at the end of every courier shift with audit logs.'
                  : activeNav === 'customers'
                  ? 'Clients uniquely deduplicated by Israeli phone number (05X-XXXXXXX) with delivery address aliases.'
                  : activeNav === 'settings'
                  ? (lang === 'he' ? 'ניהול פרופיל מנהל, שיוך מזהה טלגרם, ספקי מותגים, קונפיגורציית בוט והרשאות צוות.' : 'Manage dispatcher profile, Telegram whitelist binding, 37+ brand personas, and bot configuration.')
                  : 'Multi-brand forward ingestion webhook status, admin whitelist verification, and live order parsing engine.'}
              </p>
            </div>
          </div>

          {/* Quick Actions Strip */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Dark / Light / System Theme Toggler */}
            <ThemeToggle lang={lang} align="end" className="!h-9 flex items-center" />

            {/* Refresh Data Button */}
            <button
              type="button"
              onClick={fetchData}
              disabled={refreshing}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer shrink-0"
              title={t.refreshData}
            >
              <RefreshIcon className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#4352E8]' : ''}`} />
            </button>

            {/* One-Tap Bilingual Toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              title={lang === 'en' ? 'החלף לעברית (RTL)' : 'Switch to English (LTR)'}
            >
              <GlobeIcon className="w-3.5 h-3.5 text-[#4352E8] dark:text-indigo-400 shrink-0" />
              <span className="whitespace-nowrap">{lang === 'en' ? 'עברית (RTL)' : 'English (LTR)'}</span>
            </button>

            {/* End-of-Day Shift Closeout (Z-Report) Action Button */}
            <button
              type="button"
              onClick={() => setShowDayCloseoutModal(true)}
              className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-black transition shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              title="סגירת יום עבודה (דוח Z) ואיפוס הקופה למחר"
            >
              <span className="text-sm shrink-0">🌙</span>
              <span className="whitespace-nowrap">{t.closeDayBtn || 'Close Day (Z-Report)'}</span>
            </button>

            {/* Quick Switch to /admin Courier Service & Masked Calling */}
            <Link
              href="/admin"
              className="hidden xl:flex h-9 items-center gap-1.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer group shrink-0 whitespace-nowrap"
              title="Open Courier Masking & Service Admin (/admin)"
            >
              <PhoneIcon className="w-3.5 h-3.5 text-[#4352E8] group-hover:scale-110 transition shrink-0" />
              <span className="whitespace-nowrap">Courier Admin</span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold">/admin</span>
            </Link>

            {activeNav === 'orders' && (
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredOrders.length === 0}
                className="h-9 px-3.5 rounded-xl bg-[#1E2235] hover:bg-[#151928] text-white text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-40 shrink-0 whitespace-nowrap"
              >
                <DownloadIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{t.exportToExcel}</span>
              </button>
            )}
          </div>
        </header>

        {/* WAREHOUSE WORKER CASH COLLECTION NOTIFICATION BANNER */}
        {latestWarehouseSettlement && (
          <div
            className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/15 border-2 border-emerald-500/40 dark:border-emerald-500/50 shadow-lg shadow-emerald-500/5 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all animate-in fade-in slide-in-from-top-2 duration-300"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30 shrink-0">
                <WalletIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-300 dark:border-emerald-700">
                    {isRtl ? '🔔 התראה למחסנאי — דרישת גביית מזומן!' : '🔔 Storekeeper Cash Handover Alert'}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    {new Date(latestWarehouseSettlement.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {isRtl ? (
                    <>
                      עליך לגבות כעת מהשליח{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-black underline decoration-emerald-500/50 underline-offset-4">
                        {latestWarehouseSettlement.crm_couriers?.name || 'שליח'}
                      </span>{' '}
                      סך של{' '}
                      <span className="font-mono text-xl text-emerald-600 dark:text-emerald-400 font-black">
                        ₪{Number(latestWarehouseSettlement.net_expected || latestWarehouseSettlement.amount_received || 0).toLocaleString()}
                      </span>{' '}
                      במזומן!
                    </>
                  ) : (
                    <>
                      Collect{' '}
                      <span className="font-mono text-xl text-emerald-600 dark:text-emerald-400 font-black">
                        ₪{Number(latestWarehouseSettlement.net_expected || latestWarehouseSettlement.amount_received || 0).toLocaleString()}
                      </span>{' '}
                      in physical cash from courier{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-black underline decoration-emerald-500/50 underline-offset-4">
                        {latestWarehouseSettlement.crm_couriers?.name || 'Courier'}
                      </span>{' '}
                      now!
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {latestWarehouseSettlement.notes || (isRtl ? 'סגירת סבב הושלמה במערכת. יש לקבל את מעטפת המזומן מהשליח ולהפקידה בכספת.' : 'Shift closeout completed. Collect envelope and deposit in vault.')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch md:self-auto justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveNav('settlements')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <WalletIcon className="w-3.5 h-3.5" />
                <span>{isRtl ? 'צפה ביומן קופת שליחים' : 'View Settlements'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissedSettlementIds(prev => [...prev, latestWarehouseSettlement.id])}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition cursor-pointer"
                title={isRtl ? 'הסתר התראה' : 'Dismiss Alert'}
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* DEDICATED ROUTE VIEWS - EXPLICIT CONTENT PER NAVIGATION ROUTE */}
        {activeNav === 'dashboard' && (
          <DashboardRouteView
            orders={orders}
            activeShiftOrders={activeShiftOrders}
            shiftStartTime={shiftStartTime}
            couriers={couriers}
            products={products}
            metrics={metrics}
            t={t}
            isRtl={isRtl}
            todayOnly={todayOnly}
            currentSlide={currentSlide}
            setCurrentSlide={setCurrentSlide}
            setIsCarouselHovered={setIsCarouselHovered}
            chartTimeframe={chartTimeframe}
            setChartTimeframe={setChartTimeframe}
            setActiveNav={setActiveNav}
            setSelectedOrderForDrawer={setSelectedOrderForDrawer}
          />
        )}

        {activeNav === 'orders' && (
          <OrdersRouteView
            orders={orders}
            filteredOrders={filteredOrders}
            metrics={metrics}
            t={t}
            isRtl={isRtl}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            todayOnly={todayOnly}
            setTodayOnly={setTodayOnly}
            unmaskedPhones={unmaskedPhones}
            setUnmaskedPhones={setUnmaskedPhones}
            copiedId={copiedId}
            setCopiedId={setCopiedId}
            setSelectedOrderForDrawer={setSelectedOrderForDrawer}
            couriers={couriers}
            onAssignCourier={handleAssignCourier}
            shiftStartTime={shiftStartTime}
            onEditOrder={(order) => setEditingOrder(order)}
            onDeleteOrder={(order) => setDeletingOrder(order)}
          />
        )}

        {activeNav === 'inventory' && (
          <InventoryRouteView
            products={products}
            filteredProducts={filteredProducts}
            metrics={metrics}
            t={t}
            isRtl={isRtl}
            inventorySearch={inventorySearch}
            setInventorySearch={setInventorySearch}
            inventoryStatusFilter={inventoryStatusFilter}
            setInventoryStatusFilter={setInventoryStatusFilter}
            setAdjustingProduct={setAdjustingProduct}
            setAdjustType={setAdjustType}
            setAdjustQty={setAdjustQty}
            onOpenAddProduct={() => {
              setEditingProduct(null)
              setShowProductModal(true)
            }}
            onOpenEditProduct={(p) => {
              setEditingProduct(p)
              setShowProductModal(true)
            }}
            onOpenDeleteProduct={(p) => setDeletingProduct(p)}
          />
        )}

        {activeNav === 'settlements' && (
          <SettlementsRouteView
            couriers={couriers}
            metrics={metrics}
            t={t}
            isRtl={isRtl}
            setSettlingCourier={setSettlingCourier}
            setGrossInput={setGrossInput}
            setBonusInput={setBonusInput}
            onOpenAddCourier={() => {
              setEditingCourier(null)
              setShowCourierModal(true)
            }}
            onOpenEditCourier={(c) => {
              setEditingCourier(c)
              setShowCourierModal(true)
            }}
            onOpenDeleteCourier={(c) => setDeletingCourier(c)}
            recentSettlements={recentSettlements}
            onOpenDayCloseout={() => setShowDayCloseoutModal(true)}
            recentDayCloseouts={recentDayCloseouts}
            latestDayCloseout={latestDayCloseout}
            onViewDayCloseoutDetail={(co) => setSelectedCloseoutDetail(co)}
          />
        )}

        {activeNav === 'customers' && (
          <CustomersRouteView
            customerList={customerList}
            filteredCustomers={filteredCustomers}
            orders={orders}
            cityCounts={cityCounts}
            t={t}
            isRtl={isRtl}
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            unmaskedPhones={unmaskedPhones}
            setUnmaskedPhones={setUnmaskedPhones}
            copiedId={copiedId}
            setCopiedId={setCopiedId}
          />
        )}

        {activeNav === 'telegram' && (
          <TelegramRouteView
            ordersCount={orders.length}
            isRtl={isRtl}
            testTelegramText={testTelegramText}
            setTestTelegramText={setTestTelegramText}
            parsedTestResult={parsedTestResult}
            handleTestParse={handleTestParse}
          />
        )}

        {activeNav === 'settings' && (
          <CrmSettingsView
            userProfile={userProfile}
            orders={orders}
            brands={brands}
            products={products}
            couriers={couriers}
            lang={lang}
            isRtl={isRtl}
            activeTab={settingsTab}
            onTabChange={setSettingsTab}
            onOpenAddBrand={() => setShowBrandManagerModal(true)}
            onOpenEditBrand={() => setShowBrandManagerModal(true)}
            onOpenDeleteBrand={() => setShowBrandManagerModal(true)}
            onExportCSV={handleExportCSV}
            onPurgeDemo={() => setShowPurgeModal(true)}
            onUpdateProfile={async (updated) => {
              // 1. Send profile updates to backend API for database persistence
              const res = await fetch('/api/auth/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: updated.name,
                  phone_number: updated.phone_number,
                  telegram_id: updated.telegram_id,
                  userId: userProfile?.id
                })
              })

              const data = await res.json()

              if (!res.ok) {
                // Client-side fallback to ensure data is never lost
                const { error: clientErr } = await supabase.auth.updateUser({
                  data: {
                    name: updated.name,
                    full_name: updated.name,
                    phone_number: updated.phone_number,
                    telegram_id: updated.telegram_id
                  }
                })
                if (clientErr) {
                  throw new Error(data.error || clientErr.message || 'Failed to save profile.')
                }
                if (userProfile?.id && updated.phone_number !== undefined) {
                  await supabase
                    .from('profiles')
                    .update({ phone_number: updated.phone_number || null })
                    .eq('id', userProfile.id)
                }
              }

              // 2. Synchronize local React state with saved data
              setUserProfile(prev => prev ? {
                ...prev,
                name: updated.name,
                phone_number: updated.phone_number,
                telegram_id: updated.telegram_id
              } : null)
            }}
          />
        )}
      </main>
    </div>
  )
}
