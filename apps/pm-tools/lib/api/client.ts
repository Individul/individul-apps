const API_BASE = "/pm/api"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }))
    throw new ApiError(error.error || "Request failed", response.status)
  }

  return response.json()
}

// Convert Date objects to ISO strings for JSON serialization
function serializeData(data: unknown): string {
  return JSON.stringify(data, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString()
    }
    return value
  })
}

export const api = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: "GET" }),

  post: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, {
      method: "POST",
      body: serializeData(data),
    }),

  put: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, {
      method: "PUT",
      body: serializeData(data),
    }),

  delete: <T>(endpoint: string) =>
    apiFetch<T>(endpoint, { method: "DELETE" }),
}
