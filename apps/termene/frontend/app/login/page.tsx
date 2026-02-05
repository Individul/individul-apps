'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Scale } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { authApi, ApiError } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { access, refresh } = await authApi.login(username, password)
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
      toast.success('Autentificare reușită')
      router.push('/dashboard')
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare la autentificare')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] p-4">
      <div className="w-full max-w-sm">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white border border-gray-200 rounded-xl shadow-sm mb-4">
            <Scale className="h-6 w-6 text-slate-600" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
            Termene
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mt-1">
            Monitorizare Execuție Penitenciară
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Autentificare</h2>
            <p className="text-xs text-gray-500 mt-0.5">Introduceți credențialele pentru acces</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-[10px] font-bold uppercase tracking-widest text-gray-400"
              >
                Nume Utilizator
              </label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Introduceți numele de utilizator"
                required
                disabled={isLoading}
                className="rounded-md border-gray-200 h-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[10px] font-bold uppercase tracking-widest text-gray-400"
              >
                Parolă
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Introduceți parola"
                required
                disabled={isLoading}
                className="rounded-md border-gray-200 h-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-9 bg-[#1E293B] hover:bg-[#334155] text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Se autentifică...
                </span>
              ) : (
                'Autentificare'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Sistem de management al termenelor de executare
        </p>
      </div>
    </div>
  )
}
