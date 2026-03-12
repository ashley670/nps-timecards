// =============================================================================
// lib/csv/parse-pay-periods.ts
// Parses a CSV file containing pay period data using PapaParse.
// Expected columns: label, start_date, end_date, fiscal_year
// Optional columns: submit_deadline, default_offset_days
// =============================================================================

import Papa from 'papaparse'
import { parseISO, isValid, isBefore, isAfter } from 'date-fns'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayPeriodCsvRecord {
  /** 1-based row number in the source CSV (excluding header) */
  rowIndex: number
  label: string
  /** ISO date string: YYYY-MM-DD */
  start_date: string
  /** ISO date string: YYYY-MM-DD */
  end_date: string
  /** e.g. "2025" */
  fiscal_year: string
  /** ISO date string: YYYY-MM-DD (optional — admin can set per program) */
  submit_deadline: string | null
  /** Days after end_date for deadline calculation (default: 5) */
  default_offset_days: number
}

export interface PayPeriodCsvError {
  row: number
  field?: string
  message: string
}

export interface PayPeriodCsvParseResult {
  records: PayPeriodCsvRecord[]
  errors: PayPeriodCsvError[]
  totalRows: number
}

// ---------------------------------------------------------------------------
// Date validation helpers
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/**
 * Attempts to parse a date string in ISO (YYYY-MM-DD) or M/D/YYYY format.
 * Returns a normalized ISO string or null if invalid.
 */
function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim()

  if (ISO_DATE_RE.test(trimmed)) {
    const d = parseISO(trimmed)
    return isValid(d) ? trimmed : null
  }

  const slashMatch = trimmed.match(SLASH_DATE_RE)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const d = parseISO(iso)
    return isValid(d) ? iso : null
  }

  return null
}

/**
 * Derives fiscal year from a date if not explicitly provided.
 * NPS fiscal year runs July 1 – June 30; FY2025 = Jul 2024 – Jun 2025.
 */
function deriveFiscalYear(isoDate: string): string {
  const d = parseISO(isoDate)
  const month = d.getMonth() // 0-indexed: July = 6
  const year = d.getFullYear()
  return String(month >= 6 ? year + 1 : year)
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

function validateRow(
  raw: Record<string, string>,
  rowIndex: number
): { record: PayPeriodCsvRecord | null; errors: PayPeriodCsvError[] } {
  const errors: PayPeriodCsvError[] = []

  // Normalize keys
  const row: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    row[k.toLowerCase().trim().replace(/\s+/g, '_')] = typeof v === 'string' ? v.trim() : String(v ?? '').trim()
  }

  // --- label ---
  const label = row['label'] ?? row['pay_period_label'] ?? row['period_label'] ?? row['name'] ?? ''
  if (!label) {
    errors.push({ row: rowIndex, field: 'label', message: 'Label is required.' })
  }

  // --- start_date ---
  const rawStart = row['start_date'] ?? row['start'] ?? row['period_start'] ?? ''
  const startDate = rawStart ? normalizeDate(rawStart) : null
  if (!rawStart) {
    errors.push({ row: rowIndex, field: 'start_date', message: 'Start date is required.' })
  } else if (!startDate) {
    errors.push({
      row: rowIndex,
      field: 'start_date',
      message: `Invalid start date "${rawStart}". Expected YYYY-MM-DD or M/D/YYYY.`,
    })
  }

  // --- end_date ---
  const rawEnd = row['end_date'] ?? row['end'] ?? row['period_end'] ?? ''
  const endDate = rawEnd ? normalizeDate(rawEnd) : null
  if (!rawEnd) {
    errors.push({ row: rowIndex, field: 'end_date', message: 'End date is required.' })
  } else if (!endDate) {
    errors.push({
      row: rowIndex,
      field: 'end_date',
      message: `Invalid end date "${rawEnd}". Expected YYYY-MM-DD or M/D/YYYY.`,
    })
  }

  // --- date range sanity check ---
  if (startDate && endDate) {
    if (!isBefore(parseISO(startDate), parseISO(endDate))) {
      errors.push({
        row: rowIndex,
        field: 'end_date',
        message: `End date (${endDate}) must be after start date (${startDate}).`,
      })
    }
  }

  // --- fiscal_year ---
  let fiscalYear = row['fiscal_year'] ?? row['fiscal year'] ?? row['fy'] ?? ''
  if (!fiscalYear && startDate) {
    fiscalYear = deriveFiscalYear(startDate)
  }
  if (!fiscalYear) {
    errors.push({
      row: rowIndex,
      field: 'fiscal_year',
      message: 'Fiscal year is required and could not be derived from start_date.',
    })
  } else if (!/^\d{4}$/.test(fiscalYear)) {
    errors.push({
      row: rowIndex,
      field: 'fiscal_year',
      message: `Invalid fiscal year "${fiscalYear}". Expected a 4-digit year (e.g. 2025).`,
    })
  }

  // --- submit_deadline (optional) ---
  const rawDeadline = row['submit_deadline'] ?? row['deadline'] ?? row['submission_deadline'] ?? ''
  let submitDeadline: string | null = null
  if (rawDeadline) {
    submitDeadline = normalizeDate(rawDeadline)
    if (!submitDeadline) {
      errors.push({
        row: rowIndex,
        field: 'submit_deadline',
        message: `Invalid submit deadline "${rawDeadline}". Expected YYYY-MM-DD or M/D/YYYY.`,
      })
    }
  }

  // --- default_offset_days (optional) ---
  const rawOffset = row['default_offset_days'] ?? row['offset_days'] ?? row['offset'] ?? ''
  let defaultOffsetDays = 5 // sensible default
  if (rawOffset !== '') {
    const parsed = parseInt(rawOffset, 10)
    if (isNaN(parsed) || parsed < 0) {
      errors.push({
        row: rowIndex,
        field: 'default_offset_days',
        message: `Invalid offset days "${rawOffset}". Must be a non-negative integer.`,
      })
    } else {
      defaultOffsetDays = parsed
    }
  }

  if (errors.length > 0) {
    return { record: null, errors }
  }

  return {
    record: {
      rowIndex,
      label,
      start_date: startDate!,
      end_date: endDate!,
      fiscal_year: fiscalYear,
      submit_deadline: submitDeadline,
      default_offset_days: defaultOffsetDays,
    },
    errors: [],
  }
}

