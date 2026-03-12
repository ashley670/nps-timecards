// =============================================================================
// lib/csv/parse-staff.ts
// Parses a CSV file containing staff member data using PapaParse.
// Expected columns: full_name, email, address (optional), school
// =============================================================================

import Papa from 'papaparse'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaffCsvRow {
  full_name: string
  email: string
  address: string
  school: string
}

export interface StaffCsvRecord {
  /** 1-based row number in the source CSV (excluding header) */
  rowIndex: number
  full_name: string
  email: string
  address: string
  school: string
}

export interface StaffCsvParseResult {
  records: StaffCsvRecord[]
  errors: StaffCsvError[]
  /** Total number of data rows attempted (excluding header) */
  totalRows: number
}

export interface StaffCsvError {
  /** 1-based row number in the CSV (excluding header) */
  row: number
  field?: string
  message: string
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRow(
  raw: Record<string, string>,
  rowIndex: number
): { record: StaffCsvRecord | null; errors: StaffCsvError[] } {
  const errors: StaffCsvError[] = []

  // Normalize keys to lowercase and trim whitespace
  const row: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    row[k.toLowerCase().trim()] = typeof v === 'string' ? v.trim() : String(v ?? '').trim()
  }

  const fullName = row['full_name'] ?? row['name'] ?? row['full name'] ?? ''
  const email = row['email'] ?? row['email_address'] ?? row['email address'] ?? ''
  const address = row['address'] ?? row['home_address'] ?? row['home address'] ?? ''
  const school = row['school'] ?? row['school_name'] ?? row['school name'] ?? ''

  if (!fullName) {
    errors.push({ row: rowIndex, field: 'full_name', message: 'Full name is required.' })
  }

  if (!email) {
    errors.push({ row: rowIndex, field: 'email', message: 'Email address is required.' })
  } else if (!EMAIL_RE.test(email)) {
    errors.push({ row: rowIndex, field: 'email', message: `Invalid email address: "${email}".` })
  }

  if (!school) {
    errors.push({ row: rowIndex, field: 'school', message: 'School is required.' })
  }

  if (errors.length > 0) {
    return { record: null, errors }
  }

  return {
    record: {
      rowIndex,
      full_name: fullName,
      email: email.toLowerCase(),
      address,
      school,
    },
    errors: [],
  }
}

// ---------------------------------------------------------------------------
// Main parse function (string input — already read from file)
// ---------------------------------------------------------------------------

/**
 * Parses a staff CSV string and returns validated records plus any row-level errors.
 *
 * Expected columns (case-insensitive, trimmed):
 *   - full_name  (or "name")
 *   - email      (or "email_address")
 *   - school     (or "school_name")
 *   - address    (optional; or "home_address")
 *
 * Rows with validation errors are excluded from `records` and reported in `errors`.
 *
 * @param csvString - Raw CSV content as a string
 * @returns StaffCsvParseResult with records, errors, and total row count
 */
export function parseStaffCsv(csvString: string): StaffCsvParseResult {
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.toLowerCase().trim(),
  })

  const records: StaffCsvRecord[] = []
  const errors: StaffCsvError[] = []

  // Surface PapaParse structural errors
  for (const err of result.errors) {
    errors.push({
      row: (err.row ?? 0) + 1,
      message: `CSV parse error: ${err.message}`,
    })
  }

  const data = result.data
  const totalRows = data.length

  for (let i = 0; i < data.length; i++) {
    const rowIndex = i + 1 // 1-based
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
// Browser File input variant (accepts a File object, returns a Promise)
// ---------------------------------------------------------------------------

/**
 * Parses a staff CSV from a browser File object.
 * Wraps PapaParse's streaming file parser in a Promise.
 *
 * @param file - Browser File object from an <input type="file"> element
 * @returns Promise<StaffCsvParseResult>
 */
export function parseStaffCsvFile(file: File): Promise<StaffCsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
      complete(result) {
        const records: StaffCsvRecord[] = []
        const errors: StaffCsvError[] = []

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
// Duplicate email detection
// ---------------------------------------------------------------------------

/**
 * Finds duplicate email addresses within a parsed staff record set.
 * Returns an array of errors for each duplicate occurrence (2nd+ appearance).
 */
export function findDuplicateEmails(records: StaffCsvRecord[]): StaffCsvError[] {
  const seen = new Map<string, number>() // email → first rowIndex
  const duplicates: StaffCsvError[] = []

  for (const record of records) {
    const email = record.email.toLowerCase()
    if (seen.has(email)) {
      duplicates.push({
        row: record.rowIndex,
        field: 'email',
        message: `Duplicate email "${record.email}" — first seen on row ${seen.get(email)}.`,
      })
    } else {
      seen.set(email, record.rowIndex)
    }
  }

  return duplicates
}
