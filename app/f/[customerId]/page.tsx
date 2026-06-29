import { redirect } from 'next/navigation'

interface ShortRouteProps {
  params: Promise<{ customerId: string }>
}

export default async function ShortFeedbackRedirect({ params }: ShortRouteProps) {
  const resolvedParams = await params
  redirect(`/feedback/${resolvedParams.customerId}`)
}
