import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-2xl space-y-6 sm:space-y-8 py-8 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
            Courier Call Masking System
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600">
            Secure call masking solution for couriers to contact customers without exposing phone numbers
          </p>
        </div>

        <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 sm:grid-cols-2">
          <div className="rounded-lg bg-white p-6 sm:p-8 shadow-md">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Courier</h2>
            <p className="mt-2 text-sm sm:text-base text-gray-600">
              Access your customer list and make masked calls
            </p>
            <div className="mt-6 space-y-3">
              <Link
                href="/login"
                className="block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-sm sm:text-base text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="block w-full rounded-md border border-blue-600 px-4 py-2 text-center text-sm sm:text-base text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Create Account
              </Link>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 sm:p-8 shadow-md">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Admin</h2>
            <p className="mt-2 text-sm sm:text-base text-gray-600">
              Manage customers and view call logs
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="block w-full rounded-md bg-gray-600 px-4 py-2 text-center text-sm sm:text-base text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Admin Sign In
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 sm:mt-12 rounded-lg bg-blue-50 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Features</h3>
          <ul className="mt-4 space-y-2 text-xs sm:text-sm text-gray-700">
            <li className="flex items-start">
              <span className="mr-2 text-blue-600">✓</span>
              <span>Secure phone number masking for couriers</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-blue-600">✓</span>
              <span>Role-based access control (Courier/Admin)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-blue-600">✓</span>
              <span>Customer management dashboard</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-blue-600">✓</span>
              <span>Call logging and tracking</span>
            </li>
          </ul>
        </div>

        <div className="mt-6 sm:mt-8 text-center">
          <Link
            href="/api-docs"
            className="inline-flex items-center rounded-md bg-gray-600 px-4 py-2 text-sm sm:text-base text-white hover:bg-gray-700"
          >
            View API Documentation
          </Link>
        </div>
      </div>
    </div>
  )
}
