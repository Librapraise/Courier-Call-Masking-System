'use client'

import { useEffect, useState, use } from 'react'

const translations = {
  he: {
    loading: 'טוען טופס משוב...',
    invalidLink: 'קישור לא תקין',
    copiedSms: 'אנא ודא שהעתקת את הקישור הנכון מה-SMS.',
    thankYou: 'תודה רבה!',
    alreadySubmitted: 'המשוב כבר הוגש',
    feedbackSaved: 'המשוב שלך נשמר בהצלחה.',
    alreadySubmittedDesc: 'כבר הגשת משוב עבור משלוח זה.',
    appreciateInput: 'אנו מעריכים את תרומתך כדי לעזור לנו לשפר את השירותים שלנו.',
    deliveryFeedback: 'משוב משלוח',
    howDidWeDo: 'הדעה שלך\nחשובה לנו ❤️',
    greeting: 'תודה שבחרת בנו! נשמח מאוד אם תשתף אותנו בחוויה שלך – זה לוקח פחות מדקה.',
    deliveryTimeService: 'זמן משלוח ושירות',
    deliveryDesc: 'כמה מהיר ונוח היה תהליך המשלוח?',
    productQuality: 'איכות המוצר',
    productDesc: 'איך היית מדרג את המוצר?',
    ratingLabels: ['גרוע 😕', 'סביר 😐', 'טוב 🙂', 'טוב מאוד 😊', 'מצוין 🤩'],
    commentsLabel: 'מה נוכל לשפר, או מה אהבת?',
    commentsPlaceholder: 'יש משהו שתרצה שנדע? נשמח לכל הערה, המלצה או הצעה לשיפור.',
    submitting: 'שולח...',
    submitFeedback: 'שלח משוב',
    footer: 'מערכת הסוואת שיחות שליחים • לולאת משוב מאובטחת',
    switchLang: 'English',
  },
  en: {
    loading: 'Loading feedback form...',
    invalidLink: 'Invalid Link',
    copiedSms: 'Please make sure you copied the correct link from the SMS.',
    thankYou: 'Thank You! 🎉',
    alreadySubmitted: 'Already Submitted',
    feedbackSaved: 'Your feedback was successfully saved.',
    alreadySubmittedDesc: 'You have already submitted feedback for this delivery.',
    appreciateInput: 'We appreciate your input to help us improve our services.',
    deliveryFeedback: 'Delivery Feedback',
    howDidWeDo: 'Your opinion\nis important to us. ❤️',
    greeting: 'Thank you for choosing us! We would love it if you would share your experience with us – it takes less than a minute.',
    deliveryTimeService: 'Delivery Time & Service',
    deliveryDesc: 'How fast and convenient was the delivery process?',
    productQuality: 'Product Quality',
    productDesc: 'How would you rate the product?',
    ratingLabels: ['Poor 😕', 'Fair 😐', 'Good 🙂', 'Very Good 😊', 'Excellent 🤩'],
    commentsLabel: 'What could we improve, or what did you like?',
    commentsPlaceholder: "Is there anything you'd like us to know? We'd be happy to receive any comments, recommendations, or suggestions for improvement.",
    submitting: 'Submitting...',
    submitFeedback: 'Submit Feedback',
    footer: 'Courier Call Masking System • Secure Feedback Loop',
    switchLang: 'עברית',
  }
}

const translateError = (errMsg: string, lang: 'he' | 'en') => {
  if (lang === 'en') return errMsg
  if (!errMsg) return 'קישור משוב לא תקין'
  const lowerMsg = errMsg.toLowerCase()
  if (lowerMsg.includes('not found') || lowerMsg.includes('invalid') || lowerMsg.includes('link')) {
    return 'קישור משוב לא תקין או פג תוקף'
  }
  if (lowerMsg.includes('already submitted') || lowerMsg.includes('already been submitted')) {
    return 'כבר הגשת משוב עבור משלוח זה.'
  }
  return 'אירעה שגיאה בטעינת הפרטים. אנא נסה שנית מאוחר יותר.'
}

interface FeedbackPageProps {
  params: Promise<{ customerId: string }>
}

