// =============================================================================
// lib/validations/program.ts
// Zod schemas for program creation, update, and staff/signee assignment.
// =============================================================================

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Program create / update
// ---------------------------------------------------------------------------

export const ProgramCreateSchema = z.object({
  name: z
    .string()
    .min(2, 'Program name must be at least 2 characters')
    .max(100, 'Program name must be 100 characters or fewer')
    .trim(),
  account_number: z
    .string()
    .min(1, 'Account number is required')
    .max(50, 'Account number must be 50 characters or fewer')
    .trim(),
})

export type ProgramCreateInput = z.infer<typeof ProgramCreateSchema>

export const ProgramUpdateSchema = ProgramCreateSchema.extend({
  id: z.string().uuid('Invalid program ID'),
  is_active: z.boolean().optional(),
}).partial({ name: true, account_number: true })

export type ProgramUpdateInput = z.infer<typeof ProgramUpdateSchema>

// ---------------------------------------------------------------------------
// Assign staff to a program (single)
// ---------------------------------------------------------------------------

export const AssignStaffSchema = z.object({
  program_id: z.string().uuid('Invalid program ID'),
  staff_id: z.string().uuid('Invalid staff ID'),
  school: z
    .string()
    .min(1, 'School is required')
    .max(100, 'School name must be 100 characters or fewer')
    .trim(),
})

export type AssignStaffInput = z.infer<typeof AssignStaffSchema>

// ---------------------------------------------------------------------------
// Bulk assign staff to a program (from CSV upload)
// ---------------------------------------------------------------------------

export const BulkAssignStaffSchema = z.object({
  program_id: z.string().uuid('Invalid program ID'),
  staff: z
    .array(
      z.object({
        full_name: z.string().min(1, 'Full name is required').max(100).trim(),
        email: z.string().email('Invalid email address').toLowerCase(),
        address: z.string().max(200).trim().optional().default(''),
        school: z.string().min(1, 'School is required').max(100).trim(),
      })
    )
    .min(1, 'At least one staff member is required')
    .max(500, 'Cannot bulk-import more than 500 staff at once'),
})

export type BulkAssignStaffInput = z.infer<typeof BulkAssignStaffSchema>

// ---------------------------------------------------------------------------
// Assign signee to a program
// ---------------------------------------------------------------------------

export const AssignSigneeSchema = z.object({
  program_id: z.string().uuid('Invalid program ID'),
  signee_id: z.string().uuid('Invalid signee ID'),
  /** Optional: restrict this signee assignment to a specific staff member */
  staff_id: z.string().uuid('Invalid staff ID').nullable().optional(),
})

export type AssignSigneeInput = z.infer<typeof AssignSigneeSchema>

// ---------------------------------------------------------------------------
// Remove staff from a program
// ---------------------------------------------------------------------------

export const RemoveStaffSchema = z.object({
  program_id: z.string().uuid('Invalid program ID'),
  staff_id: z.string().uuid('Invalid staff ID'),
})

export type RemoveStaffInput = z.infer<typeof RemoveStaffSchema>

// ---------------------------------------------------------------------------
// Remove signee from a program
// ---------------------------------------------------------------------------

export const RemoveSigneeSchema = z.object({
  program_id: z.string().uuid('Invalid program ID'),
  signee_id: z.string().uuid('Invalid signee ID'),
})

export type RemoveSigneeInput = z.infer<typeof RemoveSigneeSchema>

// ---------------------------------------------------------------------------
// Activate / deactivate a program
// ---------------------------------------------------------------------------

export const SetProgramActiveSchema = z.object({
  program_id: z.string().uuid('Invalid program ID'),
  is_active: z.boolean(),
})

export type SetProgramActiveInput = z.infer<typeof SetProgramActiveSchema>

// ---------------------------------------------------------------------------
// Program filter schema (admin list query params)
// ---------------------------------------------------------------------------

export const ProgramFiltersSchema = z.object({
  is_active: z.boolean().optional(),
  fiscal_year: z
    .string()
    .regex(/^\d{4}$/, 'Fiscal year must be a 4-digit number')
    .optional(),
  search: z.string().max(100).trim().optional(),
})

export type ProgramFiltersInput = z.infer<typeof ProgramFiltersSchema>
