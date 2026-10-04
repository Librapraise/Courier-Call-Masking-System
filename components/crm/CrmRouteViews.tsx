'use client'

import React from 'react'
import Image from 'next/image'
import {
  TruckIcon,
  BoxIcon,
  WalletIcon,
  UsersIcon,
  TelegramIcon,
  SearchIcon,
  MapPinIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  PhoneIcon,
  WhatsAppIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  TagIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  SettingsIcon
} from '@/components/crm/CrmIcons'
import { ParsedDeliveryOrder } from '@/lib/crm/parser'

export interface Customer {
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

export interface Brand {
  id: string
  name: string
}

export interface Courier {
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

export interface Order {
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

export interface Product {
  id: string
  name: string
  category: string
  stock_on_hand: number
  unit: string
  min_stock_alert: number
  aliases?: string[]
}

export interface DashboardMetrics {
  courierCashToday: number
  totalDeliveriesToday: number
  activeCustomers: number
  lowStockAlerts: number
}

/* ======================================================== */
/* 1. ROUTE: DASHBOARD VIEW (EXECUTIVE OPS OVERVIEW)        */
/* ======================================================== */
export function DashboardRouteView({
  orders,
  couriers,
  products,
  metrics,
  t,
  isRtl,
  todayOnly,
  currentSlide,
  setCurrentSlide,
  setIsCarouselHovered,
  chartTimeframe,
  setChartTimeframe,
  setActiveNav,
  setSelectedOrderForDrawer
}: {
  orders: Order[]
  couriers: Courier[]
  products: Product[]
  metrics: DashboardMetrics
  t: any
  isRtl: boolean
  todayOnly: boolean
  currentSlide: number
  setCurrentSlide: (s: number) => void
  setIsCarouselHovered: (h: boolean) => void
  chartTimeframe: 'year' | 'month' | 'week'
  setChartTimeframe: (t: 'year' | 'month' | 'week') => void
  setActiveNav: (nav: any) => void
  setSelectedOrderForDrawer: (o: Order) => void
}) {
  return (
    <div className="space-y-6">
      {/* Hero Announcement Carousel */}
      <div
        className="relative group"
        onMouseEnter={() => setIsCarouselHovered(true)}
        onMouseLeave={() => setIsCarouselHovered(false)}
      >
        <div className="bg-[#131B2E] text-white rounded-2xl px-6 sm:px-8 py-6 relative overflow-hidden flex flex-col md:flex-row items-center justify-between shadow-xs min-h-[160px] gap-6 transition-all duration-500">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#4352E8]/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          {/* Slide 0: Business Needs */}
          {currentSlide === 0 && (
            <>
              <div className="space-y-2 z-10 max-w-xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 text-[11px] font-semibold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Ops Center • 37 Brands Active</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase leading-snug">
                  KEEP UP WITH YOUR BUSINESS NEEDS
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                  Control real-time dispatching across Tel Aviv, Petah Tikva and Jerusalem with instant Telegram ingestion and zero customer identity leaks.
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => setActiveNav('orders')}
                    className="text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Explore Dispatches & Orders</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
              <div className="hidden md:flex items-center justify-center shrink-0 z-10">
                <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 relative bg-slate-800/60">
                  <Image
                    src="/delivery_globe_boxes.jpg"
                    alt="Global Logistics Network"
                    fill
                    className="object-cover"
                    unoptimized
                    priority
                  />
                </div>
              </div>
            </>
          )}

          {/* Slide 1: Slash Inventory Depletion Rule */}
          {currentSlide === 1 && (
            <>
              <div className="space-y-2 z-10 max-w-xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>The Slash Rule • חוק הסלאש</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase leading-snug">
                  SLASH INVENTORY DEPLETION
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                  In <code className="bg-white/15 px-1.5 py-0.5 rounded text-amber-300 text-xs">Menu Name / Warehouse Stock</code>, what follows the slash is automatically deducted in grams & units in live warehouse stock.
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => setActiveNav('inventory')}
                    className="text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Inspect Live Warehouse (29/9)</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
              <div className="hidden md:flex items-center justify-center shrink-0 z-10">
                <div className="w-40 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span>AUTO DEDUCTION</span>
                    <span className="text-emerald-400 font-mono font-bold">-10g</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] truncate">
                    רפואי גלקסי
                  </div>
                  <p className="text-[10px] text-slate-400">Stock updated in live DB</p>
                </div>
              </div>
            </>
          )}

