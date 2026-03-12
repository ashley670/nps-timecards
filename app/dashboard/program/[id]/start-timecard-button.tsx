'use client'

// =============================================================================
// app/dashboard/program/[id]/start-timecard-button.tsx
// Client component: POSTs to create a new draft timecard, then redirects.
// =============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

interface StartTimecardButtonProps {
  programId: string
  payPeriodId: string
}

export default function StartTimecardButton({
  programId,
  payPeriodId,
}: StartTimecardButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    setLoading(true)
    try {
      const res = await fetch('/api/timecards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId, pay_period_id: payPeriodId }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to create timecard')
      }

      const timecard = await res.json()
      router.push(`/dashboard/timecard/${timecard.id}`)
      router.refresh()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not start timecard.',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  return (
    <Button size="sm" onClick={handleStart} disabled={loading}>
      {loading ? 'Starting…' : 'Start Timecard'}
    </Button>
  )
}
