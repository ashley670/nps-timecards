// =============================================================================
// lib/validations/pay-period.ts
// Zod schemas for pay period creation, update, and program assignment.
// =============================================================================

import { z } from 'zod'

// ---------------------------------------------------------------------------
// ISO date helper
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date in YYYY-MM-DD format')
  .refine((val) => {
    const d = new Date(val)
    return !isNaN(d.getTime())
  }, 'Invalid date value')

// ---------------------------------------------------------------------------
// Pay period create
// ---------------------------------------------------------------------------

export const PayPeriodCreateSchema = z
  .object({
    label: z
      .string()
      .min(1, 'Label is required')
      .max(100, 'Label must be 100 characters or fewer')
      .trim(),
    start_date: isoDate,
    end_date: isoDate,
    fiscal_year: z
      .string()
      .regex(/^\d{4}$/, 'Fiscal year must be a 4-digit number (e.g. 2025)'),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date)
      const end = new Date(data.end_date)
      return end > start
    },
    {
      message: 'End date must be after start date',
      path: ['end_date'],
    }
  )

export type PayPeriodCreateInput = z.infer<typeof PayPeriodCreateSchema>

// ---------------------------------------------------------------------------
// Pay period update
// ---------------------------------------------------------------------------

export const PayPeriodUpdateSchema = PayPeriodCreateSchema.extend({
  id: z.string().uuid('Invalid pay period ID'),
}).partial({ label: true, start_date: true, end_date: true, fiscal_year: true })

export type PayPeriodUpdateInput = z.infer<typeof PayPeriodUpdateSchema>

// ---------------------------------------------------------------------------
// Bulk create pay periods (from CSV upload)
// ---------------------------------------------------------------------------

export const BulkCreatePayPeriodsSchema = z.object({
  pay_periods: z
    .array(PayPeriodCreateSchema)
    .min(1, 'At least one pay period is required')
    .max(200, 'Cannot bulk-create more than 200 pay periods at once'),
})

export type BulkCreatePayPeriodsInput = z.infer<typeof BulkCreatePayPeriodsSchema>

// ---------------------------------------------------------------------------
// Link pay period to a program (program_pay_periods table)
// ---------------------------------------------------------------------------

export const ProgramPayPeriodSchema = z
  .object({
    program_id: z.string().uuid('Invalid program ID'),
    pay_period_id: z.string().uuid('Invalid pay period ID'),
    submit_deadline: isoDate,
    default_offset_days: z
      .number()
      .int('Offset days must be a whole number')
      .min(0, 'Offset days cannot be negative')
      .max(90, 'Offset days cannot exceed 90')
      .default(5),
  })
  .refine(
    (data) => {
      // submit_deadline must be a valid date (already checked by isoDate)
      // but we don't enforce it relative to pay period dates here —
      // that check happens at the service layer with full pay period data
      return true
    },
    { message: 'Invalid deadline configuration' }
  )

export type ProgramPayPeriodInput = z.infer<typeof ProgramPayPeriodSchema>

// ---------------------------------------------------------------------------
// Update program-pay-period link (deadline or offset)
// ---------------------------------------------------------------------------

export const ProgramPayPeriodUpdateSchema = z.object({
  id: z.string().uuid('Invalid program pay period link ID'),
  submit_deadline: isoDate.optional(),
  default_offset_days: z
    .number()
    .int()
    .min(0)
    .max(90)
    .optional(),
})

export type ProgramPayPeriodUpdateInput = z.infer<typeof ProgramPayPeriodUpdateSchema>

// ---------------------------------------------------------------------------
// Pay period filter schema
// ---------------------------------------------------------------------------

export const PayPeriodFiltersSchema = z.object({
  fiscal_year: z
    .string()
    .regex(/^\d{4}$/, 'Fiscal year must be a 4-digit number')
    .optional(),
  program_id: z.string().uuid().optional(),
  /** ISO date — return pay periods that include this date */
  contains_date: isoDate.optional(),
})

export type PayPeriodFiltersInput = z.infer<typeof PayPeriodFiltersSchema>

// ---------------------------------------------------------------------------
// NTL rate (Negotiated Teacher Liaison hourly rate) schema
// ---------------------------------------------------------------------------

export const NtlRateSchema = z.object({
  rate: z
    .number()
    .positive('Rate must be a positive number')
    .max(999.99, 'Rate seems unreasonably high — please check')
    .multipleOf(0.01, 'Rate must have at most 2 decimal places'),
  fiscal_year: z
    .string()
    .regex(/^\d{4}$/, 'Fiscal year must be a 4-digit number'),
})

export type NtlRateInput = z.infer<typeof NtlRateSchema>
