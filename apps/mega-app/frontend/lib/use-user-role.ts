'use client'

import { useMemo } from 'react'

export type UserRole = 'viewer' | 'operator' | 'admin'

export function useUserRole(): { role: UserRole | null; isViewer: boolean; isAdmin: boolean; canEdit: boolean } {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { role: null, isViewer: false, isAdmin: false, canEdit: true }
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
      return { role: null, isViewer: false, isAdmin: false, canEdit: true }
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const role = payload.role as UserRole
      return {
        role,
        isViewer: role === 'viewer',
        isAdmin: role === 'admin',
        canEdit: role !== 'viewer',
      }
    } catch {
      return { role: null, isViewer: false, isAdmin: false, canEdit: true }
    }
  }, [])
}
