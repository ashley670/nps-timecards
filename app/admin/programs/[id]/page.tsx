'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronLeft,
  Pencil,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: string
  full_name: string
  email: string
  role: string
}

interface StaffMember {
  id: string
  staff_id: string
  school: string
  assigned_at: string
  staff: User
}

interface SigneeAssignment {
  id: string
  signee_id: string
  staff_id: string | null
  assigned_at: string
  signee: User
}

interface PayPeriodEntry {
  id: string
  pay_period_id: string
  submit_deadline: string
  default_offset_days: number
  pay_period: {
    id: string
    label: string
    start_date: string
    end_date: string
    fiscal_year: string
  }
}

interface TimecardSummary {
  id: string
  status: string
  submitted_at: string | null
  signee_signed_at: string | null
  staff: { full_name: string; email: string }
  pay_period: { label: string; start_date: string; end_date: string }
}

interface ProgramDetail {
  id: string
  name: string
  account_number: string
  is_active: boolean
  created_at: string
  staff: StaffMember[]
  signees: SigneeAssignment[]
  pay_periods: PayPeriodEntry[]
  timecards: TimecardSummary[]
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'outline'> = {
  draft: 'secondary',
  submitted: 'default',
  signed: 'success',
  reopen_requested: 'destructive',
  reopened: 'outline',
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EditProgramPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Info editing
  const [editingInfo, setEditingInfo] = useState(false)
  const [editName, setEditName] = useState('')
  const [editAccount, setEditAccount] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  // Add staff
  const [addingStaff, setAddingStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffSchool, setNewStaffSchool] = useState('')
  const [addingStaffLoading, setAddingStaffLoading] = useState(false)

  // Add signee
  const [allSignees, setAllSignees] = useState<User[]>([])
  const [addingSignee, setAddingSignee] = useState(false)
  const [newSigneeId, setNewSigneeId] = useState('')
  const [newSigneeStaffId, setNewSigneeStaffId] = useState('all')
  const [addingSigneeLoading, setAddingSigneeLoading] = useState(false)

  // Add pay period
  const [allPayPeriods, setAllPayPeriods] = useState<{ id: string; label: string; end_date: string }[]>([])
  const [addingPP, setAddingPP] = useState(false)
  const [newPPId, setNewPPId] = useState('')
  const [newPPDeadline, setNewPPDeadline] = useState('')
  const [addingPPLoading, setAddingPPLoading] = useState(false)

  // Deactivate dialog
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const loadProgram = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/programs/${id}`)
      if (!res.ok) throw new Error('Program not found')
      const data: ProgramDetail = await res.json()
      setProgram(data)
      setEditName(data.name)
      setEditAccount(data.account_number)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load program')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadSignees = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=signee')
      if (!res.ok) return
      const data: User[] = await res.json()
      setAllSignees(data)
    } catch {}
  }, [])

  const loadPayPeriods = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pay-periods')
      if (!res.ok) return
      const data = await res.json()
      setAllPayPeriods(data)
    } catch {}
  }, [])

  useEffect(() => {
    loadProgram()
    loadSignees()
    loadPayPeriods()
  }, [loadProgram, loadSignees, loadPayPeriods])

  // ---------------------------------------------------------------------------
  // Info save
  // ---------------------------------------------------------------------------

  async function saveInfo() {
    setSavingInfo(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/programs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, account_number: editAccount }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to save')
      }
      const updated = await res.json()
      setProgram((prev) =>
        prev ? { ...prev, name: updated.name, account_number: updated.account_number } : prev
      )
      setEditingInfo(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingInfo(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Staff management
  // ---------------------------------------------------------------------------

  async function addStaff() {
    if (!newStaffName.trim() || !newStaffEmail.trim()) return
    setAddingStaffLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/programs/${id}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newStaffName.trim(),
          email: newStaffEmail.trim(),
          school: newStaffSchool.trim(),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to add staff')
      }
      const newMember = await res.json()
      setProgram((prev) =>
        prev ? { ...prev, staff: [...prev.staff, newMember] } : prev
      )
      setNewStaffName('')
      setNewStaffEmail('')
      setNewStaffSchool('')
      setAddingStaff(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add staff')
    } finally {
      setAddingStaffLoading(false)
    }
  }

  async function removeStaff(staffId: string) {
    setError(null)
    try {
      const res = await fetch(`/api/admin/programs/${id}/staff`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to remove staff')
      }
      setProgram((prev) =>
        prev ? { ...prev, staff: prev.staff.filter((s) => s.staff_id !== staffId) } : prev
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove staff')
    }
  }

  // ---------------------------------------------------------------------------
  // Signee management
  // ---------------------------------------------------------------------------

  async function addSignee() {
    if (!newSigneeId) return
    setAddingSigneeLoading(true)
    setError(null)
    try {
      const assignments = [
        {
          signee_id: newSigneeId,
          staff_id: newSigneeStaffId === 'all' ? null : newSigneeStaffId,
        },
      ]
      const res = await fetch(`/api/admin/programs/${id}/signees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to add signee')
      }
      await loadProgram()
      setNewSigneeId('')
      setNewSigneeStaffId('all')
      setAddingSignee(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add signee')
    } finally {
      setAddingSigneeLoading(false)
    }
  }

  async function removeSignee(signeeId: string, staffId: string | null) {
    setError(null)
    try {
      const res = await fetch(`/api/admin/programs/${id}/signees`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signee_id: signeeId, staff_id: staffId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to remove signee')
      }
      setProgram((prev) =>
        prev
          ? {
              ...prev,
              signees: prev.signees.filter(
                (s) => !(s.signee_id === signeeId && s.staff_id === staffId)
              ),
            }
          : prev
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove signee')
    }
  }

  // ---------------------------------------------------------------------------
  // Pay period management
  // ---------------------------------------------------------------------------

  async function addPayPeriod() {
    if (!newPPId || !newPPDeadline) return
    setAddingPPLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/programs/${id}/pay-periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pay_period_id: newPPId,
          submit_deadline: new Date(newPPDeadline).toISOString(),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to add pay period')
      }
      const newEntry = await res.json()
      setProgram((prev) =>
        prev ? { ...prev, pay_periods: [...prev.pay_periods, newEntry] } : prev
      )
      setNewPPId('')
      setNewPPDeadline('')
      setAddingPP(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add pay period')
    } finally {
      setAddingPPLoading(false)
    }
  }

  async function removePayPeriod(ppId: string) {
    setError(null)
    try {
      const res = await fetch(`/api/admin/programs/${id}/pay-periods`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pay_period_id: ppId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to remove pay period')
      }
      setProgram((prev) =>
        prev
          ? {
              ...prev,
              pay_periods: prev.pay_periods.filter((p) => p.pay_period_id !== ppId),
            }
          : prev
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove pay period')
    }
  }

  // ---------------------------------------------------------------------------
  // Deactivate
  // ---------------------------------------------------------------------------

  async function handleDeactivate() {
    setDeactivating(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/programs/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to deactivate')
      }
      router.push('/admin/programs')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate')
      setDeactivating(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error && !program) {
    return (
      <div className="py-10 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button asChild variant="outline">
          <Link href="/admin/programs">Back to Programs</Link>
        </Button>
      </div>
    )
  }

  if (!program) return null

  const assignedPPIds = new Set(program.pay_periods.map((p) => p.pay_period_id))
  const availablePPs = allPayPeriods.filter((pp) => !assignedPPIds.has(pp.id))

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/admin/programs">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Programs
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">{program.name}</h2>
            <Badge variant={program.is_active ? 'success' : 'secondary'}>
              {program.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Account: <span className="font-mono">{program.account_number}</span>
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmDeactivate(true)}
          disabled={!program.is_active}
        >
          Deactivate Program
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {/* Deactivate confirmation */}
      {confirmDeactivate && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive mb-1">
                  Deactivate this program?
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  This will mark the program as inactive. Existing timecards are preserved.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeactivate}
                    disabled={deactivating}
                  >
                    {deactivating ? <Spinner size="sm" /> : 'Confirm Deactivate'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDeactivate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Program Info</TabsTrigger>
          <TabsTrigger value="staff">Staff ({program.staff.length})</TabsTrigger>
          <TabsTrigger value="signees">Signees ({program.signees.length})</TabsTrigger>
          <TabsTrigger value="payperiods">Pay Periods ({program.pay_periods.length})</TabsTrigger>
          <TabsTrigger value="timecards">Timecards ({program.timecards.length})</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* Info tab                                                          */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Program Details</CardTitle>
                {!editingInfo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingInfo(true)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Program Name</Label>
                  {editingInfo ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  ) : (
                    <p className="text-sm">{program.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  {editingInfo ? (
                    <Input
                      value={editAccount}
                      onChange={(e) => setEditAccount(e.target.value)}
                    />
                  ) : (
                    <p className="text-sm font-mono">{program.account_number}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Created</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(program.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              {editingInfo && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={saveInfo} disabled={savingInfo}>
                    {savingInfo ? <Spinner size="sm" /> : (
                      <><Save className="h-4 w-4 mr-2" />Save Changes</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingInfo(false)
                      setEditName(program.name)
                      setEditAccount(program.account_number)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Staff tab                                                         */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="staff" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Staff Members</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setAddingStaff(!addingStaff)}
                  variant={addingStaff ? 'outline' : 'default'}
                >
                  {addingStaff ? 'Cancel' : (
                    <><Plus className="h-4 w-4 mr-2" />Add Staff</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {addingStaff && (
                <div className="mb-4 p-4 border rounded-lg bg-gray-50 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Full Name *</Label>
                      <Input
                        placeholder="Jane Smith"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email *</Label>
                      <Input
                        type="email"
                        placeholder="jane@nps.org"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">School</Label>
                      <Input
                        placeholder="School name"
                        value={newStaffSchool}
                        onChange={(e) => setNewStaffSchool(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={addStaff}
                    disabled={addingStaffLoading || !newStaffName.trim() || !newStaffEmail.trim()}
                  >
                    {addingStaffLoading ? <Spinner size="sm" /> : 'Add Staff Member'}
                  </Button>
                </div>
              )}
              {program.staff.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No staff assigned.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {program.staff.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.staff.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.staff.email}
                        </TableCell>
                        <TableCell>{member.school}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(member.assigned_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeStaff(member.staff_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Signees tab                                                       */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="signees" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Signee Assignments</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setAddingSignee(!addingSignee)}
                  variant={addingSignee ? 'outline' : 'default'}
                >
                  {addingSignee ? 'Cancel' : (
                    <><Plus className="h-4 w-4 mr-2" />Add Signee</>
                  )}
                </Button>
              </div>
              <CardDescription>
                Signees with no staff assignment cover all staff in the program.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {addingSignee && (
                <div className="mb-4 p-4 border rounded-lg bg-gray-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Signee *</Label>
                      <Select value={newSigneeId} onValueChange={setNewSigneeId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select signee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allSignees.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Assigned to Staff (optional)</Label>
                      <Select value={newSigneeStaffId} onValueChange={setNewSigneeStaffId}>
                        <SelectTrigger>
                          <SelectValue placeholder="All staff" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Staff</SelectItem>
                          <Separator className="my-1" />
                          {program.staff.map((s) => (
                            <SelectItem key={s.staff_id} value={s.staff_id}>
                              {s.staff.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={addSignee}
                    disabled={addingSigneeLoading || !newSigneeId}
                  >
                    {addingSigneeLoading ? <Spinner size="sm" /> : 'Add Assignment'}
                  </Button>
                </div>
              )}
              {program.signees.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No signees assigned.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Signee</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Covers</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {program.signees.map((assignment) => {
                      const staffCovered = assignment.staff_id
                        ? program.staff.find((s) => s.staff_id === assignment.staff_id)
                            ?.staff.full_name ?? assignment.staff_id
                        : 'All Staff'
                      return (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">
                            {assignment.signee.full_name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {assignment.signee.email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={assignment.staff_id ? 'outline' : 'secondary'}
                              className="text-xs"
                            >
                              {staffCovered}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(assignment.assigned_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                removeSignee(assignment.signee_id, assignment.staff_id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Pay periods tab                                                   */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="payperiods" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assigned Pay Periods</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setAddingPP(!addingPP)}
                  variant={addingPP ? 'outline' : 'default'}
                >
                  {addingPP ? 'Cancel' : (
                    <><Plus className="h-4 w-4 mr-2" />Assign Pay Period</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {addingPP && (
                <div className="mb-4 p-4 border rounded-lg bg-gray-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Pay Period *</Label>
                      <Select
                        value={newPPId}
                        onValueChange={(val) => {
                          setNewPPId(val)
                          const pp = availablePPs.find((p) => p.id === val)
                          if (pp) {
                            setNewPPDeadline(`${pp.end_date}T17:00`)
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pay period..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePPs.length === 0 ? (
                            <SelectItem value="_none" disabled>
                              All pay periods assigned
                            </SelectItem>
                          ) : (
                            availablePPs.map((pp) => (
                              <SelectItem key={pp.id} value={pp.id}>
                                {pp.label}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Submission Deadline *</Label>
                      <Input
                        type="datetime-local"
                        value={newPPDeadline}
                        onChange={(e) => setNewPPDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={addPayPeriod}
                    disabled={addingPPLoading || !newPPId || !newPPDeadline}
                  >
                    {addingPPLoading ? <Spinner size="sm" /> : 'Assign Pay Period'}
                  </Button>
                </div>
              )}
              {program.pay_periods.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No pay periods assigned.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Fiscal Year</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {program.pay_periods.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.pay_period.label}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.pay_period.start_date} – {entry.pay_period.end_date}
                        </TableCell>
                        <TableCell>{entry.pay_period.fiscal_year}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(entry.submit_deadline).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removePayPeriod(entry.pay_period_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Timecards tab                                                     */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="timecards" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Timecard Status Summary</CardTitle>
              <CardDescription>
                All timecard submissions for this program across all pay periods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {program.timecards.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No timecards submitted yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Pay Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Signed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {program.timecards.map((tc) => (
                      <TableRow key={tc.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{tc.staff.full_name}</p>
                            <p className="text-xs text-muted-foreground">{tc.staff.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{tc.pay_period.label}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[tc.status] ?? 'secondary'}>
                            {tc.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tc.submitted_at
                            ? new Date(tc.submitted_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tc.signee_signed_at
                            ? new Date(tc.signee_signed_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
