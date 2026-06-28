'use client'

import { useEffect, useState, use } from 'react'

interface FeedbackPageProps {
  params: Promise<{ customerId: string }>
}

export default function FeedbackPage({ params }: FeedbackPageProps) {
  const resolvedParams = use(params)
  const customerId = resolvedParams.customerId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [courierName, setCourierName] = useState('')
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  
  // Form states
  const [deliveryRating, setDeliveryRating] = useState<number>(0)
  const [productRating, setProductRating] = useState<number>(0)
  const [deliveryHover, setDeliveryHover] = useState<number>(0)
  const [productHover, setProductHover] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchFeedbackDetails()
  }, [customerId])

  const fetchFeedbackDetails = async () => {
    try {
      const response = await fetch(`/api/feedback/details?customerId=${customerId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load details')
      }

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          deliveryTimeRating: deliveryRating,
          productQualityRating: productRating,
          comment,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback')
      }

      setSuccess(true)
    } catch (err: any) {
      alert(err.message || 'An error occurred while submitting feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
          <p className="text-gray-600 font-medium animate-pulse">Loading feedback form...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl border border-gray-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 mb-4">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="text-xs text-gray-400">
            Please make sure you copied the correct link from the SMS.
          </div>
        </div>
      </div>
    )
  }

  if (alreadySubmitted || success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl border border-gray-100 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-500 mb-6 scale-up-animation">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {success ? 'Thank You!' : 'Already Submitted'}
          </h2>
          <p className="text-gray-600 mb-2">
            {success 
              ? 'Your feedback was successfully saved.' 
              : 'You have already submitted feedback for this delivery.'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            We appreciate your input to help us improve our services.
          </p>
          <div className="h-1 w-20 bg-cyan-500 mx-auto rounded-full"></div>
        </div>
      </div>
    )
  }

  const renderStars = (
    rating: number,
    hoverRating: number,
    setRating: (r: number) => void,
    setHoverRating: (r: number) => void
  ) => {
    return (
      <div className="flex items-center gap-1.5 justify-center py-2">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoverRating || rating)
          return (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 focus:outline-none transition-transform duration-100 hover:scale-125"
            >
              <svg
                className={`h-9 w-9 cursor-pointer transition-colors duration-150 ${
                  isFilled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 fill-none'
                }`}
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
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

  const isFormValid = deliveryRating > 0 && productRating > 0

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 px-4 py-12 justify-center items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-xl border border-gray-100">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-block bg-cyan-50 px-4 py-1.5 rounded-full text-cyan-600 font-semibold text-xs tracking-wider uppercase mb-2">
            Delivery Feedback
          </div>
          <h2 className="text-2xl font-bold text-gray-900">How did we do?</h2>
          <p className="text-sm text-gray-600 mt-2">
            Hi <span className="font-semibold text-gray-800">{customerName}</span>, please tell us about your experience with <span className="font-semibold text-gray-800">{courierName}</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Delivery Time Rating */}
          <div className="rounded-xl bg-gray-50/50 p-4 border border-gray-100/80 text-center">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Delivery Time & Service</h3>
            <p className="text-xs text-gray-500 mb-2">How fast and convenient was the delivery process?</p>
            {renderStars(deliveryRating, deliveryHover, setDeliveryRating, setDeliveryHover)}
            {deliveryRating > 0 && (
              <span className="text-xs font-semibold text-cyan-600">
                {['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][deliveryRating - 1]}
              </span>
            )}
          </div>

          {/* Product Quality Rating */}
          <div className="rounded-xl bg-gray-50/50 p-4 border border-gray-100/80 text-center">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Quality of the Product</h3>
            <p className="text-xs text-gray-500 mb-2">How satisfied are you with the items delivered?</p>
            {renderStars(productRating, productHover, setProductRating, setProductHover)}
            {productRating > 0 && (
              <span className="text-xs font-semibold text-cyan-600">
                {['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][productRating - 1]}
              </span>
            )}
          </div>

          {/* Comments Text Area */}
          <div>
            <label htmlFor="comment" className="block text-sm font-semibold text-gray-800 mb-1">
              Do you have any comments? (Optional)
            </label>
            <textarea
              id="comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What could we improve, or what did you like?"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid || submitting}
            className="w-full rounded-xl bg-cyan-500 py-3.5 text-sm font-bold text-white shadow-md hover:bg-cyan-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center text-xs text-gray-400">
        Courier Call Masking System • Secure Feedback Loop
      </div>
    </div>
  )
}
