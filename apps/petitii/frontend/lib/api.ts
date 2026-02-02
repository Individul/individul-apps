const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

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

// Petitions
export const petitionsApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Petition>>(`/api/petitions/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: string) =>
    fetchApi<Petition>(`/api/petitions/${id}/`, { token }),

  create: (token: string, data: PetitionCreate) =>
    fetchApi<Petition>('/api/petitions/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (token: string, id: string, data: PetitionUpdate) =>
    fetchApi<Petition>(`/api/petitions/${id}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (token: string, id: string) =>
    fetchApi(`/api/petitions/${id}/`, {
      token,
      method: 'DELETE',
    }),

  stats: (token: string) =>
    fetchApi<PetitionStats>('/api/petitions/stats/', { token }),

  exportXlsx: (token: string, params?: URLSearchParams) =>
    `${API_URL}/api/petitions/export_xlsx/?${params?.toString() || ''}`,

  exportPdf: (token: string, params?: URLSearchParams) =>
    `${API_URL}/api/petitions/export_pdf/?${params?.toString() || ''}`,

  uploadAttachment: async (token: string, petitionId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_URL}/api/petitions/${petitionId}/upload_attachment/`, {
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
    fetchApi(`/api/petitions/${petitionId}/attachments/${attachmentId}/`, {
      token,
      method: 'DELETE',
    }),
}

// Notifications
export const notificationsApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<Notification>>(`/api/notifications/?${params?.toString() || ''}`, { token }),

  unreadCount: (token: string) =>
    fetchApi<{ count: number }>('/api/notifications/unread_count/', { token }),

  markRead: (token: string, id: string) =>
    fetchApi(`/api/notifications/${id}/mark_read/`, {
      token,
      method: 'POST',
    }),

  markAllRead: (token: string) =>
    fetchApi('/api/notifications/mark_all_read/', {
      token,
      method: 'POST',
    }),

  generate: (token: string) =>
    fetchApi('/api/notifications/generate/', {
      token,
      method: 'POST',
    }),
}

// Users (admin only)
export const usersApi = {
  list: (token: string, params?: URLSearchParams) =>
    fetchApi<PaginatedResponse<User>>(`/api/auth/users/?${params?.toString() || ''}`, { token }),

  get: (token: string, id: number) =>
    fetchApi<User>(`/api/auth/users/${id}/`, { token }),

  create: (token: string, data: UserCreate) =>
    fetchApi<User>('/api/auth/users/', {
      token,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (token: string, id: number, data: Partial<User>) =>
    fetchApi<User>(`/api/auth/users/${id}/`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggleActive: (token: string, id: number) =>
    fetchApi(`/api/auth/users/${id}/toggle_active/`, {
      token,
      method: 'POST',
    }),

  resetPassword: (token: string, id: number) =>
    fetchApi<{ temporary_password: string }>(`/api/auth/users/${id}/reset_password/`, {
      token,
      method: 'POST',
    }),
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
  object_type: string
  object_description?: string
  assigned_to?: number | null
}

export interface PetitionUpdate {
  petitioner_type?: string
  petitioner_name?: string
  detainee_fullname?: string
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

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export { ApiError }
