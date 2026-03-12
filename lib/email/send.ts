// =============================================================================
// lib/email/send.ts
// Email sending functions for all NPS Timecards notification templates.
// Uses SendGrid's @sendgrid/mail library with inline HTML bodies.
// =============================================================================

import { getSendGridClient, getFromEmail, FROM_NAME } from './sendgrid'
import { format, parseISO } from 'date-fns'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDeadline(deadline: string | Date): string {
  try {
    const d = typeof deadline === 'string' ? parseISO(deadline) : deadline
    return format(d, 'MMMM d, yyyy')
  } catch {
    return String(deadline)
  }
}

const baseStyles = `
  body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, Helvetica, sans-serif; }
  .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 24px 0; }
  .card { background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .header { background-color: #1a5276; padding: 28px 32px; }
  .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
  .header p { margin: 4px 0 0; color: #aed6f1; font-size: 13px; }
  .body { padding: 32px; color: #1c1c1e; font-size: 15px; line-height: 1.6; }
  .body p { margin: 0 0 16px; }
  .body p:last-child { margin-bottom: 0; }
  .detail-box { background: #f0f4f8; border-left: 4px solid #1a5276; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
  .detail-box p { margin: 0 0 8px; font-size: 14px; }
  .detail-box p:last-child { margin: 0; }
  .detail-label { font-weight: 600; color: #4a5568; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; display: block; margin-bottom: 2px; }
  .detail-value { color: #1a202c; font-size: 15px; }
  .btn { display: inline-block; margin-top: 24px; padding: 13px 28px; background-color: #1a5276; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; }
  .footer { padding: 20px 32px; border-top: 1px solid #e2e8f0; background: #fafafa; }
  .footer p { margin: 0; font-size: 12px; color: #718096; line-height: 1.5; }
  .reason-box { background: #fff8e1; border-left: 4px solid #f6ad55; border-radius: 4px; padding: 16px 20px; margin: 20px 0; font-size: 14px; }
  .reason-box strong { display: block; margin-bottom: 6px; color: #744210; }
`

function buildHtmlEmail(title: string, preheader: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>Norwich Public Schools</h1>
        <p>Timecard Management System</p>
      </div>
      <div class="body">
        ${bodyContent}
      </div>
      <div class="footer">
        <p>This is an automated message from the Norwich Public Schools Timecard System. Please do not reply to this email.</p>
        <p style="margin-top:8px;">Norwich Public Schools &bull; 90 Town Street, Norwich, CT 06360</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  const sg = getSendGridClient()
  const from = getFromEmail()

  await sg.send({
    to: params.to,
    from: { email: from, name: FROM_NAME },
    subject: params.subject,
    html: params.html,
    text: params.text,
  })
}

// ---------------------------------------------------------------------------
// 1. Staff: Added to a Program
// ---------------------------------------------------------------------------

/**
 * Notifies a staff member that they have been added to a program.
 */
export async function sendStaffProgramAdded(
  to: string,
  programName: string,
  loginUrl: string
): Promise<void> {
  const subject = `You've been added to ${programName}`

  const bodyContent = `
    <p>Hello,</p>
    <p>You have been added as a staff member to the following NPS program:</p>
    <div class="detail-box">
      <p><span class="detail-label">Program</span><span class="detail-value">${programName}</span></p>
    </div>
    <p>You can now log in to submit your timecards for this program. Please make sure to submit your timecard before each pay period deadline.</p>
    <a href="${loginUrl}" class="btn">Log In to Timecards</a>
    <p style="margin-top:24px;">If you have any questions, please contact your program administrator.</p>
  `

  const text = `You've been added to ${programName}\n\nYou have been added as a staff member to the NPS program: ${programName}.\n\nLog in to submit your timecards: ${loginUrl}`

  await sendEmail({ to, subject, html: buildHtmlEmail(subject, subject, bodyContent), text })
}

// ---------------------------------------------------------------------------
// 2. Signee: Added to a Program
// ---------------------------------------------------------------------------

/**
 * Notifies a signee that they have been assigned to a program.
 */
export async function sendSigneeProgramAdded(
  to: string,
  programName: string,
  loginUrl: string
): Promise<void> {
  const subject = `You've been assigned to sign timecards for ${programName}`

  const bodyContent = `
    <p>Hello,</p>
    <p>You have been designated as a timecard signee for the following NPS program:</p>
    <div class="detail-box">
      <p><span class="detail-label">Program</span><span class="detail-value">${programName}</span></p>
    </div>
    <p>As a signee, you will receive notifications when staff members submit timecards for your review and signature. Please sign timecards promptly to ensure staff are paid on time.</p>
    <a href="${loginUrl}" class="btn">Log In to Timecards</a>
    <p style="margin-top:24px;">If you have any questions, please contact the district administrator.</p>
  `

  const text = `You've been assigned to sign timecards for ${programName}\n\nYou are now a timecard signee for: ${programName}.\n\nLog in here: ${loginUrl}`

  await sendEmail({ to, subject, html: buildHtmlEmail(subject, subject, bodyContent), text })
}

