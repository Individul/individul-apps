"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Client,
  ClientStatus,
  CreateClientInput,
  UpdateClientInput,
  fetchClients,
  createClient as apiCreateClient,
  updateClient as apiUpdateClient,
  deleteClient as apiDeleteClient,
} from "@/lib/api/clients"

export type UseClientsOptions = {
  status?: ClientStatus
  search?: string
}

export function useClients(options?: UseClientsOptions) {
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadClients = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchClients(options)
      setClients(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch clients"))
    } finally {
      setIsLoading(false)
    }
  }, [options?.status, options?.search])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const createClient = useCallback(
    async (input: CreateClientInput) => {
      const newClient = await apiCreateClient(input)
      setClients((prev) => [...prev, newClient])
      return newClient
    },
    []
  )

  const updateClient = useCallback(
    async (id: string, input: UpdateClientInput) => {
      const updated = await apiUpdateClient(id, input)
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      )
      return updated
    },
    []
  )

  const deleteClient = useCallback(async (id: string) => {
    await apiDeleteClient(id)
    setClients((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const refresh = useCallback(() => {
    loadClients()
  }, [loadClients])

  return {
    clients,
    isLoading,
    error,
    createClient,
    updateClient,
    deleteClient,
    refresh,
  }
}
