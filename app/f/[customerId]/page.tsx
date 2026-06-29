import { redirect, notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/server'

interface ShortRouteProps {
  params: Promise<{ customerId: string }>
}

export default async function ShortFeedbackRedirect({ params }: ShortRouteProps) {
  const resolvedParams = await params
  const identifier = resolvedParams.customerId

  // Validate if identifier is a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(identifier)) {
    redirect(`/feedback/${identifier}`)
  }

  // Otherwise, treat as short slug and look up customer in Supabase
  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('feedback_slug', identifier)
    .maybeSingle()

  if (error || !customer) {
    notFound()
  }

  redirect(`/feedback/${customer.id}`)
}