// ---------------------------------------------------------------------------
// 3. Signee: Timecard Submitted — Needs Signature
// ---------------------------------------------------------------------------

/**
 * Notifies a signee that a staff member has submitted a timecard awaiting signature.
 */
export async function sendSigneeTimecardSubmitted(
  to: string,
  staffName: string,
  programName: string,
  payPeriodLabel: string,
  signUrl: string
): Promise<void> {
  const subject = `Timecard submitted by ${staffName} — signature required`

  const bodyContent = `
    <p>Hello,</p>
    <p>A timecard has been submitted and requires your signature:</p>
    <div class="detail-box">
      <p><span class="detail-label">Staff Member</span><span class="detail-value">${staffName}</span></p>
      <p><span class="detail-label">Program</span><span class="detail-value">${programName}</span></p>
      <p><span class="detail-label">Pay Period</span><span class="detail-value">${payPeriodLabel}</span></p>
    </div>
    <p>Please review and sign this timecard at your earliest convenience to ensure the staff member is paid on schedule.</p>
    <a href="${signUrl}" class="btn">Review &amp; Sign Timecard</a>
    <p style="margin-top:24px;">You can also access all pending timecards from your dashboard after logging in.</p>
  `

  const text = `Timecard submitted by ${staffName} — signature required\n\nStaff: ${staffName}\nProgram: ${programName}\nPay Period: ${payPeriodLabel}\n\nReview and sign: ${signUrl}`

  await sendEmail({ to, subject, html: buildHtmlEmail(subject, subject, bodyContent), text })
}

// ---------------------------------------------------------------------------
// 4. Staff: Timecard Signed
// ---------------------------------------------------------------------------

/**
 * Notifies a staff member that their timecard has been signed by the signee.
 */
export async function sendStaffTimecardSigned(
  to: string,
  programName: string,
  payPeriodLabel: string,
  signeeName: string
): Promise<void> {
  const subject = `Your timecard has been signed — ${payPeriodLabel}`

  const bodyContent = `
    <p>Hello,</p>
    <p>Good news! Your timecard has been reviewed and signed:</p>
    <div class="detail-box">
      <p><span class="detail-label">Program</span><span class="detail-value">${programName}</span></p>
      <p><span class="detail-label">Pay Period</span><span class="detail-value">${payPeriodLabel}</span></p>
      <p><span class="detail-label">Signed By</span><span class="detail-value">${signeeName}</span></p>
    </div>
    <p>Your timecard has been approved and submitted for processing. A PDF copy has been saved to your account for your records.</p>
    <p>If you believe there is an error, you can request a reopen through your dashboard.</p>
  `

  const text = `Your timecard has been signed — ${payPeriodLabel}\n\nProgram: ${programName}\nPay Period: ${payPeriodLabel}\nSigned by: ${signeeName}\n\nYour timecard has been approved for processing.`

  await sendEmail({ to, subject, html: buildHtmlEmail(subject, subject, bodyContent), text })
}

// ---------------------------------------------------------------------------
// 5. Signee: Reopen Request Received
// ---------------------------------------------------------------------------

/**
 * Notifies a signee that a staff member has requested their signed timecard be reopened.
 */
export async function sendSigneeReopenRequest(
  to: string,
  staffName: string,
  programName: string,
  payPeriodLabel: string,
  reason: string,
  approveUrl: string
): Promise<void> {
  const subject = `Reopen request from ${staffName} — ${payPeriodLabel}`

  const bodyContent = `
    <p>Hello,</p>
    <p>A staff member has requested that their signed timecard be reopened for editing:</p>
    <div class="detail-box">
      <p><span class="detail-label">Staff Member</span><span class="detail-value">${staffName}</span></p>
      <p><span class="detail-label">Program</span><span class="detail-value">${programName}</span></p>
      <p><span class="detail-label">Pay Period</span><span class="detail-value">${payPeriodLabel}</span></p>
    </div>
    <div class="reason-box">
      <strong>Reason provided:</strong>
      ${reason}
    </div>
    <p>Please review the request and approve or deny it from your dashboard.</p>
    <a href="${approveUrl}" class="btn">Review Reopen Request</a>
    <p style="margin-top:24px;">If you approve, the staff member will be able to edit and resubmit their timecard. If you deny, the original signed timecard will remain in place.</p>
  `

  const text = `Reopen request from ${staffName} — ${payPeriodLabel}\n\nStaff: ${staffName}\nProgram: ${programName}\nPay Period: ${payPeriodLabel}\nReason: ${reason}\n\nReview the request: ${approveUrl}`

  await sendEmail({ to, subject, html: buildHtmlEmail(subject, subject, bodyContent), text })
}