// ---------------------------------------------------------------------------
// Main parse function (string input)
// ---------------------------------------------------------------------------

/**
 * Parses a pay period CSV string and returns validated records plus any row-level errors.
 *
 * Expected columns (case-insensitive):
 *   - label             (required)
 *   - start_date        (required; YYYY-MM-DD or M/D/YYYY)
 *   - end_date          (required; YYYY-MM-DD or M/D/YYYY)
 *   - fiscal_year       (optional; derived from start_date if omitted)
 *   - submit_deadline   (optional)
 *   - default_offset_days (optional; integer, default: 5)
 *
 * @param csvString - Raw CSV content as a string
 * @returns PayPeriodCsvParseResult
 */
export function parsePayPeriodsCsv(csvString: string): PayPeriodCsvParseResult {
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, '_'),
  })

  const records: PayPeriodCsvRecord[] = []
  const errors: PayPeriodCsvError[] = []

  for (const err of result.errors) {
    errors.push({
      row: (err.row ?? 0) + 1,
      message: `CSV parse error: ${err.message}`,
    })
  }

  const data = result.data
  const totalRows = data.length

  for (let i = 0; i < data.length; i++) {
    const rowIndex = i + 1
    const { record, errors: rowErrors } = validateRow(data[i], rowIndex)
    if (record) {
      records.push(record)
    } else {
      errors.push(...rowErrors)
    }
  }

  return { records, errors, totalRows }
}

// ---------------------------------------------------------------------------
// Browser File input variant
// ---------------------------------------------------------------------------

/**
 * Parses a pay periods CSV from a browser File object.
 *
 * @param file - Browser File object
 * @returns Promise<PayPeriodCsvParseResult>
 */
export function parsePayPeriodsCsvFile(file: File): Promise<PayPeriodCsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, '_'),
      complete(result) {
        const records: PayPeriodCsvRecord[] = []
        const errors: PayPeriodCsvError[] = []

        for (const err of result.errors) {
          errors.push({
            row: (err.row ?? 0) + 1,
            message: `CSV parse error: ${err.message}`,
          })
        }

        const data = result.data
        const totalRows = data.length

        for (let i = 0; i < data.length; i++) {
          const rowIndex = i + 1
          const { record, errors: rowErrors } = validateRow(data[i], rowIndex)
          if (record) {
            records.push(record)
          } else {
            errors.push(...rowErrors)
          }
        }

        resolve({ records, errors, totalRows })
      },
      error(err) {
        resolve({
          records: [],
          errors: [{ row: 0, message: `Failed to parse file: ${err.message}` }],
          totalRows: 0,
        })
      },
    })
  })
}

// ---------------------------------------------------------------------------
// Duplicate label detection
// ---------------------------------------------------------------------------

/**
 * Finds duplicate pay period labels within a parsed record set.
 */
export function findDuplicateLabels(records: PayPeriodCsvRecord[]): PayPeriodCsvError[] {
  const seen = new Map<string, number>()
  const duplicates: PayPeriodCsvError[] = []

  for (const record of records) {
    const key = record.label.toLowerCase().trim()
    if (seen.has(key)) {
      duplicates.push({
        row: record.rowIndex,
        field: 'label',
        message: `Duplicate label "${record.label}" — first seen on row ${seen.get(key)}.`,
      })
    } else {
      seen.set(key, record.rowIndex)
    }
  }

  return duplicates
}

// ---------------------------------------------------------------------------
// Overlap detection
// ---------------------------------------------------------------------------

/**
 * Checks parsed records for date range overlaps.
 * Returns an error for each record that overlaps with an earlier record.
 */
export function findOverlappingPayPeriods(records: PayPeriodCsvRecord[]): PayPeriodCsvError[] {
  const errors: PayPeriodCsvError[] = []

  for (let i = 0; i < records.length; i++) {
    const a = records[i]
    const aStart = parseISO(a.start_date)
    const aEnd = parseISO(a.end_date)

    for (let j = i + 1; j < records.length; j++) {
      const b = records[j]
      const bStart = parseISO(b.start_date)
      const bEnd = parseISO(b.end_date)

      // Ranges [aStart, aEnd] and [bStart, bEnd] overlap if aStart <= bEnd && bStart <= aEnd
      if (!isAfter(aStart, bEnd) && !isAfter(bStart, aEnd)) {
        errors.push({
          row: b.rowIndex,
          message: `Pay period "${b.label}" (row ${b.rowIndex}) overlaps with "${a.label}" (row ${a.rowIndex}).`,
        })
      }
    }
  }

  return errors
}
