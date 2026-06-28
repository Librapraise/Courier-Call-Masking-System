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
  is_completed: boolean
  created_at: string
  created_by: string | null
  assigned_courier_id: string | null
}

export interface CustomerPublic {
  id: string
  name: string
  is_active: boolean
  is_completed: boolean
  created_at: string
}

export interface Feedback {
  id: string
  customer_id: string
  courier_id: string | null
  delivery_time_rating: number
  product_quality_rating: number
  comment: string | null
  created_at: string
  customer_name?: string
  courier_email?: string
}

export interface CallLog {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_phone_masked: string | null
  courier_id: string
  agent_name: string | null
  call_status: string
  call_timestamp: string | null
  call_duration: number | null
  twilio_call_sid: string | null
  error_message: string | null
  created_at: string
  updated_at: string | null
}

export interface Setting {
  id: string
  key: string
  value: string
  description: string | null
  updated_at: string
  updated_by: string | null
}

export interface ArchivedCall {
  id: string
  original_call_log_id: string | null
  customer_id: string | null
  customer_name: string | null
  customer_phone_masked: string | null
  courier_id: string | null
  call_status: string
  call_timestamp: string | null
  call_duration: number | null
  twilio_call_sid: string | null
  agent_name: string | null
  error_message: string | null
  archived_at: string
  archive_date: string
}

