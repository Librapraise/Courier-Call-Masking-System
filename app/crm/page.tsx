'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { TRANSLATIONS, Language } from '@/lib/crm/translations'
import { parseSingleOrderMessage, ParsedDeliveryOrder } from '@/lib/crm/parser'
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
  TelegramRouteView
} from '@/components/crm/CrmRouteViews'
import { CrmSettingsView } from '@/components/crm/CrmSettingsView'
import ThemeToggle from '@/components/ThemeToggle'
import {
  ProductModal,
  ProductDeleteModal,
  BrandManagerModal,
  CourierModal,
  CourierDeleteModal
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
  todayOrders?: number
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
  raw_message?: string
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
  const [todayOnly, setTodayOnly] = useState(false)
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

        const isSuper = activeUser.email === 'feelgee8@gmail.com' || activeUser.user_metadata?.role === 'super_admin' || activeUser.user_metadata?.is_super_admin === true
        const allowedRoles = ['admin', 'super_admin']

        if (!isSuper && (profileError || !profile?.role || !allowedRoles.includes(profile.role))) {
          console.warn('[GhostCRM Auth Guard] Unauthorized user attempted to access /crm. Redirecting to courier portal.')
          window.location.href = '/courier'
          return
        }

        const roleName = isSuper || profile?.role === 'super_admin' ? 'Super Admin' : 'System Admin'
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

  // Filtered Orders Calculation
  const filteredOrders = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const todayStr = new Date().toISOString().split('T')[0]

    return orders.filter(order => {
      // Shift filter
      if (todayOnly && !order.order_date?.startsWith(todayStr)) return false

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
    if (todayOnly) count++
    if (settlementFilter !== 'ALL') count++
    if (searchQuery) count++
    return count
  }, [selectedBrand, selectedCity, todayOnly, settlementFilter, searchQuery])

  const resetAllFilters = () => {
    setSelectedBrand('ALL')
    setSelectedCity('ALL')
    setTodayOnly(false)
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

  // Computed settlement values (frontend preview using 100 NIS standard rate)
  const settleOrderCount  = settlingCourier?.todayOrders || 0
  const parsedGross       = parseFloat(grossInput) || 0
  const parsedBonus       = Math.max(0, parseFloat(bonusInput) || 0)
  // Preview: assume all are standard (backend will do exact Bat Yam split)
  const previewDeliveryFees = settleOrderCount * 100
  const previewCourierPay   = previewDeliveryFees + parsedBonus
  const previewNet          = Math.max(0, parsedGross - previewCourierPay)

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#F8FAFC] dark:bg-[#070A11] text-slate-900 dark:text-slate-100 font-sans flex antialiased transition-colors duration-200"
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

      {/* ======================================================== */}
      {/* MODAL 1: STOCK ADJUSTMENT                                 */}
      {/* ======================================================== */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BoxIcon className="w-5 h-5 text-[#4352E8] dark:text-indigo-400" />
                <span>{t.adjustStockModalTitle}</span>
              </h3>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

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

            <form onSubmit={handleStockAdjustmentSubmit} className="space-y-4">
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

              <div className="flex items-center justify-end gap-2 pt-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-emerald-600 dark:bg-emerald-700 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <WalletIcon className="w-5 h-5 text-white" />
                <div>
                  <h3 className="text-sm font-bold text-white">{t.settleModalTitle}</h3>
                  <p className="text-[11px] text-emerald-100 font-medium">{settlingCourier.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSettlingCourier(null)}
                className="text-white/80 hover:text-white text-base cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSettlementSubmit} className="p-5 space-y-4">
              {/* Row 1 — Orders today */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{t.ordersCount}</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{settleOrderCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{t.deliveryFeesBreakdown}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold">
                    {settleOrderCount} × ₪100 = <span className="text-emerald-600 dark:text-emerald-400 font-black">₪{previewDeliveryFees.toLocaleString()}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">(Bat Yam adjusted on confirm)</p>
                </div>
              </div>

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
                <span className="text-base leading-none mt-0.5">📲</span>
                <span>Telegram receipts will be sent to the courier and the admin group automatically.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
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
        className={`w-72 bg-white dark:bg-[#0B0F17] p-5 flex flex-col justify-between shrink-0 select-none overflow-y-auto no-scrollbar transition-all duration-300 ${
          isMobileSidebarOpen
            ? `fixed inset-y-0 z-50 shadow-2xl h-screen ${
                isRtl ? 'right-0 border-l border-slate-200/80 dark:border-slate-800/80' : 'left-0 border-r border-slate-200/80 dark:border-slate-800/80'
              }`
            : 'hidden lg:flex sticky top-0 h-screen border-r border-slate-200/80 dark:border-slate-800/80'
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
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <FilterIcon className="w-3.5 h-3.5" />
                <span>{t.filtersHeader}</span>
              </span>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="text-[10px] text-[#4352E8] dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                >
                  {t.clearAllFilters} ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Shift Filter: Today's Shift vs All Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t.filterShiftTitle}</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-transparent dark:border-slate-800">
                <button
                  onClick={() => setTodayOnly(true)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    todayOnly
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.todayShift}
                </button>
                <button
                  onClick={() => setTodayOnly(false)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
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
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Settlement</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-[10px] font-bold text-center border border-transparent dark:border-slate-800">
                <button
                  onClick={() => setSettlementFilter('ALL')}
                  className={`py-1 rounded-lg transition cursor-pointer ${
                    settlementFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSettlementFilter('OPEN')}
                  className={`py-1 rounded-lg transition cursor-pointer ${
                    settlementFilter === 'OPEN'
                      ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Open
                </button>
                <button
                  onClick={() => setSettlementFilter('SETTLED')}
                  className={`py-1 rounded-lg transition cursor-pointer ${
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t.filterBrandsTitle}</label>
                  <button
                    type="button"
                    onClick={() => setShowBrandManagerModal(true)}
                    className="p-1 rounded-md text-slate-400 hover:text-[#4352E8] dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition cursor-pointer"
                    title="Manage Brand Personas (Add, Edit, Delete)"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                {selectedBrand !== 'ALL' && (
                  <button
                    onClick={() => setSelectedBrand('ALL')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Brand Search Input */}
              <div className="relative">
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
                className="max-h-36 overflow-y-auto space-y-0.5 pr-1 no-scrollbar"
              >
                <button
                  onClick={() => setSelectedBrand('ALL')}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium flex items-center justify-between cursor-pointer ${
                    selectedBrand === 'ALL'
                      ? 'bg-slate-900 dark:bg-slate-800 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{t.allBrands}</span>
                  <span className="text-[10px]">{orders.length}</span>
                </button>
                {filteredBrandsList.map(b => {
                  const cnt = brandOrderCounts[b.name] || 0
                  const isSel = selectedBrand === b.name
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBrand(b.name)}
                      className={`w-full text-left px-2 py-1 rounded-md text-xs transition flex items-center justify-between cursor-pointer ${
                        isSel
                          ? 'bg-[#4352E8] text-white font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {cnt > 0 && (
                        <span className={`text-[10px] px-1.5 rounded-full ${isSel ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold'}`}>
                          {cnt}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* City Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t.filterCitiesTitle}</label>
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
        <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-800">
          <Link
            href="/admin"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold text-xs bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition border border-slate-200/80 dark:border-slate-800 shadow-xs group cursor-pointer"
            title="Manage Couriers, Masked Calling, Twilio & Call Logs"
          >
            <div className="flex items-center gap-2">
              <PhoneIcon className="w-3.5 h-3.5 text-[#4352E8] group-hover:scale-110 transition" />
              <span>Courier Masking Admin</span>
            </div>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#4352E8] text-white">/admin</span>
          </Link>
        </div>

        {/* Theme Preference Quick Switcher in Sidebar */}
        <div className="py-2.5 px-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'he' ? 'ערכת נושא' : 'Theme Mode'}
          </span>
          <ThemeToggle lang={lang} showLabel={false} align="end" direction="up" />
        </div>

        {/* Authenticated User Profile Card with Hover/Click Dropdown Reveal */}
        <div className="relative pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {/* Dropdown Container */}
          <div
            className="relative"
            onMouseEnter={() => setShowProfileDropdown(true)}
            onMouseLeave={() => setShowProfileDropdown(false)}
          >
            {/* The Trigger Profile Card */}
            <div
              onClick={() => setShowProfileDropdown(prev => !prev)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition cursor-pointer group"
              title="Click or hover to reveal Profile & Settings options"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-[#1E2235] text-white flex items-center justify-center font-bold text-xs shadow-xs group-hover:ring-2 group-hover:ring-[#4352E8]/40 transition">
                  {userProfile?.name?.slice(0, 2).toUpperCase() || 'GA'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {userProfile?.name || 'Persian Team Manager'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {userProfile?.role || 'CRM Manager'}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition ${isRtl ? 'rotate-180' : ''}`} />
            </div>

            {/* Elevated Dropdown Menu Revealed on Hover/Click */}
            {showProfileDropdown && (
              <div className="absolute bottom-full start-0 mb-2 w-64 bg-white dark:bg-[#0B0F17] rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 py-2.5 z-50 animate-fadeIn space-y-1">
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
        className="flex-1 min-w-0 p-4 sm:p-8 space-y-6 overflow-y-auto no-scrollbar"
      >
        {/* Top Header & Dynamic Navigation Title */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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

            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white transition-colors">
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
          <div className="flex items-center gap-2.5">
            {/* Dark / Light / System Theme Toggler */}
            <ThemeToggle lang={lang} align="end" />

            <button
              onClick={fetchData}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
              title={t.refreshData}
            >
              <RefreshIcon className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#4352E8]' : ''}`} />
            </button>

            {/* One-Tap Bilingual Toggle */}
            <button
              onClick={toggleLanguage}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <GlobeIcon className="w-4 h-4 text-[#4352E8]" />
              <span>{lang === 'en' ? '🌐 עברית (RTL)' : '🌐 English (LTR)'}</span>
            </button>

            {/* Quick Switch to /admin Courier Service & Masked Calling */}
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer group"
              title="Open Courier Masking & Service Admin (/admin)"
            >
              <PhoneIcon className="w-3.5 h-3.5 text-[#4352E8] group-hover:scale-110 transition" />
              <span>Courier Admin</span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold">/admin</span>
            </Link>

            {activeNav === 'orders' && (
              <button
                onClick={handleExportCSV}
                disabled={filteredOrders.length === 0}
                className="px-4 py-2 rounded-xl bg-[#1E2235] hover:bg-[#151928] text-white text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <DownloadIcon className="w-4 h-4" />
                <span>{t.exportToExcel}</span>
              </button>
            )}
          </div>
        </header>

        {/* DEDICATED ROUTE VIEWS - EXPLICIT CONTENT PER NAVIGATION ROUTE */}
        {activeNav === 'dashboard' && (
          <DashboardRouteView
            orders={orders}
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
