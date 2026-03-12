// =============================================================================
// lib/pdf/generate-batch.ts
// Batch PDF generation for admin reports using @react-pdf/renderer.
// Produces a multi-page PDF with cover page, optional divider pages,
// and one full timecard per included timecard record.
// =============================================================================

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { TimecardDetail } from '@/types/app.types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BatchPdfOptions {
  /** Main heading shown on the cover page */
  title: string
  /** Optional subtitle (pay period label, program name, staff name, etc.) */
  subtitle?: string
  timecards: TimecardDetail[]
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 45,
  },
  // Cover page
  coverPage: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
    paddingTop: 80,
    paddingBottom: 50,
    paddingHorizontal: 60,
    justifyContent: 'flex-start',
  },
  coverOrg: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#1a3a5c',
    textAlign: 'center',
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  coverMeta: {
    fontSize: 9,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
  },
  coverDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    marginVertical: 24,
  },
  coverTocHeader: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 8,
  },
  coverTocRow: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 4,
  },
  // Divider page
  dividerPage: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
    paddingTop: 100,
    paddingBottom: 50,
    paddingHorizontal: 60,
    backgroundColor: '#f3f4f6',
  },
  dividerLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  dividerTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1a3a5c',
    marginBottom: 8,
  },
  dividerMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  // Timecard page header
  tcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#1a3a5c',
    paddingBottom: 10,
    marginBottom: 12,
  },
  tcOrg: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1a3a5c',
  },
  tcDocTitle: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // Info grid
  infoGrid: {
    flexDirection: 'row',
    backgroundColor: '#e8eef4',
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
    gap: 16,
  },
  infoCell: { flex: 1 },
  infoLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' },
  infoValueNormal: { fontSize: 9, color: '#111827' },
  // Staff block
  staffBlock: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  staffCell: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#d1d5db',
  },
  staffCellLast: { flex: 2, padding: 8 },
  staffLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  staffValue: { fontSize: 9, color: '#111827' },
  // Section label
  sectionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 2,
  },
  // Table
  table: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    minHeight: 20,
  },
  tableRowAlt: { backgroundColor: '#f9fafb' },
  tableRowLast: { borderBottomWidth: 0 },
  colDate: { width: '32%', padding: '4 6' },
  colIn:   { width: '20%', padding: '4 6', borderLeftWidth: 1, borderLeftColor: '#d1d5db' },
  colOut:  { width: '20%', padding: '4 6', borderLeftWidth: 1, borderLeftColor: '#d1d5db' },
  colHrs:  { width: '13%', padding: '4 6', borderLeftWidth: 1, borderLeftColor: '#d1d5db', alignItems: 'flex-end' },
  colEmpty:{ flex: 1,       padding: '4 6', borderLeftWidth: 1, borderLeftColor: '#d1d5db' },
  thText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tdText: { fontSize: 8, color: '#111827' },
  tdTextRight: { fontSize: 8, color: '#111827', textAlign: 'right' },
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: '#1a3a5c',
    minHeight: 22,
  },
  totalsLabel: { width: '72%', padding: '5 6', alignItems: 'flex-end' },
  totalsValue: { width: '13%', padding: '5 6', alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: '#3b5c8a' },
  totalsEmpty: { flex: 1, padding: '5 6', borderLeftWidth: 1, borderLeftColor: '#3b5c8a' },
  totalsLabelText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff', textTransform: 'uppercase' },
  totalsValueText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff', textAlign: 'right' },
  // Signatures
  sigRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  sigBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    overflow: 'hidden',
  },
  sigHeader: {
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    padding: '5 8',
  },
  sigHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sigBody: { padding: 10, backgroundColor: '#fafafa', minHeight: 48 },
  sigNameLabel: { fontSize: 7, color: '#6b7280', marginBottom: 3 },
  sigName: { fontSize: 11, fontFamily: 'Helvetica-Oblique', color: '#1a3a5c', marginBottom: 4 },
  sigTimestamp: { fontSize: 7, color: '#6b7280' },
  sigPending: { fontSize: 8, fontFamily: 'Helvetica-Oblique', color: '#9ca3af', marginTop: 6 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 45,
    right: 45,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: { fontSize: 7, color: '#9ca3af' },
})

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function fmtDateShort(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function fmtTime(t: string): string {
  try {
    const [hStr, mStr] = t.split(':')
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  } catch { return t }
}

function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch { return iso }
}

