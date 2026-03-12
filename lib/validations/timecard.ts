// =============================================================================
// lib/validations/timecard.ts
// Zod schemas for timecard form data and related operations.
// =============================================================================

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Validates an HH:MM time string (24-hour format) */
const timeString = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, 'Must be a valid time in HH:MM format')
  .refine((val) => {
    const [h, m] = val.split(':').map(Number)
    return h >= 0 && h <= 23 && m >= 0 && m <= 59
  }, 'Time value out of range (00:00–23:59)')

/** Validates an ISO date string YYYY-MM-DD */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date in YYYY-MM-DD format')

// ---------------------------------------------------------------------------
// Single timecard entry (one work day row)
// ---------------------------------------------------------------------------

export const TimecardEntrySchema = z
  .object({
    /** Temporary client-side ID for list management (not persisted) */
    id: z.string().optional(),
    work_date: isoDate,
    time_in: timeString,
    time_out: timeString,
    /** Calculated total hours — must be positive */
    total_hours: z
      .number()
      .positive('Total hours must be greater than 0')
      .max(24, 'Total hours cannot exceed 24 in a single day')
      .multipleOf(0.01, 'Hours must be rounded to 2 decimal places'),
  })
  .refine(
    (data) => {
      // time_out must be after time_in
      const [inH, inM] = data.time_in.split(':').map(Number)
      const [outH, outM] = data.time_out.split(':').map(Number)
      const inMinutes = inH * 60 + inM
      const outMinutes = outH * 60 + outM
      return outMinutes > inMinutes
    },
    {
      message: 'Time out must be after time in',
      path: ['time_out'],
    }
  )

export type TimecardEntryInput = z.infer<typeof TimecardEntrySchema>

// ---------------------------------------------------------------------------
// Full timecard submission form
// ---------------------------------------------------------------------------

export const TimecardSubmitSchema = z.object({
  timecard_id: z.string().uuid('Invalid timecard ID'),
  /** Staff typed their name as an electronic signature */
  staff_signature: z
    .string()
    .min(2, 'Signature must be at least 2 characters')
    .max(100, 'Signature too long')
    .trim(),
  entries: z
    .array(TimecardEntrySchema)
    .min(1, 'At least one time entry is required')
    .max(31, 'Cannot have more than 31 entries per pay period'),
})

export type TimecardSubmitInput = z.infer<typeof TimecardSubmitSchema>

// ---------------------------------------------------------------------------
// Timecard sign form (signee action)
// ---------------------------------------------------------------------------

export const TimecardSignSchema = z.object({
  timecard_id: z.string().uuid('Invalid timecard ID'),
  /** Signee typed their name as an electronic signature */
  signee_signature: z
    .string()
    .min(2, 'Signature must be at least 2 characters')
    .max(100, 'Signature too long')
    .trim(),
})

export type TimecardSignInput = z.infer<typeof TimecardSignSchema>

// ---------------------------------------------------------------------------
// Reopen request form (staff action)
// ---------------------------------------------------------------------------

export const TimecardReopenRequestSchema = z.object({
  timecard_id: z.string().uuid('Invalid timecard ID'),
  reason: z
    .string()
    .min(10, 'Please provide a reason of at least 10 characters')
    .max(500, 'Reason must be 500 characters or fewer')
    .trim(),
})

export type TimecardReopenRequestInput = z.infer<typeof TimecardReopenRequestSchema>

// ---------------------------------------------------------------------------
// Reopen decision form (signee action — approve or deny)
// ---------------------------------------------------------------------------

export const TimecardReopenDecisionSchema = z.object({
  timecard_id: z.string().uuid('Invalid timecard ID'),
  approved: z.boolean(),
})

export type TimecardReopenDecisionInput = z.infer<typeof TimecardReopenDecisionSchema>

// ---------------------------------------------------------------------------
// Timecard save draft (partial — no signature required)
// ---------------------------------------------------------------------------

export const TimecardDraftSchema = z.object({
  timecard_id: z.string().uuid('Invalid timecard ID'),
  entries: z
    .array(
      z.object({
        id: z.string().optional(),
        work_date: isoDate,
        time_in: timeString,
        time_out: timeString,
        total_hours: z
          .number()
          .min(0, 'Total hours cannot be negative')
          .max(24, 'Total hours cannot exceed 24')
          .multipleOf(0.01),
      })
    )
    .max(31, 'Cannot have more than 31 entries per pay period'),
})

export type TimecardDraftInput = z.infer<typeof TimecardDraftSchema>

// ---------------------------------------------------------------------------
// Timecard filters / query params (admin list view)
// ---------------------------------------------------------------------------

export const TimecardFiltersSchema = z.object({
  program_id: z.string().uuid().optional(),
  pay_period_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  status: z
    .enum(['draft', 'submitted', 'signed', 'reopen_requested', 'reopened'])
    .optional(),
  fiscal_year: z
    .string()
    .regex(/^\d{4}$/, 'Fiscal year must be a 4-digit number')
    .optional(),
})

export type TimecardFiltersInput = z.infer<typeof TimecardFiltersSchema>
