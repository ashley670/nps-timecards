'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Plus, Search, Pencil } from 'lucide-react'
import type { Program } from '@/types/app.types'

interface ProgramWithCounts extends Program {
  staff_count: number
  signee_count: number
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchPrograms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/programs')
      if (!res.ok) throw new Error('Failed to load programs')
      const data: ProgramWithCounts[] = await res.json()
      setPrograms(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrograms()
  }, [fetchPrograms])

  const filtered = programs.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.account_number.toLowerCase().includes(search.toLowerCase())
  )

  async function handleToggleActive(program: ProgramWithCounts) {
    setTogglingId(program.id)
    try {
      const res = await fetch(`/api/admin/programs/${program.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !program.is_active }),
      })
      if (!res.ok) throw new Error('Failed to update program')
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === program.id ? { ...p, is_active: !p.is_active } : p
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Programs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all NTL programs, staff, and signee assignments.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/programs/new">
            <Plus className="mr-2 h-4 w-4" />
            New Program
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-base flex-1">All Programs</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or account..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}
          {loading ? (
            <Spinner size="md" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              {search ? 'No programs match your search.' : 'No programs created yet.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program Name</TableHead>
                  <TableHead>Account #</TableHead>
                  <TableHead className="text-right">Staff</TableHead>
                  <TableHead className="text-right">Signees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium">{program.name}</TableCell>
                    <TableCell className="font-mono text-sm">{program.account_number}</TableCell>
                    <TableCell className="text-right">{program.staff_count}</TableCell>
                    <TableCell className="text-right">{program.signee_count}</TableCell>
                    <TableCell>
                      <Badge variant={program.is_active ? 'success' : 'secondary'}>
                        {program.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/programs/${program.id}`}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={togglingId === program.id}
                          onClick={() => handleToggleActive(program)}
                        >
                          {togglingId === program.id ? (
                            <Spinner size="sm" />
                          ) : program.is_active ? (
                            'Deactivate'
                          ) : (
                            'Activate'
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