// ---------------------------------------------------------------------------
// Component helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function e(type: any, props: any, ...children: any[]) {
  return React.createElement(type, props, ...children)
}

function CoverPage({ title, subtitle, timecards, generatedAt }: {
  title: string
  subtitle?: string
  timecards: TimecardDetail[]
  generatedAt: string
}) {
  return e(Page, { size: 'LETTER', style: S.coverPage },
    e(Text, { style: S.coverOrg }, 'Norwich Public Schools'),
    e(Text, { style: S.coverTitle }, title),
    subtitle ? e(Text, { style: S.coverSubtitle }, subtitle) : null,
    e(Text, { style: S.coverMeta }, `Generated: ${generatedAt}  ·  Total timecards: ${timecards.length}`),
    e(View, { style: S.coverDivider }),
    e(Text, { style: S.coverTocHeader }, 'Timecards Included:'),
    ...timecards.map((tc, i) =>
      e(Text, { key: String(i), style: S.coverTocRow },
        `${i + 1}.  ${tc.staff.full_name}  —  ${tc.program.name}  —  ${tc.pay_period.label}`
      )
    ),
    Footer({ generatedAt })
  )
}

function DividerPage({ label, title, meta }: { label: string; title: string; meta?: string }) {
  return e(Page, { size: 'LETTER', style: S.dividerPage },
    e(Text, { style: S.dividerLabel }, label),
    e(Text, { style: S.dividerTitle }, title),
    meta ? e(Text, { style: S.dividerMeta }, meta) : null,
  )
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return e(View, { style: S.footer, fixed: true },
    e(Text, { style: S.footerText }, 'Norwich Public Schools Timesheet System'),
    e(Text, {
      style: S.footerText,
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `Page ${pageNumber} of ${totalPages}`,
    })
  )
}

