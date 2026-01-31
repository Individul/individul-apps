import { api } from "./client"

export type ClientStatus = "prospect" | "active" | "on_hold" | "completed" | "archived"

export type Client = {
  id: string
  name: string
  status: ClientStatus
  industry?: string | null
  website?: string | null
  location?: string | null
  owner?: string | null
  primaryContactName?: string | null
  primaryContactEmail?: string | null
  notes?: string | null
  segment?: string | null
  lastActivityLabel?: string | null
  createdAt?: string
  updatedAt?: string
  _count?: {
    projects: number
  }
}

export type CreateClientInput = {
  name: string
  status?: ClientStatus
  industry?: string
  website?: string
  location?: string
  owner?: string
  primaryContactName?: string
  primaryContactEmail?: string
  notes?: string
  segment?: string
}

export type UpdateClientInput = Partial<CreateClientInput> & {
  lastActivityLabel?: string
}

export async function fetchClients(params?: {
  status?: ClientStatus
  search?: string
}): Promise<Client[]> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set("status", params.status)
  if (params?.search) searchParams.set("search", params.search)

  const query = searchParams.toString()
  const endpoint = `/clients${query ? `?${query}` : ""}`

  return api.get<Client[]>(endpoint)
}

export async function fetchClient(id: string): Promise<Client> {
  return api.get<Client>(`/clients/${id}`)
}

export async function createClient(data: CreateClientInput): Promise<Client> {
  return api.post<Client>("/clients", data)
}

export async function updateClient(
  id: string,
  data: UpdateClientInput
): Promise<Client> {
  return api.put<Client>(`/clients/${id}`, data)
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/clients/${id}`)
}
