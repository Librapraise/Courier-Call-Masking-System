'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GhostCrmLogoIcon } from '@/components/crm/GhostCrmLogo'
import ThemeToggle from '@/components/ThemeToggle'
import {
  TruckIcon,
  BoxIcon,
  WalletIcon,
  TelegramIcon,
  ShieldIcon,
  PhoneIcon,
  ChevronRightIcon,
  GlobeIcon,
  MenuIcon,
  XIcon
} from '@/components/crm/CrmIcons'

type Language = 'en' | 'he'

const CONTENT = {
  en: {
    nav: {
      portals: 'Portals',
      capabilities: 'Capabilities',
      architecture: 'Architecture',
      apiSpecs: 'API Specs',
      signIn: 'Sign In',
      register: 'Register Courier',
      launchCrm: 'Launch CRM',
      switchLangText: 'עברית'
    },
    hero: {
      statusPill: 'Autonomous Ingestion • Twilio Masking • Live Inventory',
      titlePart1: 'Courier Call Masking &',
      titleHighlight: 'Telegram Dispatch CRM',
      subtitle:
        'Enterprise delivery management engineered for strict OPSEC. Bridging anonymous Twilio customer call masking, batch Telegram order parsing, slash-rule warehouse stock depletion, and daily courier cash reconciliation.'
    },
    courierCard: {
      badge: 'Field Agents',
      title: 'Courier Mobile Portal',
      description:
        'Dedicated interface for active couriers. View assigned delivery addresses, initiate masked calls through Twilio with zero customer phone leaks, and complete delivery handoffs.',
      bullet1: '100% Phone Number Anonymity (Zero Contact Exposure)',
      bullet2: 'Assigned Route Isolation (View Only Your Deliveries)',
      bullet3: 'Automated SMS Feedback Trigger on Delivery Handover',
      btnEnter: 'Enter Courier Portal',
      btnRegister: 'Register New Courier Account'
    },
    crmCard: {
      badge: 'Managers & Admins',
      title: 'Persian CRM Command Center',
      description:
        'Full bilingual dispatch and inventory cockpit. Real-time Telegram ingestion, live slash-rule warehouse depletion, courier cash settlement ("סגירת קופה"), and brand analytics.',
      bullet1: 'Instant Bilingual Toggle (English LTR ↔ Hebrew RTL)',
      bullet2: 'The Slash Rule: Automatic Live Warehouse Depletion',
      bullet3: 'Daily Shift Cash Settlement & Reconciliation Engine',
      btnLaunch: 'Launch Persian CRM Dashboard',
      btnAdmin: 'Call System Management Portal (/admin)'
    },
    capabilities: {
      tag: 'Engineered For Reliability & Privacy',
      title: 'Enterprise Logistics & Security Architecture',
      feat1Title: 'Twilio Call Masking',
      feat1Desc:
        "Couriers dial customers through Twilio virtual proxy lines. Neither the courier nor the customer ever learns each other's personal mobile numbers.",
      feat2Title: 'Telegram Forward Ingestion',
      feat2Desc:
        'Dispatchers forward single or bulk orders directly to the Telegram ingestion bot. Text parsing instantly resolves phone, address, and items.',
      feat3Title: 'The Slash Inventory Rule',
      feat3Desc:
        'Smart deduction engine interprets Menu / [Qty] Warehouse Item and subtracts precise grams from live stock.',
      feat4Title: 'Daily Cash Settlement',
      feat4Desc:
        'Real-time tracking of cash collected in courier pockets. End-of-day drawer reconciliation with one-click shift closeout ("סגירת קופה").',
      feat5Title: 'Bilingual LTR / RTL Engine',
      feat5Desc:
        'Instant one-tap switch between English (LTR) and Hebrew (RTL) across all metrics, tables, filters, and reports with UTF-8 BOM Excel exports.',
      feat6Title: 'Hardened OPSEC & RLS',
      feat6Desc:
        'Telegram ID whitelist enforcement, Supabase Row-Level Security, strict courier customer assignment isolation, and anti-tamper security headers.'
    },
    architecture: {
      tag: 'Developer & Integration Hub',
      title: 'Interactive OpenAPI & Swagger Documentation',
      description:
        'Explore the complete API specification powering call initiation, customer routes, Telegram webhook ingestion, and live inventory transactions.',
      button: 'Explore Swagger API Specs'
    },
    footer: {
      brandSub: 'Persian CRM • Persian Team Management',
      signIn: 'Sign In',
      register: 'Register',
      crmDashboard: 'CRM Dashboard',
      apiDocs: 'API Docs',
      copyright: 'Persian Team Dispatch Technologies. All rights reserved.'
    }
  },
  he: {
    nav: {
      portals: 'פורטלים',
      capabilities: 'יכולות מערכת',
      architecture: 'ארכיטקטורה',
      apiSpecs: 'מפרט API',
      signIn: 'התחברות',
      register: 'רישום שליח',
      launchCrm: 'הפעלת CRM',
      switchLangText: 'English'
    },
    hero: {
      statusPill: 'קליטה אוטונומית • מיסוך Twilio • מלאי חי בזמן אמת',
      titlePart1: 'מיסוך שיחות שליחים &',
      titleHighlight: 'CRM שיגור מטלגרם',
      subtitle:
        'ניהול מערך משלוחים ארגוני בהנדסת OPSEC מחמירה. גישור בין מיסוך שיחות לקוחות אנונימי ב-Twilio, פענוח הזמנות טלגרם מרוכזות, ניפוק מלאי לפי חוק הסלאש וסגירת קופת שליחים יומית.'
    },
    courierCard: {
      badge: 'סוכני שטח / שליחים',
      title: 'פורטל שליחים בנייד',
      description:
        'ממשק ייעודי לשליחים פעילים בשטח. צפייה בכתובות המשלוח שהוקצו, חיוג שיחות ממוסכות דרך Twilio ללא חשיפת מספרי טלפון, ואישור מסירת משלוחים.',
      bullet1: '100% אנונימיות למספרי טלפון (אפס חשיפת פרטי קשר)',
      bullet2: 'בידוד מסלול משלוחים (צפייה במשלוחים האישיים בלבד)',
      bullet3: 'שליחת הודעת משוב SMS אוטומטית בעת מסירת החבילה',
      btnEnter: 'כניסה לפורטל שליחים',
      btnRegister: 'רישום חשבון שליח חדש'
    },
    crmCard: {
      badge: 'מנהלים ואדמינים',
      title: 'מרכז הבקרה Persian CRM',
      description:
        'קוקפיט דו-לשוני לשיגור הזמנות וניהול מלאי מחסן. קליטת הודעות טלגרם בזמן אמת, ניפוק מלאי אוטומטי לפי חוק הסלאש, סגירת קופת שליחים ודוחות מותגים.',
      bullet1: 'מעבר דו-לשוני מיידי (אנגלית משמאל לימין ↔ עברית מימין לשמאל)',
      bullet2: 'חוק הסלאש: גריעת מלאי מחסן חי אוטומטית לפי פריט',
      bullet3: 'מנוע סגירת קופה והתאמת מזומנים יומית לשליחים ("סגירת קופה")',
      btnLaunch: 'כניסה ללוח הבקרה Persian CRM',
      btnAdmin: 'פורטל ניהול מערכת שיחות (/admin)'
    },
    capabilities: {
      tag: 'מהונדס לאמינות מקסימלית ופרטיות OPSEC',
      title: 'ארכיטקטורת לוגיסטיקה ואבטחה ארגונית',
      feat1Title: 'מיסוך שיחות Twilio',
      feat1Desc:
        'שליחים מחייגים ללקוחות דרך קווי פרוקסי וירטואליים של Twilio. השליח והלקוח אינם רואים לעולם את מספרי הנייד האישיים זה של זה.',
      feat2Title: 'קליטת הזמנות מטלגרם',
      feat2Desc:
        'מוקדנים מעבירים הודעות בודדות או מרוכזות לבוט הקליטה בטלגרם. מנוע הפענוח מחלץ מיידית טלפון, כתובת, עיר ומוצרים.',
      feat3Title: 'חוק הסלאש לניפוק מלאי',
      feat3Desc:
        'מנוע חכם שמזהה מבנה של "תפריט / [כמות] פריט מחסן" ומחסיר בדיוק גרמים או יחידות מהמלאי החי של המחסן.',
      feat4Title: 'סגירת קופת שליחים יומית',
      feat4Desc:
        'מעקב חי אחר כספי הגבייה בכיסי השליחים. התאמת קופה בסיום יום וסגירת משמרת רשמית בלחיצה אחת ("סגירת קופה").',
      feat5Title: 'מנוע דו-לשוני מלא (LTR / RTL)',
      feat5Desc:
        'מעבר מיידי בין אנגלית לעברית בכל המדדים, הטבלאות, הסינונים והדוחות עם ייצוא אקסל תואם עברית (BOM UTF-8).',
      feat6Title: 'אבטחת OPSEC ובידוד נתונים',
      feat6Desc:
        'רשימה לבנה למשתמשי טלגרם מורשים, אבטחת Supabase ברמת שורה (RLS), בידוד מלא בין שליחים וכותרות אבטחה מוקשחות.'
    },
    architecture: {
      tag: 'מרכז פיתוח ואינטגרציות',
      title: 'תיעוד API אינטראקטיבי ומפרט Swagger',
      description:
        'עיינו במפרט ה-API המלא המניע ייזום שיחות ממוסכות, הקצאת שליחים, קליטת ווב-הוק טלגרם ותנועות מלאי חיות.',
      button: 'עיון במפרט Swagger API'
    },
    footer: {
      brandSub: 'Persian CRM • ניהול צוותי הפצה ומערך שליחים',
      signIn: 'התחברות',
      register: 'רישום',
      crmDashboard: 'לוח בקרה CRM',
      apiDocs: 'תיעוד API',
      copyright: 'טכנולוגיות שיגור Persian Team. כל הזכויות שמורות.'
    }
  }
}

