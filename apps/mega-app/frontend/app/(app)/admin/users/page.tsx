'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, UserCog, RotateCcw, Shield, Power } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { usersApi, User, UserCreate, PaginatedResponse } from '@/lib/api'

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  operator: 'Operator',
  viewer: 'Viewer',
}

const roleBadgeClasses: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 border-transparent',
  operator: 'bg-blue-100 text-blue-800 border-transparent',
  viewer: 'bg-gray-100 text-gray-600 border-transparent',
}

const emptyForm: UserCreate = {
  username: '',
  email: '',
  password: '',
  password_confirm: '',
  first_name: '',
  last_name: '',
  role: 'viewer',
  phone: '',
  department: '',
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [data, setData] = useState<PaginatedResponse<User> | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<UserCreate>({ ...emptyForm })
  const [roleEditUser, setRoleEditUser] = useState<User | null>(null)
  const [roleEditValue, setRoleEditValue] = useState('')
  const [tempPasswordDialog, setTempPasswordDialog] = useState<{ open: boolean; password: string; username: string }>({
    open: false,
    password: '',
    username: '',
  })

  const getToken = () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return null
    }
    return token
  }

  const fetchUsers = () => {
    const token = getToken()
    if (!token) return

    setLoading(true)
    usersApi
      .list(token)
      .then(setData)
      .catch(() => {
        toast.error('Eroare la incarcarea utilizatorilor')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async () => {
    const token = getToken()
    if (!token) return

    if (!form.username || !form.email || !form.password || !form.password_confirm) {
      toast.error('Completati campurile obligatorii')
      return
    }

    if (form.password !== form.password_confirm) {
      toast.error('Parolele nu coincid')
      return
    }

    setCreating(true)
    try {
      await usersApi.create(token, form)
      toast.success('Utilizator creat cu succes')
      setCreateOpen(false)
      setForm({ ...emptyForm })
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'Eroare la crearea utilizatorului')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    const token = getToken()
    if (!token) return

    try {
      await usersApi.toggleActive(token, user.id)
      toast.success(
        user.is_active
          ? `Utilizatorul ${user.username} a fost dezactivat`
          : `Utilizatorul ${user.username} a fost activat`
      )
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'Eroare la schimbarea statusului')
    }
  }

  const handleResetPassword = async (user: User) => {
    const token = getToken()
    if (!token) return

    try {
      const result = await usersApi.resetPassword(token, user.id)
      setTempPasswordDialog({
        open: true,
        password: result.temporary_password,
        username: user.username,
      })
    } catch (err: any) {
      toast.error(err.message || 'Eroare la resetarea parolei')
    }
  }

  const handleRoleChange = async () => {
    if (!roleEditUser || !roleEditValue) return
    const token = getToken()
    if (!token) return

    try {
      await usersApi.update(token, roleEditUser.id, { role: roleEditValue as User['role'] })
      toast.success(`Rolul utilizatorului ${roleEditUser.username} a fost schimbat`)
      setRoleEditUser(null)
      setRoleEditValue('')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message || 'Eroare la schimbarea rolului')
    }
  }

  const updateField = (field: keyof UserCreate, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
          Administrare utilizatori
        </h1>
        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setForm({ ...emptyForm })
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adauga utilizator
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Utilizator nou</DialogTitle>
              <DialogDescription>
                Completati datele pentru a crea un utilizator nou.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prenume</Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(e) => updateField('first_name', e.target.value)}
                    placeholder="Prenume"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nume</Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(e) => updateField('last_name', e.target.value)}
                    placeholder="Nume"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => updateField('username', e.target.value)}
                  placeholder="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="email@exemplu.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Parola *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Parola"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password_confirm">Confirma parola *</Label>
                  <Input
                    id="password_confirm"
                    type="password"
                    value={form.password_confirm}
                    onChange={(e) => updateField('password_confirm', e.target.value)}
                    placeholder="Confirma parola"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={form.role} onValueChange={(val) => updateField('role', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteaza rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={form.phone || ''}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="Telefon"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Departament</Label>
                  <Input
                    id="department"
                    value={form.department || ''}
                    onChange={(e) => updateField('department', e.target.value)}
                    placeholder="Departament"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Anuleaza
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Se creeaza...' : 'Creeaza utilizator'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-gray-100">
                  <TableHead>Nume</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Departament</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.results.map((user) => (
                  <TableRow key={user.id} className="border-b border-gray-50 hover:bg-[#F8FAFC]">
                    <TableCell>
                      <div className="font-medium text-slate-800">
                        {user.full_name || `${user.first_name} ${user.last_name}`.trim() || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{user.username}</TableCell>
                    <TableCell className="text-slate-600">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={roleBadgeClasses[user.role] || roleBadgeClasses.viewer}>
                        {roleLabels[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{user.department || '-'}</TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge className="bg-green-100 text-green-800 border-transparent">
                          Activ
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-transparent">
                          Inactiv
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-slate-100"
                          title={user.is_active ? 'Dezactiveaza' : 'Activeaza'}
                          onClick={() => handleToggleActive(user)}
                        >
                          <Power className={`h-4 w-4 ${user.is_active ? 'text-green-600' : 'text-red-500'}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-slate-100"
                          title="Reseteaza parola"
                          onClick={() => handleResetPassword(user)}
                        >
                          <RotateCcw className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-slate-100"
                          title="Schimba rol"
                          onClick={() => {
                            setRoleEditUser(user)
                            setRoleEditValue(user.role)
                          }}
                        >
                          <Shield className="h-4 w-4 text-slate-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.results || data.results.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Nu exista utilizatori
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {data && data.count > 20 && (
        <div className="flex justify-center">
          <p className="text-sm text-slate-500">
            Afisati {data.results.length} din {data.count} utilizatori
          </p>
        </div>
      )}

      {/* Role Edit Dialog */}
      <Dialog
        open={!!roleEditUser}
        onOpenChange={(open) => {
          if (!open) {
            setRoleEditUser(null)
            setRoleEditValue('')
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Schimba rolul</DialogTitle>
            <DialogDescription>
              Schimba rolul pentru utilizatorul{' '}
              <span className="font-medium text-slate-800">{roleEditUser?.username}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="role-edit">Rol nou</Label>
            <Select value={roleEditValue} onValueChange={setRoleEditValue}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecteaza rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleEditUser(null)}>
              Anuleaza
            </Button>
            <Button onClick={handleRoleChange}>Salveaza</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temporary Password Dialog */}
      <Dialog
        open={tempPasswordDialog.open}
        onOpenChange={(open) => {
          if (!open) setTempPasswordDialog({ open: false, password: '', username: '' })
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Parola temporara</DialogTitle>
            <DialogDescription>
              Parola pentru utilizatorul{' '}
              <span className="font-medium text-slate-800">{tempPasswordDialog.username}</span>{' '}
              a fost resetata.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Parola temporara</Label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                readOnly
                value={tempPasswordDialog.password}
                className="font-mono bg-slate-50"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(tempPasswordDialog.password)
                  toast.success('Parola copiata in clipboard')
                }}
              >
                Copiaza
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Comunicati aceasta parola utilizatorului. La prima autentificare va fi necesara schimbarea parolei.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPasswordDialog({ open: false, password: '', username: '' })}>
              Inchide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