// ---------------------------------------------------------------------------
// 6. Staff: Reopen Approved
// ---------------------------------------------------------------------------

/**
 * Notifies a staff member that their reopen request has been approved.
 */
export async function sendStaffReopenApproved(
  to: string,
  programName: string,
  payPeriodLabel: string,
  loginUrl: string
): Promise<void> {
  const subject = `Reopen request approved — ${payPeriodLabel}`

  const bodyContent = `
    <p>Hello,</p>
    <p>Your reopen request has been approved. You can now edit and resubmit your timecard:</p>
    <div class="detail-box">
      <p><span class="detail-label">Program</span><span class="detail-value">${programName}</span></p>
      <p><span class="detail-label">Pay Period</span><span class="detail-value">${payPeriodLabel}</span></p>
    </div>
    <p>Please log in, make your corrections, and resubmit your timecard as soon as possible. Once resubmitted, your signee will need to review and sign it again.</p>
    <a href="${loginUrl}" class="btn">Edit &amp; Resubmit Timecard</a>
    <p style="margin-top:24px;">Please note that the original signed copy has been replaced. If you have any questions, contact your program administrator.</p>
  `

  const text = `Reopen request approved — ${payPeriodLabel}\n\nProgram: ${programName}\nPay Period: ${payPeriodLabel}\n\nYour reopen request has been approved. Log in to edit and resubmit: ${loginUrl}`

  await sendEmail({ to, subject, html: buildHtmlEmail(subject, subject, bodyContent), text })
}

// ---------------------------------------------------------------------------
// 7. Staff: Reopen Denied
// ---------------------------------------------------------------------------

/**
 * Notifies a staff member that their reopen request has been denied.
 */
export async function sendStaffReopenDenied(
  to: string,
  programName: string,
  payPeriodLabel: string
): Promise<void> {
  const subject = `Reopen request denied — ${payPeriodLabel}`

  const bodyContent = `
    <p>Hello,</p>
    <p>Your request to reopen the following timecard has been denied:</p>
    <div class="detail-box">
      <p><span class="detail-label">Program</span><span class="detail-value">${programName}</span></p>
      <p><span class="detail-label">Pay Period</span><span class="detail-value">${payPeriodLabel}</span></p>
    </div>
    <p>The original signed timecard remains in effect and will be processed as submitted.</p>
    <p>If you believe this decision was made in error, please contact your program administrator or signee directly to discuss the matter.</p>
  `

  const text = `Reopen request denied — ${payPeriodLabel}\n\nProgram: ${programName}\nPay Period: ${payPeriodLabel}\n\nYour reopen request has been denied. The original signed timecard will be processed as submitted. Please contact your administrator if you have questions.`

  await sendEmail({ to, subject, html: buildHtmlEmail(subject, subject, bodyContent), text })
}

// ---------------------------------------------------------------------------
// 8. Signee: Pending Timecards Reminder
// ---------------------------------------------------------------------------

/**
 * Sends a reminder to a signee about pending timecards awaiting their signature.
 */
export async function sendSigneeReminder(
  to: string,
  pendingCount: number,
  deadline: string | Date,
  signUrl: string
): Promise<void> {
  const formattedDeadline = formatDeadline(deadline)
  const subject = `Reminder: ${pendingCount} timecard${pendingCount !== 1 ? 's' : ''} awaiting your signature`

  const bodyContent = `
    <p>Hello,</p>
    <p>This is a reminder that you have timecards waiting for your signature:</p>
    <div class="detail-box">
      <p><span class="detail-label">Pending Timecards</span><span class="detail-value">${pendingCount} timecard${pendingCount !== 1 ? 's' : ''}</span></p>
      <p><span class="detail-label">Deadline</span><span class="detail-value">${formattedDeadline}</span></p>
    </div>
    <p>Please sign these timecards before the deadline to ensure staff members receive timely payment. Unsigned timecards may delay payroll processing.</p>
    <a href="${signUrl}" class="btn">Review Pending Timecards</a>
    <p style="margin-top:24px;">You can view all pending timecards from your signee dashboard after logging in.</p>
  `

  const text = `Reminder: ${pendingCount} timecard${pendingCount !== 1 ? 's' : ''} awaiting your signature\n\nPending: ${pendingCount} timecard${pendingCount !== 1 ? 's' : ''}\nDeadline: ${formattedDeadline}\n\nSign timecards here: ${signUrl}`

  await sendEmail({ to, subject, html: buildHtmlEmail(subject, subject, bodyContent), text })
}
