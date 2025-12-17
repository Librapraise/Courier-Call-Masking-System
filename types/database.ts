export type UserRole = 'admin' | 'courier'

export interface Profile {
  id: string
  email: string
  role: UserRole
  phone_number: string | null
  created_at: string
}

export interface Customer {
  id: string
  name: string
  phone_number: string
  is_active: boolean
  created_at: string
  created_by: string | null
}

export interface CustomerPublic {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface CallLog {
  id: string
  customer_id: string
  courier_id: string
  call_status: string
  created_at: string
}

