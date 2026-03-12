// =============================================================================
// app.types.ts
// Application-level types built on top of the database schema.
// These are the types used throughout components, hooks, and server actions.
// =============================================================================

// ---------------------------------------------------------------------------
// Enums (re-exported here so consumers only need to import from app.types)
// ---------------------------------------------------------------------------
export type UserRole = 'district_admin' | 'staff' | 'signee';

export type TimecardStatus =
  | 'draft'
  | 'submitted'
  | 'signed'
  | 'reopen_requested'
  | 'reopened';

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  full_name: string;
  address: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------
export interface Program {
  id: string;
  name: string;
  account_number: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// ProgramStaff
// ---------------------------------------------------------------------------
export interface ProgramStaff {
  id: string;
  program_id: string;
  staff_id: string;
  school: string;
  assigned_at: string;
}

// ---------------------------------------------------------------------------
// ProgramSignee
// ---------------------------------------------------------------------------
export interface ProgramSignee {
  id: string;
  program_id: string;
  signee_id: string;
  /** null means the signee covers ALL staff in the program */
  staff_id: string | null;
  assigned_at: string;
}

// ---------------------------------------------------------------------------
// PayPeriod
// ---------------------------------------------------------------------------
export interface PayPeriod {
  id: string;
  label: string;
  /** ISO date string YYYY-MM-DD */
  start_date: string;
  /** ISO date string YYYY-MM-DD */
  end_date: string;
  fiscal_year: string;
  created_by: string;
}

// ---------------------------------------------------------------------------
// ProgramPayPeriod
// ---------------------------------------------------------------------------
export interface ProgramPayPeriod {
  id: string;
  program_id: string;
  pay_period_id: string;
  submit_deadline: string;
  default_offset_days: number;
}

// ---------------------------------------------------------------------------
// Timecard
// ---------------------------------------------------------------------------
export interface Timecard {
  id: string;
  program_id: string;
  pay_period_id: string;
  staff_id: string;
  status: TimecardStatus;
  submitted_at: string | null;
  staff_signature: string | null;
  staff_signed_at: string | null;
  signee_id: string | null;
  signee_signature: string | null;
  signee_signed_at: string | null;
  pdf_url: string | null;
  reopen_reason: string | null;
  reopen_approved_by: string | null;
  reopen_approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// TimecardEntry
// ---------------------------------------------------------------------------
export interface TimecardEntry {
  id: string;
  timecard_id: string;
  /** ISO date string YYYY-MM-DD */
  work_date: string;
  /** HH:MM:SS */
  time_in: string;
  /** HH:MM:SS */
  time_out: string;
  total_hours: number;
}

// ---------------------------------------------------------------------------
// NtlRate
// ---------------------------------------------------------------------------
export interface NtlRate {
  id: string;
  rate: number;
  fiscal_year: string;
  set_by: string;
  set_at: string;
}

// ---------------------------------------------------------------------------
// Composite / joined types used in the UI
// ---------------------------------------------------------------------------

/** Timecard with its related entries pre-fetched */
export interface TimecardWithEntries extends Timecard {
  timecard_entries: TimecardEntry[];
}

/** Timecard with all relational data joined for display / PDF generation */
export interface TimecardDetail extends TimecardWithEntries {
  staff: User;
  signee: User | null;
  program: Program;
  pay_period: PayPeriod;
}

/** Program with staff and signee membership lists */
export interface ProgramDetail extends Program {
  program_staff: (ProgramStaff & { staff: User })[];
  program_signees: (ProgramSignee & { signee: User })[];
}
