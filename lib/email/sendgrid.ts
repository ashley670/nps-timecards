import sgMail from '@sendgrid/mail'

let initialized = false

/**
 * Returns the configured SendGrid mail client.
 * Initializes the client lazily on first call using the SENDGRID_API_KEY
 * environment variable.
 *
 * Throws if SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is not set.
 */
export function getSendGridClient(): typeof sgMail {
  if (!initialized) {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) {
      throw new Error('Missing environment variable: SENDGRID_API_KEY')
    }
    sgMail.setApiKey(apiKey)
    initialized = true
  }
  return sgMail
}

/**
 * The verified sender email address used as the "from" address for all
 * outgoing emails. Must be a verified sender identity in SendGrid.
 */
export function getFromEmail(): string {
  const from = process.env.SENDGRID_FROM_EMAIL
  if (!from) {
    throw new Error('Missing environment variable: SENDGRID_FROM_EMAIL')
  }
  return from
}

/**
 * The display name used in the "from" field of all outgoing emails.
 */
export const FROM_NAME = 'Norwich Public Schools Timecards'

export default getSendGridClient