// ─── Inline styles ──────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a4e 35%, #24243e 65%, #0d1b2a 100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  fontFamily: "'Inter', 'Geist', system-ui, sans-serif",
  position: 'relative',
  overflow: 'hidden',
}

const orbStyle = (top: string, left: string, color: string, size: number): React.CSSProperties => ({
  position: 'absolute',
  top,
  left,
  width: size,
  height: size,
  borderRadius: '50%',
  background: color,
  filter: 'blur(80px)',
  opacity: 0.35,
  pointerEvents: 'none',
})

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 24,
  padding: '36px 32px',
  boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
  position: 'relative',
  zIndex: 1,
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(99,102,241,0.25))',
  border: '1px solid rgba(6,182,212,0.4)',
  borderRadius: 999,
  padding: '5px 14px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#67e8f9',
  marginBottom: 12,
}

const headingStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: '#fff',
  margin: '0 0 8px',
  letterSpacing: '-0.5px',
  lineHeight: 1.2,
}

const greetingStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.65)',
  margin: 0,
  lineHeight: 1.6,
}

const ratingCardStyle = (selected: boolean, hovered: boolean): React.CSSProperties => ({
  borderRadius: 16,
  padding: '20px 16px',
  textAlign: 'center' as const,
  background: selected || hovered
    ? 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(99,102,241,0.18))'
    : 'rgba(255,255,255,0.04)',
  border: selected
    ? '1px solid rgba(6,182,212,0.6)'
    : hovered
      ? '1px solid rgba(6,182,212,0.3)'
      : '1px solid rgba(255,255,255,0.08)',
  transition: 'all 0.25s ease',
})

const ratingTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#e2e8f0',
  margin: '0 0 4px',
  letterSpacing: '0.01em',
}

const ratingDescStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
  margin: '0 0 12px',
}

const ratingLabelStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 8,
  fontSize: 13,
  fontWeight: 700,
  color: '#67e8f9',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  color: '#e2e8f0',
  marginBottom: 8,
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  padding: '14px 16px',
  fontSize: 14,
  lineHeight: 1.6,
  resize: 'none' as const,
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const submitBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  borderRadius: 14,
  padding: '15px 24px',
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: '0.02em',
  border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled
    ? 'rgba(255,255,255,0.08)'
    : 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
  color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
  boxShadow: disabled ? 'none' : '0 8px 32px rgba(6,182,212,0.35)',
  transition: 'all 0.2s ease',
  transform: 'translateY(0)',
})

const langBtnStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.8)',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
}

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
  margin: '4px 0',
}

const footerStyle: React.CSSProperties = {
  marginTop: 20,
  textAlign: 'center' as const,
  fontSize: 11,
  color: 'rgba(255,255,255,0.25)',
  letterSpacing: '0.04em',
  zIndex: 1,
}

// ─── Star renderer ───────────────────────────────────────────────────────────