          {/* Slide 2: Daily Courier Cash Reconciliation */}
          {currentSlide === 2 && (
            <>
              <div className="space-y-2 z-10 max-w-xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Courier Settlements • סגירת קופה</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase leading-snug">
                  DAILY COURIER CASH RECONCILIATION
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                  Reconcile collected cash from deliveries at the end of every courier shift with zero financial discrepancy and full audit logs.
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => setActiveNav('settlements')}
                    className="text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Review Courier Shifts</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
              <div className="hidden md:flex items-center justify-center shrink-0 z-10">
                <div className="w-44 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="font-bold text-white flex items-center gap-1">
                      <WalletIcon className="w-3.5 h-3.5 text-emerald-400" />
                      Shift Closeout
                    </span>
                    <span className="text-emerald-400 font-bold">Today</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between text-slate-300 font-mono">
                      <span>יצחק הגנן הסדרן</span>
                      <span className="text-emerald-400 font-bold">₪4,750</span>
                    </div>
                    <div className="flex justify-between text-slate-300 font-mono">
                      <span>Zig zag מנהל</span>
                      <span className="text-emerald-400 font-bold">₪2,900</span>
                    </div>
                    <div className="flex justify-between text-slate-300 font-mono">
                      <span>דני שליחויות</span>
                      <span className="text-emerald-400 font-bold">₪2,650</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Carousel Pagination Dots */}
        <div className="flex items-center justify-center gap-2 pt-2.5">
          {[0, 1, 2].map(idx => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentSlide === idx ? 'w-6 bg-slate-900' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Top 4 Executive Metric Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Overview</h3>
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-xs">
            {todayOnly ? "Today's Shift" : 'All Time'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Cash with Couriers */}
          <div className="bg-[#4352E8] text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between min-h-[150px]">
            <div className="space-y-1">
              <span className="text-xs font-medium text-indigo-100">{t.courierCashToday}</span>
              <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                ₪{metrics.courierCashToday.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <button
              onClick={() => setActiveNav('settlements')}
              className="mt-3 bg-white dark:bg-[#1E2235] text-[#4352E8] dark:text-indigo-400 font-bold text-xs px-4 py-2 rounded-xl shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition w-fit cursor-pointer border border-transparent dark:border-slate-700"
            >
              Close Shift / סגירת קופה
            </button>
          </div>

          {/* Card 2: Deliveries Today */}
          <div
            onClick={() => setActiveNav('orders')}
            className="bg-white dark:bg-[#0B0F17] border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between min-h-[150px] cursor-pointer hover:border-[#4352E8]/40 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 transition">
                <TruckIcon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.totalDeliveriesToday}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {metrics.totalDeliveriesToday || orders.length}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                <TrendingUpIcon className="w-3.5 h-3.5" />
                <span>20%</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium group-hover:text-[#4352E8] dark:group-hover:text-indigo-400 transition">Click to view dispatches →</p>
          </div>

          {/* Card 3: Total Customers */}
          <div
            onClick={() => setActiveNav('customers')}
            className="bg-white dark:bg-[#0B0F17] border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between min-h-[150px] cursor-pointer hover:border-[#4352E8]/40 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition">
                <UsersIcon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.activeCustomers}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {metrics.activeCustomers || orders.length}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                <TrendingUpIcon className="w-3.5 h-3.5" />
                <span>15%</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium group-hover:text-[#4352E8] dark:group-hover:text-indigo-400 transition">Deduplicated by phone →</p>
          </div>

          {/* Card 4: Low Stock Alerts */}
          <div
            onClick={() => setActiveNav('inventory')}
            className="bg-white dark:bg-[#0B0F17] border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between min-h-[150px] cursor-pointer hover:border-[#4352E8]/40 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40 transition">
                <BoxIcon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.lowStockAlerts}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {metrics.lowStockAlerts || 0}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                <TrendingDownIcon className="w-3.5 h-3.5" />
                <span>5%</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium group-hover:text-[#4352E8] dark:group-hover:text-indigo-400 transition">Threshold: ≤10g / pcs →</p>
          </div>
        </div>
      </section>

      {/* Recent Shipment Graph */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent shipment</h3>
          <button
            onClick={() => setActiveNav('orders')}
            className="text-xs font-bold text-[#4352E8] dark:text-indigo-400 hover:underline cursor-pointer"
          >
            See All Dispatches →
          </button>
        </div>

        <div className="bg-white dark:bg-[#0B0F17] border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6 transition-colors">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Company Growth</h4>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
              <button
                onClick={() => setChartTimeframe('year')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  chartTimeframe === 'year' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Year
              </button>
              <button
                onClick={() => setChartTimeframe('month')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  chartTimeframe === 'month' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setChartTimeframe('week')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  chartTimeframe === 'week' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Week
              </button>
            </div>
          </div>

          <div className="w-full h-52 relative select-none">
            <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono pointer-events-none">
              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-1 flex justify-between"><span>1,000</span></div>
              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-1 flex justify-between"><span>800</span></div>
              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-1 flex justify-between"><span>600</span></div>
              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-1 flex justify-between"><span>400</span></div>
              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-1 flex justify-between"><span>200</span></div>
              <div className="border-b border-slate-100 dark:border-slate-800/80 pb-1 flex justify-between"><span>0</span></div>
            </div>

            <svg className="w-full h-full absolute inset-0 overflow-visible" viewBox="0 0 1000 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4352E8" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#4352E8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 50,150 C 200,140 250,135 350,135 C 450,135 500,155 600,155 C 700,155 750,120 850,120 C 900,120 930,170 960,80 L 960,200 L 50,200 Z"
                fill="url(#curveGradient)"
              />
              <path
                d="M 50,150 C 200,140 250,135 350,135 C 450,135 500,155 600,155 C 700,155 750,120 850,120 C 900,120 930,170 960,80"
                fill="none"
                stroke="#4352E8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute -bottom-6 inset-x-0 flex justify-between text-[11px] text-slate-400 font-medium px-4">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
              <span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Executive 2-Column Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Left Column: Recent Dispatches Preview */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TruckIcon className="w-4 h-4 text-[#4352E8] dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Dispatches Stream</h3>
            </div>
            <button
              onClick={() => setActiveNav('orders')}
              className="text-xs font-bold text-[#4352E8] dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>View All Dispatches ({orders.length})</span>
              <span>→</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" dir={isRtl ? 'rtl' : 'ltr'}>
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 text-[11px] uppercase border-b border-slate-100 dark:border-slate-800 pb-2">
                  <th className="py-2 font-bold">Address / Customer</th>
                  <th className="py-2 font-bold">City</th>
                  <th className="py-2 font-bold">Brand</th>
                  <th className="py-2 font-bold">Amount</th>
                  <th className="py-2 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {orders.slice(0, 5).map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOrderForDrawer(o)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200 max-w-[180px] truncate">
                      {o.crm_customers?.address_name || o.address}
                    </td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400 font-medium">{o.city}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                        {o.brands?.name || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                      ₪{Number(o.total_price || 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          o.is_settled
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {o.is_settled ? 'Settled' : 'Open'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>Displaying latest 5 of {orders.length} real-time dispatches</span>
            <button
              onClick={() => setActiveNav('orders')}
              className="font-bold text-[#4352E8] dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Open Orders Console →
            </button>
          </div>
        </div>

        {/* Right Column: Operational Quick-Cards */}
        <div className="space-y-4">
          {/* 1. Couriers Holding Cash */}
          <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WalletIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Couriers Holding Cash</h4>
              </div>
              <button
                onClick={() => setActiveNav('settlements')}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Reconcile →
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {couriers.slice(0, 3).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{c.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{c.todayOrders || 0} orders</p>
                  </div>
                  <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                    ₪{(c.todayCash || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Low Stock Alerts */}
          <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BoxIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Low Stock Strains</h4>
              </div>
              <button
                onClick={() => setActiveNav('inventory')}
                className="text-[11px] font-bold text-[#4352E8] dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Inventory →
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {products
                .filter(p => Number(p.stock_on_hand) <= 10)
                .slice(0, 3)
                .map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">{p.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{p.category}</p>
                    </div>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-xs">
                      {p.stock_on_hand} {p.unit}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* 3. Telegram Ingestion Bot Status */}
          <div className="bg-gradient-to-br from-[#1E2235] to-[#2B3252] text-white rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TelegramIcon className="w-4 h-4 text-[#4352E8]" />
                <span className="text-xs font-bold">Telegram Ingestion</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                Active 🟢
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Webhook listening for forwarded dispatches. Customers and inventory auto-depleted instantly.
            </p>
            <button
              onClick={() => setActiveNav('telegram')}
              className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer text-center"
            >
              Open Telegram Bot Console →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ======================================================== */
/* 2. ROUTE: DISPATCHES & ORDERS CONSOLE                    */
/* ======================================================== */
export function OrdersRouteView({
  orders,
  filteredOrders,
  metrics,
  t,
  isRtl,
  searchQuery,
  setSearchQuery,
  todayOnly,
  setTodayOnly,
  unmaskedPhones,
  setUnmaskedPhones,
  copiedId,
  setCopiedId,
  setSelectedOrderForDrawer,
  couriers = [],
  onAssignCourier
}: {
  orders: Order[]
  filteredOrders: Order[]
  metrics: DashboardMetrics
  t: any
  isRtl: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  todayOnly: boolean
  setTodayOnly: (t: boolean) => void
  unmaskedPhones: Record<string, boolean>
  setUnmaskedPhones: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  copiedId: string | null
  setCopiedId: (id: string | null) => void
  setSelectedOrderForDrawer: (o: Order) => void
  couriers?: Courier[]
  onAssignCourier?: (orderId: string, courierId: string | null) => Promise<void>
}) {
  return (
    <div className="space-y-6">
      {/* Orders Specific KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Dispatches</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{orders.length}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">All registered orders</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Today's Shift</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{metrics.totalDeliveriesToday || orders.length}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Active today</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pending Settlement</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {orders.filter(o => !o.is_settled).length}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Unreconciled cash</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Value</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ₪{orders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Gross order volume</p>
        </div>
      </div>

      {/* Dedicated Orders Search & Filter Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0B0F17] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div className="relative w-full sm:w-96">
          <div className={`absolute top-2.5 ${isRtl ? 'right-3' : 'left-3'} text-slate-400`}>
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`w-full py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40 ${
              isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute top-2 ${isRtl ? 'left-3' : 'right-3'} text-xs text-slate-400 hover:text-slate-700 px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 cursor-pointer`}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters Summary & Fast Toggles */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t.totalFiltered.replace('{count}', filteredOrders.length.toString())}
          </span>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => setTodayOnly(false)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                !todayOnly ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Orders
            </button>
            <button
              onClick={() => setTodayOnly(true)}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                todayOnly ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today's Shift
            </button>
          </div>
        </div>
      </div>

      {/* Full Dispatches & Orders Table */}
      <div className="rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="bg-slate-50 dark:bg-[#0F1420] border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">{t.colCustomerName}</th>
                <th className="py-3.5 px-3">{t.colCity}</th>
                <th className="py-3.5 px-3">{t.colPhone}</th>
                <th className="py-3.5 px-3">{t.colTelegram}</th>
                <th className="py-3.5 px-3">{t.colLastBrand}</th>
                <th className="py-3.5 px-3">{t.colMenuItems}</th>
                <th className="py-3.5 px-3">{t.colActualItems}</th>
                <th className="py-3.5 px-4">{t.colPrice}</th>
                <th className="py-3.5 px-3 min-w-[150px]">{t.colCourier || 'Courier'}</th>
                <th className="py-3.5 px-3 text-center">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No matching dispatches found for current filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const cust = order.crm_customers
                  const rawPhone = cust?.phone_number || ''
                  const isMasked = !unmaskedPhones[order.id]
                  const isCopied = copiedId === order.id
                  const waNumber = rawPhone.replace(/\D/g, '').replace(/^0/, '972')

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderForDrawer(order)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#4352E8] shrink-0" />
                          <span className="truncate">{cust?.address_name || order.address}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 text-slate-400" />
                          {order.city}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">
                            {isMasked ? '05•-•••••••' : rawPhone || '—'}
                          </span>
                          {rawPhone && (
                            <>
                              <button
                                onClick={() =>
                                  setUnmaskedPhones(prev => ({ ...prev, [order.id]: !prev[order.id] }))
                                }
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition cursor-pointer"
                                title={isMasked ? t.unmaskPhone : t.maskPhone}
                              >
                                {isMasked ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeOffIcon className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(rawPhone)
                                  setCopiedId(order.id)
                                  setTimeout(() => setCopiedId(null), 2000)
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition cursor-pointer"
                                title={isCopied ? t.copied : 'Copy'}
                              >
                                {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <span className="text-[10px]">📋</span>}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3" onClick={e => e.stopPropagation()}>
                        {cust?.telegram_handle ? (
                          <a
                            href={`https://t.me/${cust.telegram_handle.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#4352E8] dark:text-indigo-400 hover:underline flex items-center gap-1 font-mono text-[11px] font-semibold"
                          >
                            <TelegramIcon className="w-3.5 h-3.5 text-[#4352E8] dark:text-indigo-400" />
                            <span>{cust.telegram_handle}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
                          <TagIcon className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                          {order.brands?.name || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate font-medium">
                        {order.menu_items || '—'}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                          {order.actual_items || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                        ₪{Number(order.total_price || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3" onClick={e => e.stopPropagation()}>
                        <div className="relative inline-block w-full min-w-[145px]">
                          <select
                            value={order.crm_couriers?.id || ''}
                            onChange={e => {
                              const val = e.target.value || null
                              if (onAssignCourier) {
                                onAssignCourier(order.id, val)
                              }
                            }}
                            className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40 ${
                              order.crm_couriers?.id
                                ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-bold hover:bg-indigo-100/90 dark:hover:bg-indigo-900/50'
                                : 'bg-slate-50 dark:bg-slate-900/60 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-indigo-300 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                          >
                            <option value="" className="dark:bg-slate-900">{t.unassignedCourier || 'Unassigned'}</option>
                            {(couriers || []).map(c => (
                              <option key={c.id} value={c.id} className="dark:bg-slate-900">
                                🛵 {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {rawPhone && (
                            <>
                              <a
                                href={`https://wa.me/${waNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                                title={t.whatsappCustomer}
                              >
                                <WhatsAppIcon className="w-4 h-4" />
                              </a>
                              <a
                                href={`tel:${rawPhone}`}
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#4352E8] transition"
                                title={t.callCustomer}
                              >
                                <PhoneIcon className="w-4 h-4" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ======================================================== */
/* 3. ROUTE: LIVE INVENTORY (29/9) CONSOLE                  */
/* ======================================================== */
export function InventoryRouteView({
  products,
  filteredProducts,
  metrics,
  t,
  isRtl,
  inventorySearch,
  setInventorySearch,
  inventoryStatusFilter,
  setInventoryStatusFilter,
  setAdjustingProduct,
  setAdjustType,
  setAdjustQty,
  onOpenAddProduct,
  onOpenEditProduct,
  onOpenDeleteProduct
}: {
  products: Product[]
  filteredProducts: Product[]
  metrics: DashboardMetrics
  t: any
  isRtl: boolean
  inventorySearch: string
  setInventorySearch: (s: string) => void
  inventoryStatusFilter: 'ALL' | 'LOW' | 'OUT'
  setInventoryStatusFilter: (f: 'ALL' | 'LOW' | 'OUT') => void
  setAdjustingProduct: (p: Product) => void
  setAdjustType: (t: 'ADD' | 'DEDUCT') => void
  setAdjustQty: (q: string) => void
  onOpenAddProduct?: () => void
  onOpenEditProduct?: (p: Product) => void
  onOpenDeleteProduct?: (p: Product) => void
}) {
  return (
    <div className="space-y-6">
      {/* Inventory KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total SKUs</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{products.length}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Warehouse catalog strains</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Low Stock Alerts</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{metrics.lowStockAlerts}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Threshold ≤10g / units</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Out of Stock</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {products.filter(p => Number(p.stock_on_hand) <= 0).length}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Urgent restock needed</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Warehouse Weight</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {products
              .filter(p => p.unit === 'g')
              .reduce((sum, p) => sum + (Number(p.stock_on_hand) || 0), 0)
              .toLocaleString()}g
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Total live grams in stock</p>
        </div>
      </div>

      {/* Inventory Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0B0F17] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="relative w-full sm:w-96">
          <div className={`absolute top-2.5 ${isRtl ? 'right-3' : 'left-3'} text-slate-400 dark:text-slate-500`}>
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={inventorySearch}
            onChange={e => setInventorySearch(e.target.value)}
            placeholder="Search strain or brand name / alias..."
            className={`w-full py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40 ${
              isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'
            }`}
          />
          {inventorySearch && (
            <button
              onClick={() => setInventorySearch('')}
              className={`absolute top-2 ${isRtl ? 'left-3' : 'right-3'} text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 cursor-pointer`}
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Toggles & Add Action */}
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 border border-transparent dark:border-slate-800">
            <button
              onClick={() => setInventoryStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                inventoryStatusFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Items ({products.length})
            </button>
            <button
              onClick={() => setInventoryStatusFilter('LOW')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                inventoryStatusFilter === 'LOW'
                  ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
            >
              Low Stock Only
            </button>
            <button
              onClick={() => setInventoryStatusFilter('OUT')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                inventoryStatusFilter === 'OUT'
                  ? 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
            >
              Out of Stock
            </button>
          </div>

          {onOpenAddProduct && (
            <button
              type="button"
              onClick={onOpenAddProduct}
              className="px-3.5 py-1.5 rounded-xl bg-[#4352E8] hover:bg-[#3442cb] text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Inventory Catalog Table */}
      <div className="rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">{t.productName}</th>
                <th className="py-3.5 px-3">{t.category}</th>
                <th className="py-3.5 px-3">{t.stockOnHand}</th>
                <th className="py-3.5 px-3">{t.unit}</th>
                <th className="py-3.5 px-3">{t.minStock}</th>
                <th className="py-3.5 px-3">{t.status}</th>
                <th className="py-3.5 px-4 text-center">Actions / פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredProducts.map(prod => {
                const stock = Number(prod.stock_on_hand) || 0
                const minAlert = Number(prod.min_stock_alert) || 10
                const isLow = stock <= minAlert && stock > 0
                const isOut = stock <= 0

                const statusBadge = isOut
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                  : isLow
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'

                const statusLabel = isOut ? t.stockOut : isLow ? t.stockLow : t.stockHealthy

                return (
                  <tr key={prod.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      <div>
                        <span>{prod.name}</span>
                        {prod.aliases && prod.aliases.length > 0 && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                            Aliases: {prod.aliases.slice(0, 3).join(', ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                      {stock.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400 font-semibold">
                      {prod.unit === 'g' ? t.grams : t.units}
                    </td>
                    <td className="py-3.5 px-3 text-slate-400 dark:text-slate-500 font-mono">
                      {minAlert} {prod.unit === 'g' ? t.grams : t.units}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${statusBadge}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustingProduct(prod)
                            setAdjustType('ADD')
                            setAdjustQty(prod.unit === 'g' ? '50' : '10')
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-[#4352E8] hover:text-white dark:hover:bg-[#4352E8] dark:hover:text-white text-slate-700 dark:text-slate-300 text-xs font-bold transition shadow-xs cursor-pointer"
                          title="Restock or deduct quantity"
                        >
                          {t.updateStock}
                        </button>
                        {onOpenEditProduct && (
                          <button
                            type="button"
                            onClick={() => onOpenEditProduct(prod)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                            title="Edit Product Details"
                          >
                            <EditIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onOpenDeleteProduct && (
                          <button
                            type="button"
                            onClick={() => onOpenDeleteProduct(prod)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                            title="Delete Product"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ======================================================== */
/* 4. ROUTE: COURIER CASH SETTLEMENTS CONSOLE               */
/* ======================================================== */
export function SettlementsRouteView({
  couriers,
  metrics,
  t,
  isRtl,
  setSettlingCourier,
  setReceivedCashInput,
  onOpenAddCourier,
  onOpenEditCourier,
  onOpenDeleteCourier
}: {
  couriers: Courier[]
  metrics: DashboardMetrics
  t: any
  isRtl: boolean
  setSettlingCourier: (c: Courier) => void
  setReceivedCashInput: (v: string) => void
  onOpenAddCourier?: () => void
  onOpenEditCourier?: (c: Courier) => void
  onOpenDeleteCourier?: (c: Courier) => void
}) {
  return (
    <div className="space-y-6">
      {/* Top Settlements Bar & Add Courier Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#0B0F17] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.settlementTitle}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Daily physical cash reconciliation & courier roster</p>
        </div>
        {onOpenAddCourier && (
          <button
            type="button"
            onClick={onOpenAddCourier}
            className="px-3.5 py-2 rounded-xl bg-[#4352E8] hover:bg-[#3442cb] text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Courier</span>
          </button>
        )}
      </div>

      {/* Settlements KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Cash Today</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            ₪{metrics.courierCashToday.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Collected across couriers</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reconciled Cash</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ₪{couriers.filter(c => (c.todayOrders || 0) > 0 && c.isSettledToday).reduce((s, c) => s + (c.todayCash || 0), 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Shift closed out</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Outstanding Balance</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            ₪{couriers.filter(c => (c.todayOrders || 0) > 0 && !c.isSettledToday).reduce((s, c) => s + (c.todayCash || 0), 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Still in courier hands</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Couriers</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {couriers.filter(c => (c.todayOrders || 0) > 0).length}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {couriers.filter(c => (c.todayOrders || 0) > 0).length} of {couriers.length} on duty today
          </p>
        </div>
      </div>

      {/* Active Couriers Shift Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {couriers.map(courier => {
          const ordersCount = courier.todayOrders || 0
          const cash = courier.todayCash || 0
          const isSettled = ordersCount > 0 && !!courier.isSettledToday
          const hasNoShift = ordersCount === 0

          return (
            <div key={courier.id} className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{courier.name}</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{courier.phone_number || 'Telegram Active'}</p>
                </div>
                {hasNoShift ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                    {t.noShift}
                  </span>
                ) : isSettled ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30">
                    {t.settled}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30">
                    {t.pending}
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-baseline justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">{ordersCount} deliveries</span>
                <span className={`font-mono font-extrabold text-base ${hasNoShift ? 'text-slate-400 dark:text-slate-500' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  ₪{cash.toLocaleString()}
                </span>
              </div>

              {!hasNoShift && !isSettled && cash > 0 ? (
                <button
                  onClick={() => {
                    setSettlingCourier(courier)
                    setReceivedCashInput((courier.todayCash || 0).toString())
                  }}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer text-center"
                >
                  סגירת קופה / Close Shift
                </button>
              ) : (
                <div className="w-full py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 font-semibold text-xs text-center border border-slate-100 dark:border-slate-800">
                  {hasNoShift ? t.noShiftBtn : isSettled ? t.shiftReconciledBtn : t.noCashInHand}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Full Courier Settlements Reconciliation Table */}
      <div className="rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">{t.courierName}</th>
                <th className="py-3.5 px-3">{t.ordersDelivered}</th>
                <th className="py-3.5 px-3">{t.totalCollected}</th>
                <th className="py-3.5 px-3">{t.settlementStatus}</th>
                <th className="py-3.5 px-4 text-center">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {couriers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    No couriers registered in system.
                  </td>
                </tr>
              ) : (
                couriers.map(courier => {
                  const ordersCount = courier.todayOrders || 0
                  const cash = courier.todayCash || 0
                  const isSettled = ordersCount > 0 && !!courier.isSettledToday
                  const hasNoShift = ordersCount === 0

                  return (
                    <tr key={courier.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div>
                          <span>{courier.name}</span>
                          {courier.phone_number && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              {courier.phone_number}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-bold">
                        {ordersCount}
                      </td>
                      <td className={`py-3.5 px-3 font-extrabold text-sm font-mono ${hasNoShift ? 'text-slate-400 dark:text-slate-500' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        ₪{cash.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3">
                        {hasNoShift ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                            {t.noShift}
                          </span>
                        ) : isSettled ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30">
                            {t.settled}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30">
                            {t.pending}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!hasNoShift && !isSettled && cash > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSettlingCourier(courier)
                                setReceivedCashInput((courier.todayCash || 0).toString())
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              {t.closeShift}
                            </button>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 text-xs px-2">—</span>
                          )}
                          {onOpenEditCourier && (
                            <button
                              type="button"
                              onClick={() => onOpenEditCourier(courier)}
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                              title="Edit Courier"
                            >
                              <EditIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onOpenDeleteCourier && (
                            <button
                              type="button"
                              onClick={() => onOpenDeleteCourier(courier)}
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                              title="Delete Courier"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ======================================================== */
/* 5. ROUTE: CUSTOMER DIRECTORY CONSOLE                     */
/* ======================================================== */
export function CustomersRouteView({
  customerList,
  filteredCustomers,
  orders,
  cityCounts,
  t,
  isRtl,
  customerSearch,
  setCustomerSearch,
  unmaskedPhones,
  setUnmaskedPhones,
  copiedId,
  setCopiedId
}: {
  customerList: Customer[]
  filteredCustomers: Customer[]
  orders: Order[]
  cityCounts: Record<string, number>
  t: any
  isRtl: boolean
  customerSearch: string
  setCustomerSearch: (s: string) => void
  unmaskedPhones: Record<string, boolean>
  setUnmaskedPhones: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  copiedId: string | null
  setCopiedId: (id: string | null) => void
}) {
  return (
    <div className="space-y-6">
      {/* Customer Directory KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Customers</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{customerList.length}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Deduplicated by phone</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Delivery Hubs</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {Object.keys(cityCounts).filter(c => cityCounts[c] > 0).length || 12}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Active Israeli cities</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Repeat Rate</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">100%</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">High customer loyalty</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Customer Revenue</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ₪{orders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Total customer spend</p>
        </div>
      </div>

      {/* Customer Directory Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0B0F17] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="relative w-full sm:w-96">
          <div className={`absolute top-2.5 ${isRtl ? 'right-3' : 'left-3'} text-slate-400 dark:text-slate-500`}>
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            placeholder="Search by customer address, phone, or city..."
            className={`w-full py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40 ${
              isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'
            }`}
          />
          {customerSearch && (
            <button
              onClick={() => setCustomerSearch('')}
              className={`absolute top-2 ${isRtl ? 'left-3' : 'right-3'} text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 cursor-pointer`}
            >
              ✕
            </button>
          )}
        </div>

        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Showing {filteredCustomers.length} of {customerList.length} verified customers
        </span>
      </div>

      {/* Dedicated Customers Table */}
      <div className="rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Customer Identity (Address)</th>
                <th className="py-3.5 px-3">City</th>
                <th className="py-3.5 px-3">Unique Phone</th>
                <th className="py-3.5 px-3">Telegram</th>
                <th className="py-3.5 px-3">Customer Tier</th>
                <th className="py-3.5 px-3">Orders Placed</th>
                <th className="py-3.5 px-3">Total Spend</th>
                <th className="py-3.5 px-4 text-center">Fast Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No matching customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(cust => {
                  const rawPhone = cust.phone_number || ''
                  const isMasked = !unmaskedPhones[cust.id]
                  const isCopied = copiedId === cust.id
                  const waNumber = rawPhone.replace(/\D/g, '').replace(/^0/, '972')

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="truncate">{cust.address_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          {cust.city || 'מרכז'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">
                            {isMasked ? '05•-•••••••' : rawPhone || '—'}
                          </span>
                          {rawPhone && (
                            <>
                              <button
                                onClick={() =>
                                  setUnmaskedPhones(prev => ({ ...prev, [cust.id]: !prev[cust.id] }))
                                }
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition cursor-pointer"
                                title={isMasked ? t.unmaskPhone : t.maskPhone}
                              >
                                {isMasked ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeOffIcon className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(rawPhone)
                                  setCopiedId(cust.id)
                                  setTimeout(() => setCopiedId(null), 2000)
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition cursor-pointer"
                                title={isCopied ? t.copied : 'Copy'}
                              >
                                {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <span className="text-[10px]">📋</span>}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {cust.telegram_handle ? (
                          <a
                            href={`https://t.me/${cust.telegram_handle.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#4352E8] dark:text-indigo-400 hover:underline flex items-center gap-1 font-mono text-[11px] font-semibold"
                          >
                            <TelegramIcon className="w-3.5 h-3.5 text-[#4352E8] dark:text-indigo-400" />
                            <span>{cust.telegram_handle}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                          {cust.customer_type || 'קבוע'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                        {cust.total_orders || 1}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-extrabold text-slate-900 dark:text-white">
                        ₪{(cust.total_spent || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {rawPhone && (
                            <>
                              <a
                                href={`https://wa.me/${waNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 transition"
                                title="WhatsApp Customer"
                              >
                                <WhatsAppIcon className="w-4 h-4" />
                              </a>
                              <a
                                href={`tel:${rawPhone}`}
                                className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-[#4352E8] dark:text-indigo-400 transition"
                                title="Call Customer"
                              >
                                <PhoneIcon className="w-4 h-4" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ======================================================== */
/* 6. ROUTE: TELEGRAM INGESTION & WEBHOOK CONSOLE           */
/* ======================================================== */
export function TelegramRouteView({
  ordersCount,
  isRtl,
  testTelegramText,
  setTestTelegramText,
  parsedTestResult,
  handleTestParse
}: {
  ordersCount: number
  isRtl: boolean
  testTelegramText: string
  setTestTelegramText: (t: string) => void
  parsedTestResult: ParsedDeliveryOrder | null
  handleTestParse: () => void
}) {
  return (
    <div className="space-y-6">
      {/* Telegram Status KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Webhook Endpoint</span>
          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono truncate">/api/telegram/webhook</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Live active listener 🟢</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Admin Whitelist</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">Active 🛡️</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">ALLOWED_TELEGRAM_ADMIN_IDS</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dispatches Ingested</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{ordersCount}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Parsed orders in CRM</p>
        </div>
        <div className="bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Slash Rule Precision</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">100%</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Warehouse stock deduction</p>
        </div>
      </div>

      {/* Interactive Ingestion Sandbox Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Sandbox: Input Message */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TelegramIcon className="w-4 h-4 text-[#4352E8] dark:text-indigo-400" />
              <span>Live Dispatch Message Parser Sandbox</span>
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Paste any forwarded Telegram dispatch order below to test regex extraction & slash deduction live.
            </p>
          </div>

          <textarea
            rows={6}
            value={testTelegramText}
            onChange={e => setTestTelegramText(e.target.value)}
            dir="rtl"
            className="w-full p-3.5 rounded-xl bg-slate-900 dark:bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed border border-transparent dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4352E8]"
            placeholder="Paste forwarded message here..."
          />

          <button
            onClick={handleTestParse}
            className="w-full py-2.5 rounded-xl bg-[#4352E8] hover:bg-[#3442D9] text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>⚡ Test Parse Message Now</span>
          </button>
        </div>

        {/* Right Sandbox: Extracted Breakdown */}
        <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Extracted Parsed Fields</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-500/30">
              Real-Time Output
            </span>
          </div>

          {parsedTestResult ? (
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Customer Address (Identity)</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{parsedTestResult.customerName || '—'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Extracted Phone</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white">{parsedTestResult.phoneNumber || '—'}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Delivery City</span>
                  <p className="font-bold text-slate-900 dark:text-white">{parsedTestResult.city || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Brand Matched</span>
                  <p className="font-bold text-indigo-700 dark:text-indigo-400">{parsedTestResult.brand || '—'}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Extracted Price</span>
                  <p className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400">₪{parsedTestResult.totalPrice || 0}</p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 space-y-1">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase">Warehouse Slash Deduction</span>
                <p className="font-bold text-emerald-900 dark:text-emerald-300">{parsedTestResult.actualItems || '—'}</p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              Click &ldquo;Test Parse Message Now&rdquo; to test regex extraction and warehouse deduction.
            </div>
          )}
        </div>
      </div>

      {/* Operational Telegram Integration Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">Forward 20-50 Orders at Once</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Managers can multi-select up to 50 forwarded Telegram order receipts and forward them in a single burst into the bot.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">The Slash Inventory Rule</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            In <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-700 dark:text-indigo-300 font-mono">Menu / Warehouse Item</code>, whatever is after the slash deducts live warehouse inventory with fuzzy spelling tolerance.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0B0F17] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">Courier Phone Masking</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Couriers receiving dispatched orders never see customer real phone numbers. They only see masked Twilio relay links.
          </p>
        </div>
      </div>
    </div>
  )
}
