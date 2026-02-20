const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8004'

interface FetchOptions extends RequestInit {
  token?: string | null
  _retried?: boolean
}

class ApiError extends Error {
  constructor(public status: number, public data: any) {
    super(data.detail || data.message || 'A aparut o eroare')
    this.name = 'ApiError'
  }
}

let _isRefreshing = false
let _refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null
  if (!refreshToken) return null

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    })

    if (!response.ok) return null

    const data = await response.json()
    if (data.access) {
      localStorage.setItem('access_token', data.access)
      // Save rotated refresh token if provided
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh)
      }
      return data.access
    }
    return null
  } catch {
    return null
  }
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, _retried, ...fetchOptions } = options

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

  // Auto-refresh token on 401 and retry once
  if (response.status === 401 && token && !_retried && typeof window !== 'undefined') {
    // Deduplicate concurrent refresh calls
    if (!_isRefreshing) {
      _isRefreshing = true
      _refreshPromise = refreshAccessToken().finally(() => {
        _isRefreshing = false
        _refreshPromise = null
      })
    }

    const newToken = await (_refreshPromise || refreshAccessToken())

    if (newToken) {
      // Retry the request with the new token
      return fetchApi<T>(endpoint, { ...options, token: newToken, _retried: true })
    }

    // Refresh failed — clear tokens and redirect to login
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/hub/login'
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(response.status, data)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// =============================================================================
// Auth API
// =============================================================================

export const authApi = {
  login: (username: string, password: string) =>
    fetchApi<{ access: string; refresh: string }>('/api/v1/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  refresh: (refresh: string) =>
    fetchApi<{ access: string }>('/api/v1/auth/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    }),

  getProfile: (token: string) =>
    fetchApi<User>('/api/v1/auth/profile/', { token }),

  updateProfile: (token: string, data: Partial<User>) =>
    fetchApi<User>('/api/v1/auth/profile/', {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changePassword: (token: string, data: { old_password: string; new_password: string; new_password_confirm: string }) =>
    fetchApi('/api/v1/auth/change-password/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// =============================================================================
// Petitions API (from petitii)
// =============================================================================

export const petitionsApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Petition>>(`/api/v1/petitions/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<Petition>(`/api/v1/petitions/${id}/`, { token }),

  create: (token: string, data: PetitionCreate) =>
    fetchApi<Petition>('/api/v1/petitions/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: PetitionUpdate) =>
    fetchApi<Petition>(`/api/v1/petitions/${id}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/v1/petitions/${id}/`, {
      token,
      method: 'DELETE',
    }),

  stats: (token: string) =>
    fetchApi<PetitionStats>('/api/v1/petitions/stats/', { token }),

  exportXlsx: (token: string, params?: URLSearchParams) =>
    `${API_URL}/api/v1/petitions/export_xlsx/?${params?.toString() || ''}`,

  exportPdf: (token: string, params?: URLSearchParams) =>
    `${API_URL}/api/v1/petitions/export_pdf/?${params?.toString() || ''}`,

  uploadAttachment: async (token: string, petitionId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_URL}/api/v1/petitions/${petitionId}/upload_attachment/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new ApiError(response.status, data)
    }

    return response.json()
  },

  deleteAttachment: (token: string, petitionId: string, attachmentId: string) =>
    fetchApi(`/api/v1/petitions/${petitionId}/attachments/${attachmentId}/`, {
      token,
      method: 'DELETE',
    }),
}

// =============================================================================
// Notifications API (from petitii)
// =============================================================================

export const notificationsApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Notification>>(`/api/v1/notifications/?${params?.toString() || ''}`, { token }),

  unreadCount: (token: string) =>
    fetchApi<{ count: number }>('/api/v1/notifications/unread_count/', { token }),

  markRead: (token: string, id: string) =>
    fetchApi(`/api/v1/notifications/${id}/mark_read/`, {
      token,
      method: 'POST',
    }),

  markAllRead: (token: string) =>
    fetchApi('/api/v1/notifications/mark_all_read/', {
      token,
      method: 'POST',
    }),

  generate: (token: string) =>
    fetchApi('/api/v1/notifications/generate/', {
      token,
      method: 'POST',
    }),
}

// =============================================================================
// Users API (admin only, from petitii)
// =============================================================================

export const usersApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<User>>(`/api/v1/auth/users/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: number) =>
    fetchApi<User>(`/api/v1/auth/users/${id}/`, { token }),

  create: (token: string, data: UserCreate) =>
    fetchApi<User>('/api/v1/auth/users/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (token: string, id: number, data: Partial<User>) =>
    fetchApi<User>(`/api/v1/auth/users/${id}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggleActive: (token: string, id: number) =>
    fetchApi(`/api/v1/auth/users/${id}/toggle_active/`, {
      token,
      method: 'POST',
    }),

  resetPassword: (token: string, id: number) =>
    fetchApi<{ temporary_password: string }>(`/api/v1/auth/users/${id}/reset_password/`, {
      token,
      method: 'POST',
    }),
}

// =============================================================================
// Tasks API (from task-manager)
// =============================================================================

export const tasksApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<Task[]>(`/api/v1/tasks/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<TaskDetail>(`/api/v1/tasks/${id}/`, { token }),

  create: (token: string, data: TaskCreate) =>
    fetchApi<Task>('/api/v1/tasks/', { token, method: 'POST', body: JSON.stringify(data) }),

  update: (token: string, id: string, data: Partial<TaskCreate>) =>
    fetchApi<Task>(`/api/v1/tasks/${id}/`, { token, method: 'PATCH', body: JSON.stringify(data) }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/v1/tasks/${id}/`, { token, method: 'DELETE' }),

  comment: (token: string, id: string, comment: string) =>
    fetchApi(`/api/v1/tasks/${id}/comment/`, { token, method: 'POST', body: JSON.stringify({ comment }) }),

  users: (token: string) =>
    fetchApi<TaskUser[]>('/api/v1/tasks/users/', { token }),

  categories: (token: string) =>
    fetchApi<string[]>('/api/v1/tasks/categories/', { token }),

  tags: (token: string) =>
    fetchApi<string[]>('/api/v1/tasks/tags/', { token }),
}

// =============================================================================
// Persons API (from termene)
// =============================================================================

export const personsApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Person>>(`/api/v1/persons/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<PersonDetail>(`/api/v1/persons/${id}/`, { token }),

  create: (token: string, data: PersonCreate) =>
    fetchApi<PersonDetail>('/api/v1/persons/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: PersonUpdate) =>
    fetchApi<PersonDetail>(`/api/v1/persons/${id}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  release: (token: string, id: string, data: { release_date: string }) =>
    fetchApi<{ message: string; released_date: string; updated_sentences: number; person: PersonDetail }>(`/api/v1/persons/${id}/release/`, {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/v1/persons/${id}/`, {
      token,
      method: 'DELETE',
    }),

  stats: (token: string) =>
    fetchApi<DashboardStats>('/api/v1/persons/stats/', { token }),

  exportXlsx: async (token: string, params?: URLSearchParams) => {
    const response = await fetch(`${API_URL}/api/v1/persons/export_xlsx/?${params?.toString() || ''}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!response.ok) throw new Error('Export failed')
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'persoane_condamnate.xlsx'
    a.click()
    window.URL.revokeObjectURL(url)
  },

  exportPdf: async (token: string, params?: URLSearchParams) => {
    const response = await fetch(`${API_URL}/api/v1/persons/export_pdf/?${params?.toString() || ''}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!response.ok) throw new Error('Export failed')
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'persoane_condamnate.pdf'
    a.click()
    window.URL.revokeObjectURL(url)
  },
}

// =============================================================================
// Sentences API (from termene)
// =============================================================================

export const sentencesApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Sentence>>(`/api/v1/sentences/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<Sentence>(`/api/v1/sentences/${id}/`, { token }),

  create: (token: string, data: SentenceCreate) =>
    fetchApi<Sentence>('/api/v1/sentences/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: SentenceUpdate) =>
    fetchApi<Sentence>(`/api/v1/sentences/${id}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/v1/sentences/${id}/`, {
      token,
      method: 'DELETE',
    }),

  recalculate: (token: string, id: string) =>
    fetchApi<{ message: string; fractions: Fraction[] }>(`/api/v1/sentences/${id}/recalculate/`, {
      token,
      method: 'POST',
    }),

  updateFraction: (token: string, sentenceId: string, fractionId: string, data: FractionUpdate) =>
    fetchApi<Fraction>(`/api/v1/sentences/${sentenceId}/fractions/${fractionId}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addReduction: (token: string, sentenceId: string, data: SentenceReductionCreate) =>
    fetchApi<SentenceReduction>(`/api/v1/sentences/${sentenceId}/reductions/`, {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteReduction: (token: string, sentenceId: string, reductionId: string) =>
    fetchApi(`/api/v1/sentences/${sentenceId}/reductions/${reductionId}/`, {
      token,
      method: 'DELETE',
    }),
}

// =============================================================================
// Fractions API (from termene)
// =============================================================================

export const fractionsApi = {
  upcoming: (token: string) =>
    fetchApi<PaginatedResponse<FractionWithPerson>>('/api/v1/sentences/fractions/upcoming/', { token }),

  overdue: (token: string) =>
    fetchApi<PaginatedResponse<FractionWithPerson>>('/api/v1/sentences/fractions/overdue/', { token }),

  imminent: (token: string) =>
    fetchApi<PaginatedResponse<FractionWithPerson>>('/api/v1/sentences/fractions/imminent/', { token }),
}

// =============================================================================
// Alerts API (from termene)
// =============================================================================

export const alertsApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Alert>>(`/api/v1/alerts/?${params?.toString() || ''}`, { token }),

  unreadCount: (token: string) =>
    fetchApi<{ count: number }>('/api/v1/alerts/unread_count/', { token }),

  markRead: (token: string, id: string) =>
    fetchApi(`/api/v1/alerts/${id}/mark_read/`, {
      token,
      method: 'POST',
    }),

  markAllRead: (token: string) =>
    fetchApi('/api/v1/alerts/mark_all_read/', {
      token,
      method: 'POST',
    }),

  generate: (token: string) =>
    fetchApi<{ message: string; count: number }>('/api/v1/alerts/generate/', {
      token,
      method: 'POST',
    }),

  dashboard: (token: string) =>
    fetchApi<AlertDashboard>('/api/v1/alerts/dashboard/', { token }),
}

// =============================================================================
// Types - User & Auth (shared)
// =============================================================================

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

export interface UserCreate {
  username: string
  email: string
  password: string
  password_confirm: string
  first_name: string
  last_name: string
  role: string
  phone?: string
  department?: string
}

// =============================================================================
// Types - Petitions (from petitii)
// =============================================================================

export interface Petition {
  id: string
  registration_number: string
  registration_prefix: string
  registration_seq: number
  registration_year: number
  registration_date: string
  petitioner_type: string
  petitioner_type_display: string
  petitioner_name: string
  detainee_fullname: string
  detention_sector: number
  detention_sector_display: string
  object_type: string
  object_type_display: string
  object_description?: string
  status: string
  status_display: string
  assigned_to: number | null
  assigned_to_name: string | null
  response_due_date: string
  is_overdue: boolean
  is_due_soon: boolean
  days_until_due: number
  resolution_date: string | null
  resolution_text: string
  created_by: number
  created_by_name: string
  created_at: string
  updated_at?: string
  attachments?: Attachment[]
  attachments_count?: number
}

export interface PetitionCreate {
  registration_prefix?: string
  registration_date?: string
  petitioner_type: string
  petitioner_name: string
  detainee_fullname?: string
  detention_sector: number
  object_type: string
  object_description?: string
  assigned_to?: number | null
}

export interface PetitionUpdate {
  petitioner_type?: string
  petitioner_name?: string
  detainee_fullname?: string
  detention_sector?: number
  object_type?: string
  object_description?: string
  status?: string
  assigned_to?: number | null
  resolution_date?: string | null
  resolution_text?: string
}

export interface Attachment {
  id: string
  file: string
  file_url: string
  original_filename: string
  size_bytes: number
  content_type: string
  uploaded_by: number
  uploaded_by_name: string
  uploaded_at: string
}

export interface PetitionStats {
  total: number
  by_status: Record<string, number>
  due_soon: number
  overdue: number
  by_object_type: Record<string, number>
  by_petitioner_type: Record<string, number>
  by_detention_sector: Record<string, number>
}

export interface Notification {
  id: string
  user: number
  type: string
  type_display: string
  petition: string
  petition_number: string
  message: string
  due_date: string | null
  is_read: boolean
  created_at: string
}

// =============================================================================
// Types - Tasks (from task-manager)
// =============================================================================

export interface Task {
  id: string
  title: string
  description: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  category: string
  tags: string[]
  deadline: string | null
  assignee: number | null
  assignee_details: TaskUser | null
  created_at: string
  updated_at: string
}

export interface TaskDetail extends Task {
  activities: TaskActivity[]
}

export interface TaskCreate {
  title: string
  description?: string
  status?: string
  priority?: string
  category?: string
  tags?: string[]
  deadline?: string | null
  assignee?: number | null
}

export interface TaskUser {
  id: number
  username: string
  first_name: string
  last_name: string
  full_name: string
}

export interface TaskActivity {
  id: string
  action: string
  action_display: string
  user: number | null
  user_details: TaskUser | null
  details: Record<string, any>
  created_at: string
}

export interface TaskFilters {
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  category?: string
  assignee?: number
  tags?: string
  deadline_from?: string
  deadline_to?: string
  ordering?: string
  search?: string
}

// =============================================================================
// Types - Persons (from termene)
// =============================================================================

export interface Person {
  id: string
  first_name: string
  last_name: string
  full_name: string
  cnp: string
  date_of_birth: string
  admission_date: string
  release_date: string | null
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
  release_date?: string | null
  notes?: string
  mai_notification?: boolean
}

export interface DashboardStats {
  total_persons: number
  persons_with_active_sentences: number
  released_persons: number
  overdue_fractions: number
  imminent_fractions: number
  upcoming_fractions: number
}

// =============================================================================
// Types - Sentences & Fractions (from termene)
// =============================================================================

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

// =============================================================================
// Types - Alerts (from termene)
// =============================================================================

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

// =============================================================================
// Shared Types
// =============================================================================

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// =============================================================================
// Constants (from termene)
// =============================================================================

export const CRIME_TYPES = [
  { value: 'furt', label: 'Furt' },
  { value: 'furt_calificat', label: 'Furt calificat' },
  { value: 'talharie', label: 'Talharie' },
  { value: 'omor', label: 'Omor' },
  { value: 'omor_calificat', label: 'Omor calificat' },
  { value: 'viol', label: 'Viol' },
  { value: 'trafic_persoane', label: 'Trafic de persoane' },
  { value: 'trafic_droguri', label: 'Trafic de droguri' },
  { value: 'terorism', label: 'Terorism' },
  { value: 'coruptie', label: 'Coruptie' },
  { value: 'evaziune', label: 'Evaziune fiscala' },
  { value: 'inselaciune', label: 'Inselaciune' },
  { value: 'distrugere', label: 'Distrugere' },
  { value: 'ultraj', label: 'Ultraj' },
  { value: 'lovire', label: 'Lovire sau alte violente' },
  { value: 'vatamare', label: 'Vatamare corporala' },
  { value: 'altul', label: 'Altul' },
]

export const SENTENCE_STATUSES = [
  { value: 'active', label: 'Activa' },
  { value: 'suspended', label: 'Suspendata' },
  { value: 'completed', label: 'Finalizata' },
  { value: 'conditionally_released', label: 'Liberare conditionata' },
]

// =============================================================================
// Transfers API (transferuri)
// =============================================================================

export const transfersApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<TransferListItem>>(`/api/v1/transfers/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<TransferDetail>(`/api/v1/transfers/${id}/`, { token }),

  create: (token: string, data: TransferCreate) =>
    fetchApi<TransferDetail>('/api/v1/transfers/', {
      token, method: 'POST', body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: TransferUpdate) =>
    fetchApi<TransferDetail>(`/api/v1/transfers/${id}/`, {
      token, method: 'PATCH', body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/v1/transfers/${id}/`, { token, method: 'DELETE' }),

  stats: (token: string) =>
    fetchApi<TransferStats>('/api/v1/transfers/stats/', { token }),

  monthlyReport: (token: string, year: number, month: number) =>
    fetchApi<MonthlyReportResponse>(
      `/api/v1/transfers/monthly_report/?year=${year}&month=${month}`, { token }
    ),

  quarterlyReport: (token: string, year: number, quarter: number) =>
    fetchApi<QuarterlyReportResponse>(
      `/api/v1/transfers/quarterly_report/?year=${year}&quarter=${quarter}`, { token }
    ),

  penitentiaries: (token: string) =>
    fetchApi<PenitentiaryOption[]>('/api/v1/transfers/penitentiaries/', { token }),

  exportXlsx: (params?: URLSearchParams) =>
    `${API_URL}/api/v1/transfers/export_xlsx/?${params?.toString() || ''}`,

  exportPdf: (params?: URLSearchParams) =>
    `${API_URL}/api/v1/transfers/export_pdf/?${params?.toString() || ''}`,
}

// =============================================================================
// Types - Transfers (transferuri)
// =============================================================================

export interface PenitentiaryOption {
  value: number
  label: string
  is_isolator: boolean
}

export interface TransferEntry {
  id: string
  penitentiary: number
  penitentiary_display: string
  is_isolator: boolean
  veniti: number
  veniti_reintorsi: number
  veniti_noi: number
  plecati: number
  plecati_izolator: number
  notes?: string
}

export interface TransferListItem {
  id: string
  transfer_date: string
  year: number
  month: number
  quarter: number
  description: string
  total_veniti: number
  total_plecati: number
  entries_count: number
  created_by: number
  created_by_name: string
  created_at: string
}

export interface TransferDetail {
  id: string
  transfer_date: string
  year: number
  month: number
  quarter: number
  description: string
  entries: TransferEntry[]
  created_by: number
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface TransferEntryInput {
  penitentiary: number
  veniti: number
  veniti_reintorsi: number
  veniti_noi: number
  plecati: number
  plecati_izolator: number
  notes?: string
}

export interface TransferCreate {
  transfer_date: string
  description?: string
  entries: TransferEntryInput[]
}

export interface TransferUpdate {
  transfer_date?: string
  description?: string
  entries?: TransferEntryInput[]
}

export interface TransferStats {
  current_month_veniti: number
  current_month_plecati: number
  current_month_net: number
  previous_month_veniti: number
  previous_month_plecati: number
  total_transfers: number
}

export interface MonthlyReportEntry {
  penitentiary: number
  penitentiary_display: string
  is_isolator: boolean
  veniti: number
  veniti_reintorsi: number
  veniti_noi: number
  plecati: number
  plecati_izolator: number
}

export interface MonthlyReportResponse {
  year: number
  month: number
  entries: MonthlyReportEntry[]
  totals: {
    total_veniti: number
    total_veniti_reintorsi: number
    total_veniti_noi: number
    total_plecati: number
    total_plecati_izolator: number
  }
  transfers: TransferListItem[]
}

export interface QuarterlyReportEntry {
  penitentiary: number
  penitentiary_display: string
  is_isolator: boolean
  total_veniti: number
  total_veniti_reintorsi: number
  total_veniti_noi: number
  total_plecati: number
  total_plecati_izolator: number
}

export interface QuarterlyReportResponse {
  year: number
  quarter: number
  entries: QuarterlyReportEntry[]
  totals: {
    total_veniti: number
    total_veniti_reintorsi: number
    total_veniti_noi: number
    total_plecati: number
    total_plecati_izolator: number
  }
}

// =============================================================================
// Constants - Transfers
// =============================================================================

export const MONTH_NAMES_RO = [
  '', 'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
]

export const QUARTERS = [
  { value: 1, label: 'Trimestrul I (Ian-Mar)' },
  { value: 2, label: 'Trimestrul II (Apr-Iun)' },
  { value: 3, label: 'Trimestrul III (Iul-Sep)' },
  { value: 4, label: 'Trimestrul IV (Oct-Dec)' },
]

// =============================================================================
// Commissions API (comisia penitenciara)
// =============================================================================

export const commissionsApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<CommissionSessionListItem>>(`/api/v1/commissions/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<CommissionSessionDetail>(`/api/v1/commissions/${id}/`, { token }),

  create: (token: string, data: CommissionSessionCreate) =>
    fetchApi<CommissionSessionDetail>('/api/v1/commissions/', {
      token, method: 'POST', body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: CommissionSessionUpdate) =>
    fetchApi<CommissionSessionDetail>(`/api/v1/commissions/${id}/`, {
      token, method: 'PATCH', body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/v1/commissions/${id}/`, { token, method: 'DELETE' }),

  stats: (token: string) =>
    fetchApi<CommissionStats>('/api/v1/commissions/stats/', { token }),

  monthlyReport: (token: string, year: number, month: number) =>
    fetchApi<CommissionMonthlyReport>(
      `/api/v1/commissions/monthly_report/?year=${year}&month=${month}`, { token }
    ),

  quarterlyReport: (token: string, year: number, quarter: number) =>
    fetchApi<CommissionQuarterlyReport>(
      `/api/v1/commissions/quarterly_report/?year=${year}&quarter=${quarter}`, { token }
    ),

  personsSearch: (token: string, search: string) =>
    fetchApi<CommissionPersonSearchResult[]>(
      `/api/v1/commissions/persons_search/?search=${encodeURIComponent(search)}`, { token }
    ),

  articles: (token: string) =>
    fetchApi<ArticleOption[]>('/api/v1/commissions/articles/', { token }),

  exportXlsx: (params?: URLSearchParams) =>
    `${API_URL}/api/v1/commissions/export_xlsx/?${params?.toString() || ''}`,

  exportPdf: (params?: URLSearchParams) =>
    `${API_URL}/api/v1/commissions/export_pdf/?${params?.toString() || ''}`,
}

// =============================================================================
// Types - Commissions (comisia penitenciara)
// =============================================================================

export interface CommissionArticleResult {
  id: string
  article: string
  article_display: string
  program_result: string
  program_result_display: string
  behavior_result: string
  behavior_result_display: string
  decision: string
  decision_display: string
  notes: string
}

export interface CommissionEvaluation {
  id: string
  person: string
  person_name: string
  person_cnp: string
  notes: string
  articles_count: number
  article_results: CommissionArticleResult[]
}

export interface CommissionSessionListItem {
  id: string
  session_date: string
  year: number
  month: number
  quarter: number
  session_number: string
  description: string
  evaluations_count: number
  total_articles: number
  art91_count: number
  art91_admis: number
  art91_respins: number
  art92_count: number
  art92_admis: number
  art92_respins: number
  realizat_count: number
  pozitiv_count: number
  admis_count: number
  created_by: number
  created_by_name: string
  created_at: string
}

export interface CommissionSessionDetail {
  id: string
  session_date: string
  year: number
  month: number
  quarter: number
  session_number: string
  description: string
  evaluations: CommissionEvaluation[]
  created_by: number
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface ArticleResultInput {
  article: string
  program_result: string
  behavior_result: string
  decision: string
  notes?: string
}

export interface EvaluationInput {
  person: string
  notes?: string
  article_results: ArticleResultInput[]
}

export interface CommissionSessionCreate {
  session_date: string
  session_number?: string
  description?: string
  evaluations: EvaluationInput[]
}

export interface CommissionSessionUpdate {
  session_date?: string
  session_number?: string
  description?: string
  evaluations?: EvaluationInput[]
}

export interface CommissionStats {
  total_sessions: number
  total_examinations: number
  art91_total: number
  art91_admis: number
  art91_respins: number
  art92_total: number
  art92_admis: number
  art92_respins: number
}

export interface CommissionMonthlyArticle {
  article: string
  article_display: string
  total: number
  realizat: number
  nerealizat: number
  nerealizat_independent: number
  pozitiv: number
  negativ: number
  admis: number
  respins: number
}

export interface CommissionMonthlyReport {
  year: number
  month: number
  articles: CommissionMonthlyArticle[]
  totals: {
    total: number
    realizat: number
    nerealizat: number
    nerealizat_independent: number
    pozitiv: number
    negativ: number
    admis: number
    respins: number
  }
  sessions: CommissionSessionListItem[]
}

export interface CommissionQuarterlyReport {
  year: number
  quarter: number
  articles: CommissionMonthlyArticle[]
  totals: {
    total: number
    realizat: number
    nerealizat: number
    nerealizat_independent: number
    pozitiv: number
    negativ: number
    admis: number
    respins: number
  }
}

export interface CommissionPersonSearchResult {
  id: string
  full_name: string
  cnp: string
}

export interface ArticleOption {
  value: string
  label: string
}

// =============================================================================
// Constants - Commissions
// =============================================================================

export const COMMISSION_ARTICLES = [
  { value: 'art_91', label: 'Art. 91' },
  { value: 'art_92', label: 'Art. 92' },
  { value: 'art_107', label: 'Art. 107' },
  { value: 'gratiere', label: 'Grațiere' },
]

export const PROGRAM_RESULTS = [
  { value: 'realizat', label: 'Realizat' },
  { value: 'nerealizat', label: 'Nerealizat' },
  { value: 'nerealizat_independent', label: 'Nerealizat (ind.)' },
]

export const BEHAVIOR_RESULTS = [
  { value: 'pozitiv', label: 'Pozitiv' },
  { value: 'negativ', label: 'Negativ' },
]

export const DECISION_OPTIONS = [
  { value: 'admis', label: 'De admis' },
  { value: 'respins', label: 'De respins' },
]

// =============================================================================
// Tracker SIA API
// =============================================================================

export const trackerApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<TrackerIssue>>(`/api/v1/tracker/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<TrackerIssueDetail>(`/api/v1/tracker/${id}/`, { token }),

  create: (token: string, data: TrackerIssueCreate) =>
    fetchApi<TrackerIssueDetail>('/api/v1/tracker/', {
      token, method: 'POST', body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: TrackerIssueUpdate) =>
    fetchApi<TrackerIssueDetail>(`/api/v1/tracker/${id}/`, {
      token, method: 'PATCH', body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/v1/tracker/${id}/`, { token, method: 'DELETE' }),

  stats: (token: string) =>
    fetchApi<TrackerStats>('/api/v1/tracker/stats/', { token }),

  exportXlsx: (params?: URLSearchParams) =>
    `${API_URL}/api/v1/tracker/export_xlsx/?${params?.toString() || ''}`,
}

// =============================================================================
// Types - Tracker SIA
// =============================================================================

export interface TrackerIssue {
  id: string
  title: string
  category: 'BUG_CRITIC' | 'BUG_MINOR' | 'PROPUNERE' | 'CERINTA_NOUA'
  category_display: string
  priority: 'CRITIC' | 'INALT' | 'MEDIU' | 'SCAZUT'
  priority_display: string
  status: 'NOU' | 'IN_LUCRU' | 'TESTAT' | 'IMPLEMENTAT' | 'RESPINS'
  status_display: string
  module_name: string
  created_by: number | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface TrackerIssueDetail extends TrackerIssue {
  description: string
  steps_to_reproduce: string
  expected_behavior: string
  actual_behavior: string
  resolution_notes: string
}

export interface TrackerIssueCreate {
  title: string
  description?: string
  category: string
  priority?: string
  module_name?: string
  steps_to_reproduce?: string
  expected_behavior?: string
  actual_behavior?: string
}

export interface TrackerIssueUpdate {
  title?: string
  description?: string
  category?: string
  priority?: string
  status?: string
  module_name?: string
  steps_to_reproduce?: string
  expected_behavior?: string
  actual_behavior?: string
  resolution_notes?: string
}

export interface TrackerStats {
  total: number
  by_status: Record<string, number>
  by_category: Record<string, number>
  by_priority: Record<string, number>
  recent_count: number
  resolved_count: number
}

// =============================================================================
// Constants - Tracker SIA
// =============================================================================

export const TRACKER_CATEGORIES = [
  { value: 'BUG_CRITIC', label: 'Bug critic' },
  { value: 'BUG_MINOR', label: 'Bug minor' },
  { value: 'PROPUNERE', label: 'Propunere de îmbunătățire' },
  { value: 'CERINTA_NOUA', label: 'Cerință nouă' },
]

export const TRACKER_PRIORITIES = [
  { value: 'CRITIC', label: 'Critic' },
  { value: 'INALT', label: 'Înalt' },
  { value: 'MEDIU', label: 'Mediu' },
  { value: 'SCAZUT', label: 'Scăzut' },
]

export const TRACKER_STATUSES = [
  { value: 'NOU', label: 'Nou' },
  { value: 'IN_LUCRU', label: 'În lucru' },
  { value: 'TESTAT', label: 'Testat' },
  { value: 'IMPLEMENTAT', label: 'Implementat' },
  { value: 'RESPINS', label: 'Respins' },
]

export { ApiError }