function StarRow({
  rating, hoverRating, setRating, setHoverRating
}: {
  rating: number
  hoverRating: number
  setRating: (r: number) => void
  setHoverRating: (r: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 0' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= (hoverRating || rating)
        return (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              transform: active ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s ease',
              filter: active ? 'drop-shadow(0 0 6px rgba(251,191,36,0.7))' : 'none',
              outline: 'none',
            }}
          >
            <svg
              width="38" height="38"
              viewBox="0 0 24 24"
              fill={active ? '#fbbf24' : 'none'}
              stroke={active ? '#f59e0b' : 'rgba(255,255,255,0.2)'}
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499c.158-.326.628-.326.786 0l2.635 5.337 5.886.856c.36.052.504.497.244.75l-4.258 4.148 1.006 5.86c.061.357-.315.63-.63.462L12 18.18l-5.268 2.768c-.315.168-.691-.105-.63-.463l1.006-5.86L2.85 11.192c-.26-.252-.117-.697.244-.75l5.886-.856 2.635-5.337z"
              />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

// ─── Language button (shared) ────────────────────────────────────────────────

function LangBtn({ language, setLanguage }: { language: 'he' | 'en'; setLanguage: (l: 'he' | 'en') => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...langBtnStyle,
        background: hover ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 006-.371m0 0c1.12 2.233 3.007 4.934 5.585 6.918m-5.585-6.918A48.242 48.242 0 0118 3.621M3 6l2.121-2.121m8.879 8.879c-.896-.792-1.88-1.782-2.9-2.9m0 0a24.184 24.184 0 01-5.12 5.12" />
      </svg>
      <span>{language === 'he' ? 'English' : 'עברית'}</span>
    </button>
  )
}

// ─── Background orbs ─────────────────────────────────────────────────────────

function Orbs() {
  return (
    <>
      <div style={orbStyle('-10%', '-15%', 'radial-gradient(circle, #06b6d4, #0e7490)', 420)} />
      <div style={orbStyle('60%', '70%', 'radial-gradient(circle, #6366f1, #4f46e5)', 360)} />
      <div style={orbStyle('40%', '-5%', 'radial-gradient(circle, #8b5cf6, #7c3aed)', 280)} />
      <div style={orbStyle('-5%', '65%', 'radial-gradient(circle, #0891b2, #0e7490)', 220)} />
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FeedbackPage({ params }: FeedbackPageProps) {
  const resolvedParams = use(params)
  const customerId = resolvedParams.customerId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [courierName, setCourierName] = useState('')
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [language, setLanguage] = useState<'he' | 'en'>('he')

  const [deliveryRating, setDeliveryRating] = useState<number>(0)
  const [productRating, setProductRating] = useState<number>(0)
  const [deliveryHover, setDeliveryHover] = useState<number>(0)
  const [productHover, setProductHover] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [textareaFocused, setTextareaFocused] = useState(false)
  const [deliveryCardHover, setDeliveryCardHover] = useState(false)
  const [productCardHover, setProductCardHover] = useState(false)
  const [submitHover, setSubmitHover] = useState(false)

  useEffect(() => {
    fetchFeedbackDetails()
  }, [customerId])

  const fetchFeedbackDetails = async () => {
    try {
      const response = await fetch(`/api/feedback/details?customerId=${customerId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load details')
      setCustomerName(data.customerName)
      setCourierName(data.courierName)
      setAlreadySubmitted(data.alreadySubmitted)
    } catch (err: any) {
      setError(err.message || 'Invalid feedback link')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (deliveryRating === 0 || productRating === 0) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          deliveryTimeRating: deliveryRating,
          productQualityRating: productRating,
          comment,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to submit feedback')
      setSuccess(true)
    } catch (err: any) {
      alert(language === 'he' ? 'אירעה שגיאה בעת שליחת המשוב. אנא נסה שוב.' : (err.message || 'An error occurred while submitting feedback'))
    } finally {
      setSubmitting(false)
    }
  }

  const isRtl = language === 'he'
  const t = translations[language]
  const isFormValid = deliveryRating > 0 && productRating > 0

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} style={pageStyle}>
        <Orbs />
        <LangBtn language={language} setLanguage={setLanguage} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, zIndex: 1 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            border: '3px solid rgba(6,182,212,0.2)',
            borderTopColor: '#06b6d4',
            animation: 'spin 0.9s linear infinite',
          }} />
          <p style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: 15 }}>{t.loading}</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} style={pageStyle}>
        <Orbs />
        <LangBtn language={language} setLanguage={setLanguage} />
        <div style={{ ...cardStyle, maxWidth: 420, textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="28" height="28" fill="none" stroke="#f87171" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 style={{ ...headingStyle, fontSize: 22, marginBottom: 8 }}>{t.invalidLink}</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 16 }}>{translateError(error, language)}</p>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            color: 'rgba(255,255,255,0.35)',
          }}>
            {t.copiedSms}
          </div>
        </div>
      </div>
    )
  }

  // ── Success / Already Submitted ──────────────────────────────────────────

  if (alreadySubmitted || success) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} style={pageStyle}>
        <Orbs />
        <LangBtn language={language} setLanguage={setLanguage} />
        <style>{`
          @keyframes popIn {
            0% { transform: scale(0.5); opacity: 0; }
            70% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={{ ...cardStyle, maxWidth: 420, textAlign: 'center' }}>
          {/* Animated checkmark circle */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.25))',
            border: '1px solid rgba(16,185,129,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <svg width="36" height="36" fill="none" stroke="#34d399" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 style={{ ...headingStyle, fontSize: 26, marginBottom: 10, animation: 'fadeUp 0.4s 0.2s both' }}>
            {success ? t.thankYou : t.alreadySubmitted}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, marginBottom: 8, animation: 'fadeUp 0.4s 0.3s both' }}>
            {success ? t.feedbackSaved : t.alreadySubmittedDesc}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24, animation: 'fadeUp 0.4s 0.4s both' }}>
            {t.appreciateInput}
          </p>
          {/* Decorative gradient bar */}
          <div style={{
            height: 3, width: 64,
            background: 'linear-gradient(90deg, #06b6d4, #6366f1)',
            borderRadius: 999,
            margin: '0 auto',
            animation: 'fadeUp 0.4s 0.5s both',
          }} />
        </div>
      </div>
    )
  }

  // ── Main Form ────────────────────────────────────────────────────────────

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} style={pageStyle}>
      <Orbs />
      <LangBtn language={language} setLanguage={setLanguage} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        textarea::placeholder { color: rgba(255,255,255,0.25); }
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      <div style={{ ...cardStyle, animation: 'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={badgeStyle}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {t.deliveryFeedback}
          </div>
          <h1 style={{ ...headingStyle, whiteSpace: 'pre-line' }}>{t.howDidWeDo}</h1>
          <p style={greetingStyle}>{t.greeting}</p>
        </div>

        <div style={dividerStyle} />

        <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Delivery Rating ── */}
          <div
            style={ratingCardStyle(deliveryRating > 0, deliveryCardHover)}
            onMouseEnter={() => setDeliveryCardHover(true)}
            onMouseLeave={() => setDeliveryCardHover(false)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <svg width="18" height="18" style={{ flexShrink: 0 }} fill="none" stroke="#67e8f9" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              <h3 style={ratingTitleStyle}>{t.deliveryTimeService}</h3>
            </div>
            <p style={ratingDescStyle}>{t.deliveryDesc}</p>
            <StarRow
              rating={deliveryRating}
              hoverRating={deliveryHover}
              setRating={setDeliveryRating}
              setHoverRating={setDeliveryHover}
            />
            {deliveryRating > 0 && (
              <span style={ratingLabelStyle}>{t.ratingLabels[deliveryRating - 1]}</span>
            )}
          </div>

          {/* ── Product Rating ── */}
          <div
            style={ratingCardStyle(productRating > 0, productCardHover)}
            onMouseEnter={() => setProductCardHover(true)}
            onMouseLeave={() => setProductCardHover(false)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <svg width="18" height="18" style={{ flexShrink: 0 }} fill="none" stroke="#a78bfa" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
              <h3 style={ratingTitleStyle}>{t.productQuality}</h3>
            </div>
            <p style={ratingDescStyle}>{t.productDesc}</p>
            <StarRow
              rating={productRating}
              hoverRating={productHover}
              setRating={setProductRating}
              setHoverRating={setProductHover}
            />
            {productRating > 0 && (
              <span style={ratingLabelStyle}>{t.ratingLabels[productRating - 1]}</span>
            )}
          </div>

          {/* ── Comments ── */}
          <div>
            <label htmlFor="comment" style={labelStyle}>{t.commentsLabel}</label>
            <textarea
              id="comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onFocus={() => setTextareaFocused(true)}
              onBlur={() => setTextareaFocused(false)}
              placeholder={t.commentsPlaceholder}
              style={{
                ...textareaStyle,
                borderColor: textareaFocused ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.1)',
                boxShadow: textareaFocused ? '0 0 0 3px rgba(6,182,212,0.12)' : 'none',
              }}
            />
          </div>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={!isFormValid || submitting}
            onMouseEnter={() => setSubmitHover(true)}
            onMouseLeave={() => setSubmitHover(false)}
            style={{
              ...submitBtnStyle(!isFormValid || submitting),
              transform: submitHover && isFormValid ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: submitHover && isFormValid
                ? '0 12px 40px rgba(6,182,212,0.45)'
                : (!isFormValid || submitting) ? 'none' : '0 8px 32px rgba(6,182,212,0.35)',
            }}
          >
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-block',
                  width: 16, height: 16,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
                {t.submitting}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                {t.submitFeedback}
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
