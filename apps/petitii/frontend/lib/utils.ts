import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function parseValidDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDate(date: string | Date | null | undefined): string {
  const parsed = parseValidDate(date)
  if (!parsed) return '-'

  return parsed.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const parsed = parseValidDate(date)
  if (!parsed) return '-'

  return parsed.toLocaleString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
