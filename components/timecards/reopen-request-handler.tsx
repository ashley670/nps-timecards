'use client'

// =============================================================================
// components/timecards/reopen-request-handler.tsx
// Reopen request UI — Client Component
// Displays a staff member's reopen request and lets the signee approve or deny.
// =============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReopenRequestHandlerProps {
  timecardId: string
  staffName: string
  reason: string
  programId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReopenRequestHandler({
  timecardId,
  staffName,
  reason,
  programId,
}: ReopenRequestHandlerProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null)
  const [resolved, setResolved] = useState<'approved' | 'denied' | null>(null)

  async function handleAction(approved: boolean) {
    const action = approved ? 'approve' : 'deny'
    setLoading(action)

    try {
      const res = await fetch(`/api/signee/timecards/${timecardId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to ${action} reopen request`)
      }

      const outcome = approved ? 'approved' : 'denied'
      setResolved(outcome)

      toast({
        title: approved ? 'Reopen request approved' : 'Reopen request denied',
        description: approved
          ? `${staffName} can now edit and resubmit their timecard.`
          : `The original signed timecard will remain in effect.`,
      })

      setTimeout(() => {
        router.push(`/signee/program/${programId}`)
        router.refresh()
      }, 1200)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      })
    } finally {
      setLoading(null)
    }
  }

  if (resolved) {
    const isApproved = resolved === 'approved'
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border p-5 ${
          isApproved
            ? 'border-green-200 bg-green-50'
            : 'border-red-200 bg-red-50'
        }`}
      >
        {isApproved ? (
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
        ) : (
          <XCircle className="h-6 w-6 text-red-600 shrink-0" />
        )}
        <div>
          <p className={`font-semibold ${isApproved ? 'text-green-800' : 'text-red-800'}`}>
            Request {resolved}
          </p>
          <p className={`text-sm ${isApproved ? 'text-green-700' : 'text-red-700'}`}>
            Redirecting you back to the program…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 shrink-0">
          <AlertCircle className="h-5 w-5 text-yellow-700" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">
            {staffName} has requested to edit this timecard
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review the reason below and approve or deny the request.
          </p>
        </div>
      </div>

      {/* Reason */}
      {reason && (
        <div className="rounded-md border border-yellow-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700 mb-1">
            Reason provided
          </p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{reason}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => handleAction(true)}
          disabled={loading !== null}
          className="min-w-[120px] bg-green-600 hover:bg-green-700 focus-visible:ring-green-600"
        >
          {loading === 'approve' ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Approving…
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </>
          )}
        </Button>

        <Button
          onClick={() => handleAction(false)}
          disabled={loading !== null}
          variant="destructive"
          className="min-w-[120px]"
        >
          {loading === 'deny' ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Denying…
            </>
          ) : (
            <>
              <XCircle className="mr-2 h-4 w-4" />
              Deny
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        If approved, {staffName} will be notified by email and can edit and resubmit
        their timecard. If denied, the signed timecard remains in effect.
      </p>
    </div>
  )
}