function TimecardPage({ tc, generatedAt }: { tc: TimecardDetail; generatedAt: string }) {
  const totalHours = (tc.timecard_entries ?? []).reduce(
    (sum: number, entry) => sum + (Number(entry.total_hours) || 0), 0
  )

  return e(Page, { size: 'LETTER', style: S.page },
    // Header
    e(View, { style: S.tcHeader },
      e(View, null,
        e(Text, { style: S.tcOrg }, 'Norwich Public Schools'),
        e(Text, { style: S.tcDocTitle }, 'Employee Timecard')
      )
    ),
    // Info grid
    e(View, { style: S.infoGrid },
      e(View, { style: S.infoCell },
        e(Text, { style: S.infoLabel }, 'Program'),
        e(Text, { style: S.infoValue }, tc.program.name)
      ),
      e(View, { style: S.infoCell },
        e(Text, { style: S.infoLabel }, 'Account #'),
        e(Text, { style: S.infoValueNormal }, tc.program.account_number)
      ),
      e(View, { style: S.infoCell },
        e(Text, { style: S.infoLabel }, 'Pay Period'),
        e(Text, { style: S.infoValueNormal }, tc.pay_period.label)
      ),
      e(View, { style: S.infoCell },
        e(Text, { style: S.infoLabel }, 'Dates'),
        e(Text, { style: S.infoValueNormal },
          `${fmtDateShort(tc.pay_period.start_date)} – ${fmtDateShort(tc.pay_period.end_date)}`
        )
      )
    ),
    // Staff block
    e(Text, { style: S.sectionLabel }, 'Staff Information'),
    e(View, { style: S.staffBlock },
      e(View, { style: S.staffCell },
        e(Text, { style: S.staffLabel }, 'Name'),
        e(Text, { style: S.staffValue }, tc.staff.full_name)
      ),
      e(View, { style: S.staffCellLast },
        e(Text, { style: S.staffLabel }, 'Address'),
        e(Text, { style: S.staffValue }, tc.staff.address || '—')
      )
    ),
    // Hours table
    e(Text, { style: S.sectionLabel }, 'Hours Worked'),
    e(View, { style: S.table },
      e(View, { style: S.tableHeaderRow },
        e(View, { style: S.colDate }, e(Text, { style: S.thText }, 'Date')),
        e(View, { style: S.colIn   }, e(Text, { style: S.thText }, 'Time In')),
        e(View, { style: S.colOut  }, e(Text, { style: S.thText }, 'Time Out')),
        e(View, { style: S.colHrs  }, e(Text, { style: S.thText }, 'Hours')),
        e(View, { style: S.colEmpty })
      ),
      ...(tc.timecard_entries ?? []).map((entry, idx) =>
        e(View, {
          key: String(idx),
          style: [
            S.tableRow,
            idx % 2 === 1 ? S.tableRowAlt : {},
            idx === (tc.timecard_entries?.length ?? 0) - 1 ? S.tableRowLast : {},
          ],
        },
          e(View, { style: S.colDate  }, e(Text, { style: S.tdText }, fmtDate(entry.work_date))),
          e(View, { style: S.colIn    }, e(Text, { style: S.tdText }, fmtTime(entry.time_in))),
          e(View, { style: S.colOut   }, e(Text, { style: S.tdText }, fmtTime(entry.time_out))),
          e(View, { style: S.colHrs   }, e(Text, { style: S.tdTextRight }, Number(entry.total_hours).toFixed(2))),
          e(View, { style: S.colEmpty })
        )
      ),
      e(View, { style: S.totalsRow },
        e(View, { style: S.totalsLabel  }, e(Text, { style: S.totalsLabelText }, 'Total Hours')),
        e(View, { style: S.totalsValue  }, e(Text, { style: S.totalsValueText }, totalHours.toFixed(2))),
        e(View, { style: S.totalsEmpty })
      )
    ),
    // Signatures
    e(Text, { style: S.sectionLabel }, 'Signatures'),
    e(View, { style: S.sigRow },
      e(View, { style: S.sigBox },
        e(View, { style: S.sigHeader },
          e(Text, { style: S.sigHeaderText }, 'Employee Signature')
        ),
        e(View, { style: S.sigBody },
          tc.staff_signature
            ? e(React.Fragment, null,
                e(Text, { style: S.sigNameLabel }, 'Signed electronically as:'),
                e(Text, { style: S.sigName }, tc.staff_signature),
                e(Text, { style: S.sigTimestamp }, fmtTimestamp(tc.staff_signed_at))
              )
            : e(Text, { style: S.sigPending }, 'Signature pending')
        )
      ),
      e(View, { style: S.sigBox },
        e(View, { style: S.sigHeader },
          e(Text, { style: S.sigHeaderText }, 'Authorized Signee Signature')
        ),
        e(View, { style: S.sigBody },
          tc.signee_signature
            ? e(React.Fragment, null,
                e(Text, { style: S.sigNameLabel },
                  tc.signee ? `Signed by ${tc.signee.full_name} as:` : 'Signed electronically as:'
                ),
                e(Text, { style: S.sigName }, tc.signee_signature),
                e(Text, { style: S.sigTimestamp }, fmtTimestamp(tc.signee_signed_at))
              )
            : e(Text, { style: S.sigPending }, 'Awaiting signee signature')
        )
      )
    ),
    Footer({ generatedAt })
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generates a batch PDF report for a set of timecards.
 * Returns a Buffer ready for HTTP streaming.
 */
export async function generateBatchPdf(options: BatchPdfOptions): Promise<Buffer> {
  const { title, subtitle, timecards } = options
  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  const pages: React.ReactElement[] = [
    CoverPage({ title, subtitle, timecards, generatedAt }) as React.ReactElement,
  ]

  // Group timecards by program for divider pages
  const byProgram = new Map<string, TimecardDetail[]>()
  for (const tc of timecards) {
    const key = tc.program.id
    if (!byProgram.has(key)) byProgram.set(key, [])
    byProgram.get(key)!.push(tc)
  }

  if (byProgram.size > 1) {
    // Multiple programs: add divider between each
    for (const [, group] of Array.from(byProgram)) {
      const prog = group[0].program
      pages.push(
        DividerPage({
          label: 'Program',
          title: prog.name,
          meta: `Account: ${prog.account_number}  ·  ${group.length} timecard(s)`,
        }) as React.ReactElement
      )
      for (const tc of group) {
        pages.push(TimecardPage({ tc, generatedAt }) as React.ReactElement)
      }
    }
  } else {
    // Single program or no grouping needed
    for (const tc of timecards) {
      pages.push(TimecardPage({ tc, generatedAt }) as React.ReactElement)
    }
  }

  const doc = React.createElement(
    Document,
    {
      title,
      author: 'Norwich Public Schools Timesheet System',
    },
    ...pages
  )

  const buffer = await renderToBuffer(doc)
  return Buffer.from(buffer)
}