export default function Home() {
  const [lang, setLang] = useState<Language>('en')
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('landing_lang') as Language | null
    if (saved === 'en' || saved === 'he') {
      setLang(saved)
    }
  }, [])

  const toggleLang = () => {
    const nextLang: Language = lang === 'en' ? 'he' : 'en'
    setLang(nextLang)
    try {
      localStorage.setItem('landing_lang', nextLang)
      localStorage.setItem('crm_lang', nextLang)
    } catch {
      // storage unavailable fallback
    }
  }

  const t = CONTENT[lang]
  const isRTL = lang === 'he'

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`min-h-screen bg-slate-50 dark:bg-[#070A11] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-[#4352E8]/30 relative overflow-hidden transition-colors duration-200 ${
        isRTL ? 'text-right' : 'text-left'
      }`}
    >
      {/* Background Decorative Radial Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-[#4352E8]/10 dark:from-[#4352E8]/20 via-[#6366F1]/5 dark:via-[#6366F1]/10 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-96 left-1/4 w-[500px] h-[350px] bg-[#06B6D4]/5 dark:bg-[#06B6D4]/10 blur-[150px] pointer-events-none -z-10" />

      {/* Top Glassmorphic Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-[#070A11]/85 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-2">
          {/* Logo & Brand Title */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <GhostCrmLogoIcon className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 drop-shadow-md" />
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                Persian CRM
              </span>
              <span className="hidden sm:inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 dark:border-indigo-500/30 shrink-0">
                v2.0
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
            <a href="#portals" className="hover:text-slate-900 dark:hover:text-white transition whitespace-nowrap">{t.nav.portals}</a>
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition whitespace-nowrap">{t.nav.capabilities}</a>
            <a href="#architecture" className="hover:text-slate-900 dark:hover:text-white transition whitespace-nowrap">{t.nav.architecture}</a>
            <Link href="/api-docs" className="hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1 whitespace-nowrap">
              <span>{t.nav.apiSpecs}</span>
              <span className="text-[10px] px-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">REST</span>
            </Link>
          </nav>

          {/* Action Area (Theme Toggler, Language Toggle, Auth & Launch) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Dark / Light / System Theme Toggler */}
            <ThemeToggle lang={lang} align="end" />

            {/* Language Translate Toggle Button */}
            <button
              onClick={toggleLang}
              aria-label="Toggle language between English and Hebrew"
              className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/90 shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 group"
              title={lang === 'en' ? 'תרגם לעברית' : 'Translate to English'}
            >
              <GlobeIcon className="w-3.5 h-3.5 text-[#4352E8] group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-semibold tracking-wide">
                {mounted ? t.nav.switchLangText : 'עברית'}
              </span>
            </button>

            {/* Sign In Button (Desktop) */}
            <Link
              href="/login"
              className="hidden sm:inline-flex text-xs font-bold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.nav.signIn}
            </Link>

            {/* Launch CRM Button */}
            <Link
              href="/crm"
              className="text-xs font-bold px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-[#4352E8] to-[#6366F1] hover:from-[#3B49D6] hover:to-[#5558E6] text-white shadow-lg shadow-indigo-500/25 transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
            >
              <span>{t.nav.launchCrm}</span>
              <ChevronRightIcon className={`w-3.5 h-3.5 shrink-0 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
            </Link>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer shrink-0 border border-slate-200 dark:border-slate-800"
            >
              {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#070A11]/98 backdrop-blur-xl px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl">
            <nav className="flex flex-col gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <a
                href="#portals"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-between"
              >
                <span>{t.nav.portals}</span>
                <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ${isRTL ? 'rotate-180' : ''}`} />
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-between"
              >
                <span>{t.nav.capabilities}</span>
                <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ${isRTL ? 'rotate-180' : ''}`} />
              </a>
              <a
                href="#architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-between"
              >
                <span>{t.nav.architecture}</span>
                <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ${isRTL ? 'rotate-180' : ''}`} />
              </a>
              <Link
                href="/api-docs"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-between"
              >
                <span>{t.nav.apiSpecs}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">REST</span>
              </Link>
            </nav>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <ThemeToggle lang={lang} showLabel={true} />
              <button
                onClick={toggleLang}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <GlobeIcon className="w-3.5 h-3.5 text-[#4352E8]" />
                <span>{lang === 'en' ? 'עברית' : 'English'}</span>
              </button>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-900/90 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white transition"
              >
                {t.nav.signIn}
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 rounded-xl bg-slate-200/80 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition"
              >
                {t.nav.register}
              </Link>
            </div>
          </div>
        )}
      </header>


      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-20 flex flex-col items-center">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs font-semibold mb-6 sm:mb-8 shadow-xs dark:shadow-inner text-center max-w-[90vw] transition-colors">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="tracking-wide">{t.hero.statusPill}</span>
        </div>

        {/* Main Title */}
        <div className="text-center max-w-4xl space-y-4 sm:space-y-5">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.12] sm:leading-[1.08] text-slate-900 dark:text-white transition-colors">
            {t.hero.titlePart1}{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-cyan-600 to-indigo-700 dark:from-indigo-300 dark:via-cyan-300 dark:to-indigo-400 bg-clip-text text-transparent">
              {t.hero.titleHighlight}
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-normal transition-colors">
            {t.hero.subtitle}
          </p>
        </div>

        {/* ======================================================== */}
        {/* PORTAL CARDS GATEWAY (Courier vs Manager/Admin)          */}
        {/* ======================================================== */}
        <div id="portals" className="w-full mt-10 sm:mt-18 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-5xl">
          {/* Card 1: Courier Portal */}
          <div className="group relative rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 p-6 sm:p-9 shadow-lg dark:shadow-2xl transition duration-300 flex flex-col justify-between">
            <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-36 h-36 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition`} />

            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-13 h-13 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <TruckIcon className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 tracking-wider uppercase">
                  {t.courierCard.badge}
                </span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">
                {t.courierCard.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                {t.courierCard.description}
              </p>

              <ul className="mt-6 space-y-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</div>
                  <span>{t.courierCard.bullet1}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</div>
                  <span>{t.courierCard.bullet2}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</div>
                  <span>{t.courierCard.bullet3}</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              <Link
                href="/login?redirectTo=/courier"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{t.courierCard.btnEnter}</span>
                <ChevronRightIcon className={`w-4 h-4 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
              <Link
                href="/register"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition flex items-center justify-center cursor-pointer"
              >
                {t.courierCard.btnRegister}
              </Link>
            </div>
          </div>

          {/* Card 2: Operations & Manager CRM */}
          <div className="group relative rounded-2xl bg-white dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 p-6 sm:p-9 shadow-lg dark:shadow-2xl transition duration-300 flex flex-col justify-between">
            <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-36 h-36 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition`} />

            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-13 h-13 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <ShieldIcon className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 tracking-wider uppercase">
                  {t.crmCard.badge}
                </span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">
                {t.crmCard.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                {t.crmCard.description}
              </p>

              <ul className="mt-6 space-y-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</div>
                  <span>{t.crmCard.bullet1}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</div>
                  <span>{t.crmCard.bullet2}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] shrink-0 font-bold">✓</div>
                  <span>{t.crmCard.bullet3}</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              <Link
                href="/crm"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#4352E8] to-[#6366F1] hover:from-[#3B49D6] hover:to-[#5558E6] text-white text-sm font-bold shadow-lg shadow-indigo-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{t.crmCard.btnLaunch}</span>
                <ChevronRightIcon className={`w-4 h-4 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
              </Link>
              <Link
                href="/admin"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition flex items-center justify-center cursor-pointer"
              >
                {t.crmCard.btnAdmin}
              </Link>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CORE SYSTEM CAPABILITIES GRID (6 Premium Cards)           */}
        {/* ======================================================== */}
        <div id="features" className="w-full mt-24 max-w-6xl">
          <div className="text-center space-y-3 mb-12">
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
              {t.capabilities.tag}
            </h3>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight transition-colors">
              {t.capabilities.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Feature 1 */}
            <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <PhoneIcon className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">{t.capabilities.feat1Title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.capabilities.feat1Desc}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
                <TelegramIcon className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">{t.capabilities.feat2Title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.capabilities.feat2Desc}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <BoxIcon className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">{t.capabilities.feat3Title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.capabilities.feat3Desc}
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <WalletIcon className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">{t.capabilities.feat4Title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.capabilities.feat4Desc}
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4">
                <GlobeIcon className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">{t.capabilities.feat5Title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.capabilities.feat5Desc}
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
                <ShieldIcon className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">{t.capabilities.feat6Title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.capabilities.feat6Desc}
              </p>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* INTERACTIVE DATA PIPELINE BANNER                          */}
        {/* ======================================================== */}
        <div id="architecture" className="w-full mt-24 max-w-5xl rounded-2xl bg-gradient-to-r from-slate-100 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/60 border border-slate-200 dark:border-slate-800 p-8 sm:p-10 relative overflow-hidden shadow-sm dark:shadow-none transition-colors">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                {t.architecture.tag}
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white transition-colors">
                {t.architecture.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl transition-colors">
                {t.architecture.description}
              </p>
            </div>

            <Link
              href="/api-docs"
              className="shrink-0 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <span>{t.architecture.button}</span>
              <ChevronRightIcon className={`w-4 h-4 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#06080E] py-8 text-slate-600 dark:text-slate-500 text-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GhostCrmLogoIcon className="w-6 h-6" />
            <span className="font-bold text-slate-900 dark:text-slate-300">{t.footer.brandSub}</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-slate-300 transition">{t.footer.signIn}</Link>
            <Link href="/register" className="hover:text-slate-900 dark:hover:text-slate-300 transition">{t.footer.register}</Link>
            <Link href="/crm" className="hover:text-slate-900 dark:hover:text-slate-300 transition">{t.footer.crmDashboard}</Link>
            <Link href="/api-docs" className="hover:text-slate-900 dark:hover:text-slate-300 transition">{t.footer.apiDocs}</Link>
          </div>

          <div className="text-[11px]">
            &copy; {new Date().getFullYear()} {t.footer.copyright}
          </div>
        </div>
      </footer>
    </div>
  )
}

