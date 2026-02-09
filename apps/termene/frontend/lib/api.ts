const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8003'

interface FetchOptions extends RequestInit {
  token?: string | null
}

class ApiError extends Error {
  constructor(public status: number, public data: any) {
    super(data.detail || data.message || 'A apărut o eroare')
    this.name = 'ApiError'
  }
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(response.status, data)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    fetchApi<{ access: string; refresh: string }>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  refresh: (refresh: string) =>
    fetchApi<{ access: string }>('/api/auth/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    }),

  getProfile: (token: string) =>
    fetchApi<User>('/api/auth/profile/', { token }),

  updateProfile: (token: string, data: Partial<User>) =>
    fetchApi<User>('/api/auth/profile/', {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changePassword: (token: string, data: { old_password: string; new_password: string; new_password_confirm: string }) =>
    fetchApi('/api/auth/change-password/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Persons
export const personsApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Person>>(`/api/persons/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<PersonDetail>(`/api/persons/${id}/`, { token }),

  create: (token: string, data: PersonCreate) =>
    fetchApi<PersonDetail>('/api/persons/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: PersonUpdate) =>
    fetchApi<PersonDetail>(`/api/persons/${id}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/persons/${id}/`, {
      token,
      method: 'DELETE',
    }),

  stats: (token: string) =>
    fetchApi<DashboardStats>('/api/persons/stats/', { token }),

  exportXlsx: (token: string, params?: URLSearchParams) =>
    `${API_URL}/api/persons/export_xlsx/?${params?.toString() || ''}`,

  exportPdf: (token: string, params?: URLSearchParams) =>
    `${API_URL}/api/persons/export_pdf/?${params?.toString() || ''}`,
}

// Sentences
export const sentencesApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Sentence>>(`/api/sentences/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<Sentence>(`/api/sentences/${id}/`, { token }),

  create: (token: string, data: SentenceCreate) =>
    fetchApi<Sentence>('/api/sentences/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: SentenceUpdate) =>
    fetchApi<Sentence>(`/api/sentences/${id}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/sentences/${id}/`, {
      token,
      method: 'DELETE',
    }),

  recalculate: (token: string, id: string) =>
    fetchApi<{ message: string; fractions: Fraction[] }>(`/api/sentences/${id}/recalculate/`, {
      token,
      method: 'POST',
    }),

  updateFraction: (token: string, sentenceId: string, fractionId: string, data: FractionUpdate) =>
    fetchApi<Fraction>(`/api/sentences/${sentenceId}/fractions/${fractionId}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addReduction: (token: string, sentenceId: string, data: SentenceReductionCreate) =>
    fetchApi<SentenceReduction>(`/api/sentences/${sentenceId}/reductions/`, {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteReduction: (token: string, sentenceId: string, reductionId: string) =>
    fetchApi(`/api/sentences/${sentenceId}/reductions/${reductionId}/`, {
      token,
      method: 'DELETE',
    }),
}

// Fractions
export const fractionsApi = {
  upcoming: (token: string) =>
    fetchApi<PaginatedResponse<FractionWithPerson>>('/api/sentences/fractions/upcoming/', { token }),

  overdue: (token: string) =>
    fetchApi<PaginatedResponse<FractionWithPerson>>('/api/sentences/fractions/overdue/', { token }),

  imminent: (token: string) =>
    fetchApi<PaginatedResponse<FractionWithPerson>>('/api/sentences/fractions/imminent/', { token }),
}

// Alerts
export const alertsApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Alert>>(`/api/alerts/?${params?.toString() || ''}`, { token }),

  unreadCount: (token: string) =>
    fetchApi<{ count: number }>('/api/alerts/unread_count/', { token }),

  markRead: (token: string, id: string) =>
    fetchApi(`/api/alerts/${id}/mark_read/`, {
      token,
      method: 'POST',
    }),

  markAllRead: (token: string) =>
    fetchApi('/api/alerts/mark_all_read/', {
      token,
      method: 'POST',
    }),

  generate: (token: string) =>
    fetchApi<{ message: string; count: number }>('/api/alerts/generate/', {
      token,
      method: 'POST',
    }),

  dashboard: (token: string) =>
    fetchApi<AlertDashboard>('/api/alerts/dashboard/', { token }),
}

// Types
export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: 'viewer' | 'operator' | 'admin'
  role_display?: string
  phone: string
  department: string
  is_active: boolean
  date_joined: string
  last_login: string | null
}

export interface Person {
  id: string
  first_name: string
  last_name: string
  full_name: string
  cnp: string
  date_of_birth: string
  admission_date: string
  mai_notification: boolean
  active_sentences_count: number
  nearest_fraction_date: string | null
  nearest_fraction_type: string | null
  created_by: number
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface PersonDetail extends Person {
  notes: string
  sentences: Sentence[]
}

export interface PersonCreate {
  first_name: string
  last_name: string
  start_date: string
  sentence_years: number
  sentence_months: number
  sentence_days: number
}

export interface PersonUpdate {
  first_name?: string
  last_name?: string
  cnp?: string
  date_of_birth?: string
  admission_date?: string
  notes?: string
  mai_notification?: boolean
}

export interface Fraction {
  id: string
  sentence: string
  fraction_type: '1/3' | '1/2' | '2/3'
  fraction_type_display: string
  calculated_date: string
  is_fulfilled: boolean
  fulfilled_date: string | null
  description: string
  notes: string
  days_until: number
  alert_status: 'fulfilled' | 'overdue' | 'imminent' | 'upcoming' | 'distant'
  created_at: string
  updated_at: string
}

export interface FractionWithPerson extends Fraction {
  person_id: string
  person_name: string
  crime_type: string
  crime_type_display: string
}

export interface FractionUpdate {
  is_fulfilled?: boolean
  fulfilled_date?: string | null
  notes?: string
}

export interface SentenceReduction {
  id: string
  legal_article: string
  reduction_years: number
  reduction_months: number
  reduction_days: number
  reduction_display: string
  applied_date: string
  created_by: number | null
  created_by_name: string | null
  created_at: string
}

export interface SentenceReductionCreate {
  legal_article: string
  reduction_years: number
  reduction_months: number
  reduction_days: number
  applied_date: string
}

export interface Sentence {
  id: string
  person: string
  person_name?: string
  crime_type: string
  crime_type_display: string
  crime_description: string
  sentence_years: number
  sentence_months: number
  sentence_days: number
  duration_display: string
  start_date: string
  end_date: string
  total_days: number
  total_reduction_days: number
  effective_years: number
  effective_months: number
  effective_days: number
  effective_end_date: string
  effective_duration_display: string
  status: 'active' | 'suspended' | 'completed' | 'conditionally_released'
  status_display: string
  is_serious_crime: boolean
  notes: string
  fractions: Fraction[]
  reductions: SentenceReduction[]
  created_by: number
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface SentenceCreate {
  person: string
  crime_type: string
  crime_description?: string
  sentence_years: number
  sentence_months: number
  sentence_days: number
  start_date: string
  status?: string
  notes?: string
}

export interface SentenceUpdate {
  crime_type?: string
  crime_description?: string
  sentence_years?: number
  sentence_months?: number
  sentence_days?: number
  start_date?: string
  status?: string
  notes?: string
}

export interface Alert {
  id: string
  user: number
  alert_type: 'imminent' | 'upcoming' | 'overdue' | 'fulfilled'
  alert_type_display: string
  priority: 'high' | 'medium' | 'low'
  priority_display: string
  fraction: string
  fraction_type: string
  person: string
  person_name: string
  message: string
  target_date: string
  is_read: boolean
  created_at: string
}

export interface AlertDashboard {
  overdue: number
  imminent: number
  upcoming: number
  fulfilled: number
  total: number
}

export interface DashboardStats {
  total_persons: number
  persons_with_active_sentences: number
  overdue_fractions: number
  imminent_fractions: number
  upcoming_fractions: number
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const CRIME_TYPES = [
  { value: 'furt', label: 'Furt' },
  { value: 'furt_calificat', label: 'Furt calificat' },
  { value: 'talharie', label: 'Tâlhărie' },
  { value: 'omor', label: 'Omor' },
  { value: 'omor_calificat', label: 'Omor calificat' },
  { value: 'viol', label: 'Viol' },
  { value: 'trafic_persoane', label: 'Trafic de persoane' },
  { value: 'trafic_droguri', label: 'Trafic de droguri' },
  { value: 'terorism', label: 'Terorism' },
  { value: 'coruptie', label: 'Corupție' },
  { value: 'evaziune', label: 'Evaziune fiscală' },
  { value: 'inselaciune', label: 'Înșelăciune' },
  { value: 'distrugere', label: 'Distrugere' },
  { value: 'ultraj', label: 'Ultraj' },
  { value: 'lovire', label: 'Lovire sau alte violențe' },
  { value: 'vatamare', label: 'Vătămare corporală' },
  { value: 'altul', label: 'Altul' },
]

export const SENTENCE_STATUSES = [
  { value: 'active', label: 'Activă' },
  { value: 'suspended', label: 'Suspendată' },
  { value: 'completed', label: 'Finalizată' },
  { value: 'conditionally_released', label: 'Liberare condiționată' },
]

export { ApiError }
