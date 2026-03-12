import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns'

// ---------------------------------------------------------------------------
// Tailwind class merging
// ---------------------------------------------------------------------------

/**
 * Merges Tailwind CSS class names, resolving conflicts intelligently.
 * Combines clsx (conditional classes) with tailwind-merge (conflict resolution).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

/**
 * Formats a number as USD currency string.
 * @example formatCurrency(1234.5) → "$1,234.50"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Formats a date value into a human-readable string.
 * Accepts a Date object, ISO string, or timestamp number.
 * @param date - The date to format
 * @param fmt  - date-fns format string (default: "MMM d, yyyy")
 * @example formatDate("2025-01-15") → "Jan 15, 2025"
 * @example formatDate(new Date(), "MM/dd/yyyy") → "01/15/2025"
 */
export function formatDate(
  date: Date | string | number,
  fmt: string = 'MMM d, yyyy'
): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date)
    return format(d, fmt)
  } catch {
    return String(date)
  }
}

/**
 * Formats a date range as a human-readable string.
 * @example formatDateRange("2025-01-01", "2025-01-15") → "Jan 1 – Jan 15, 2025"
 */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const s = typeof start === 'string' ? parseISO(start) : start
  const e = typeof end === 'string' ? parseISO(end) : end

  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) {
      // Same month and year: "Jan 1 – 15, 2025"
      return `${format(s, 'MMM d')} \u2013 ${format(e, 'd, yyyy')}`
    }
    // Same year, different month: "Jan 1 – Feb 15, 2025"
    return `${format(s, 'MMM d')} \u2013 ${format(e, 'MMM d, yyyy')}`
  }
  // Different years: "Dec 16, 2024 – Jan 15, 2025"
  return `${format(s, 'MMM d, yyyy')} \u2013 ${format(e, 'MMM d, yyyy')}`
}

// ---------------------------------------------------------------------------
// Fiscal year
// ---------------------------------------------------------------------------

/**
 * Returns the NPS fiscal year for a given date.
 * NPS fiscal year runs July 1 – June 30.
 * Fiscal year 2025 = July 1, 2024 – June 30, 2025.
 *
 * @param date - The date to evaluate (defaults to today)
 * @returns The fiscal year as a 4-digit number
 * @example getFiscalYear(new Date("2025-03-01")) → 2025
 * @example getFiscalYear(new Date("2024-08-01")) → 2025
 */
export function getFiscalYear(date: Date = new Date()): number {
  const month = date.getMonth() // 0-indexed: July = 6
  const year = date.getFullYear()
  // If month is July (6) or later, fiscal year is year + 1
  return month >= 6 ? year + 1 : year
}

/**
 * Returns the start and end dates of a given NPS fiscal year.
 * @param fiscalYear - e.g. 2025 → { start: 2024-07-01, end: 2025-06-30 }
 */
export function getFiscalYearRange(fiscalYear: number): { start: Date; end: Date } {
  return {
    start: new Date(fiscalYear - 1, 6, 1),  // July 1 of previous calendar year
    end: new Date(fiscalYear, 5, 30),         // June 30 of fiscal year
  }
}

/**
 * Returns a display label for a fiscal year.
 * @example getFiscalYearLabel(2025) → "FY 2024-2025"
 */
export function getFiscalYearLabel(fiscalYear: number): string {
  return `FY ${fiscalYear - 1}-${fiscalYear}`
}

// ---------------------------------------------------------------------------
// Deadline status
// ---------------------------------------------------------------------------

export type DeadlineStatus = 'upcoming' | 'due-soon' | 'overdue' | 'completed'

export interface DeadlineInfo {
  status: DeadlineStatus
  /** Human-readable label, e.g. "Due in 3 days", "Overdue by 2 days", "Completed" */
  label: string
  /** Number of days until (positive) or past (negative) the deadline */
  daysUntil: number
}

/**
 * Evaluates the status of a deadline relative to today.
 *
 * @param deadline      - The deadline date (ISO string or Date)
 * @param isCompleted   - Whether the task has already been completed
 * @param warnDays      - Number of days before deadline to show "due-soon" (default: 3)
 * @returns DeadlineInfo with status, human-readable label, and daysUntil
 */
export function getDeadlineStatus(
  deadline: string | Date,
  isCompleted: boolean = false,
  warnDays: number = 3
): DeadlineInfo {
  if (isCompleted) {
    return { status: 'completed', label: 'Completed', daysUntil: 0 }
  }

  const deadlineDate = typeof deadline === 'string' ? parseISO(deadline) : deadline
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadlineDate.setHours(0, 0, 0, 0)

  const msPerDay = 1000 * 60 * 60 * 24
  const daysUntil = Math.round(
    (deadlineDate.getTime() - today.getTime()) / msPerDay
  )

  if (daysUntil < 0) {
    const overdueDays = Math.abs(daysUntil)
    return {
      status: 'overdue',
      label: `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`,
      daysUntil,
    }
  }

  if (daysUntil === 0) {
    return { status: 'due-soon', label: 'Due today', daysUntil: 0 }
  }

  if (daysUntil <= warnDays) {
    return {
      status: 'due-soon',
      label: `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      daysUntil,
    }
  }

  return {
    status: 'upcoming',
    label: `Due ${formatDate(deadlineDate)}`,
    daysUntil,
  }
}

/**
 * Returns true if the deadline is within the next 48 hours.
 */
export function isDeadlineSoon(deadline: string | Date): boolean {
  const d = new Date(deadline)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  return diff < 48 * 60 * 60 * 1000 // 48 hours
}

/**
 * Returns true if the deadline has already passed.
 */
export function isDeadlinePast(deadline: string | Date): boolean {
  return new Date(deadline) < new Date()
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/**
 * Truncates a string to a maximum length, appending an ellipsis if needed.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Converts a decimal hours value to a "h:mm" formatted string.
 * @example hoursToHHMM(2.5) → "2:30"
 * @example hoursToHHMM(0.75) → "0:45"
 */
export function hoursToHHMM(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/**
 * Converts an "HH:MM" time string to decimal hours.
 * @example hhmmToHours("2:30") → 2.5
 */
export function hhmmToHours(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h + (m || 0) / 60
}

/**
 * Calculates hours between two "HH:MM" time strings (same day).
 * Returns 0 if end is before or equal to start.
 * @example calcHours("08:00", "10:30") → 2.5
 */
export function calcHours(timeIn: string, timeOut: string): number {
  const inMinutes = hhmmToHours(timeIn) * 60
  const outMinutes = hhmmToHours(timeOut) * 60
  const diff = outMinutes - inMinutes
  return diff > 0 ? Math.round(diff) / 60 : 0
}

/**
 * Returns initials from a full name string.
 * @example getInitials("Jane Doe") → "JD"
 * @example getInitials("John") → "JO"
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}
