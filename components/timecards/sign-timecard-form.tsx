'use client'

// =============================================================================
// components/timecards/sign-timecard-form.tsx
// Signature form — Client Component
// Renders a typed-name signature input and submits to the sign API route.
// =============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Spinner } from '@/components/ui/spinner'
import { PenLine, CheckCircle2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SignTimecardFormProps {
  timecardId: string
  staffName: string
  programName: string
  payPeriodLabel: string
  programId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SignTimecardForm({
  timecardId,
  staffName,
  programName,
  payPeriodLabel,
  programId,
}: SignTimecardFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [signature, setSignature] = useState('')
  const [loading, setLoading] = useState(false)
  const [signed, setSigned] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const trimmed = signature.trim()
    if (!trimmed) {
      toast({
        title: 'Signature required',
        description: 'Please type your full name to sign this timecard.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/signee/timecards/${timecardId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: trimmed }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to sign timecard')
      }

      setSigned(true)
      toast({
        title: 'Timecard signed successfully',
        description: `You have signed ${staffName}'s timecard for ${payPeriodLabel}.`,
      })

      // Short delay so the user sees the success state, then redirect
      setTimeout(() => {
        router.push(`/signee/program/${programId}`)
        router.refresh()
      }, 1200)
    } catch (err) {
      toast({
        title: 'Error signing timecard',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (signed) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-5">
        <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800">Timecard signed</p>
          <p className="text-sm text-green-700">Redirecting you back to the program…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 shrink-0">
          <PenLine className="h-5 w-5 text-blue-700" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Sign this timecard</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            By typing your full name below, you are electronically signing{' '}
            <strong>{staffName}</strong>&apos;s timecard for{' '}
            <strong>{programName}</strong> — <strong>{payPeriodLabel}</strong>.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="signature" className="text-sm font-medium">
            Type your full name to sign:
          </Label>
          <Input
            id="signature"
            type="text"
            placeholder="Your full name"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            disabled={loading}
            autoComplete="name"
            className="bg-white max-w-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !signature.trim()}
          className="min-w-[160px]"
        >
          {loading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Signing…
            </>
          ) : (
            <>
              <PenLine className="mr-2 h-4 w-4" />
              Submit Signature
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
