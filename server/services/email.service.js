/**
 * email.service.js
 *
 * Transactional email. Two providers, chosen at runtime:
 *   - RESEND_API_KEY  → Resend HTTP API (uses the already-installed axios)
 *   - SMTP_HOST       → node mailer, loaded dynamically so nodemailer stays an
 *                       optional dependency instead of a hard requirement
 *
 * Nothing here throws: a failed delivery returns { ok:false, reason } and is
 * logged, so a caller never reports "sent" when the provider refused.
 */

import axios from 'axios'
import logger from '../config/logger.js'

const FROM = process.env.EMAIL_FROM || 'Nexthire <no-reply@nexthire.app>'
const REPLY_TO = process.env.EMAIL_REPLY_TO || undefined

export const isEmailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST)

export const emailMode = () => {
  if (process.env.RESEND_API_KEY) return 'resend'
  if (process.env.SMTP_HOST) return 'smtp'
  return 'disabled'
}

const sendViaResend = async ({ to, subject, html, text }) => {
  const { data } = await axios.post(
    'https://api.resend.com/emails',
    { from: FROM, to: [to], subject, html, text, ...(REPLY_TO && { reply_to: REPLY_TO }) },
    {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    }
  )
  return { id: data?.id }
}

const sendViaSmtp = async ({ to, subject, html, text }) => {
  let nodemailer
  try {
    nodemailer = (await import('nodemailer')).default
  } catch {
    const err = new Error('SMTP configured but the nodemailer package is not installed')
    err.code = 'SMTP_TRANSPORT_MISSING'
    throw err
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })

  const info = await transport.sendMail({ from: FROM, to, subject, html, text, replyTo: REPLY_TO })
  return { id: info?.messageId }
}

/**
 * @returns {Promise<{ok:boolean, id?:string, reason?:string}>}
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!to || !subject || (!html && !text)) {
    return { ok: false, reason: 'invalid_message' }
  }

  const mode = emailMode()
  if (mode === 'disabled') {
    logger.warn('[Email] No transport configured — message not sent', { subject })
    return { ok: false, reason: 'not_configured' }
  }

  try {
    const result = mode === 'resend'
      ? await sendViaResend({ to, subject, html, text })
      : await sendViaSmtp({ to, subject, html, text })

    logger.info('[Email] Delivered', { mode, subject, id: result?.id || null })
    return { ok: true, id: result?.id }
  } catch (err) {
    logger.error('[Email] Delivery failed', {
      mode,
      subject,
      error: err.message,
      code: err.code || err.response?.status,
    })
    return { ok: false, reason: 'delivery_failed' }
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

const layout = (title, body) => `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 16px;font-size:20px">${title}</h2>
  ${body}
  <p style="margin-top:28px;font-size:12px;color:#64748b">Nexthire — AI-powered technical hiring</p>
</div>`

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const buildPasswordResetEmail = ({ name, resetUrl }) => ({
  subject: 'Reset your Nexthire password',
  html: layout('Reset your password', `
    <p>Hi ${escapeHtml(name || 'there')},</p>
    <p>We received a request to reset your password. This link expires in one hour and can only be used once.</p>
    <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Choose a new password</a></p>
    <p style="font-size:13px;color:#475569">If you did not request this, you can safely ignore this email.</p>`),
  text: `Reset your Nexthire password (expires in 1 hour): ${resetUrl}`,
})

export const buildApplicationConfirmationEmail = ({ candidateName, jobTitle, company }) => ({
  subject: `Application received — ${jobTitle}`,
  html: layout('Application received', `
    <p>Hi ${escapeHtml(candidateName || 'there')},</p>
    <p>Your application for <strong>${escapeHtml(jobTitle)}</strong>${company ? ` at ${escapeHtml(company)}` : ''} has been received.</p>
    <p>You can track its status from your Nexthire dashboard.</p>`),
  text: `Your application for ${jobTitle} has been received.`,
})

export const buildInterviewScheduledEmail = ({ candidateName, jobTitle, scheduledAt }) => {
  const when = scheduledAt ? new Date(scheduledAt).toUTCString() : 'Shortly'
  return {
    subject: `Interview scheduled — ${jobTitle}`,
    html: layout('Interview scheduled', `
      <p>Hi ${escapeHtml(candidateName || 'there')},</p>
      <p>An interview has been scheduled for <strong>${escapeHtml(jobTitle)}</strong>.</p>
      <p><strong>When:</strong> ${escapeHtml(when)}</p>
      <p>Open your Nexthire dashboard to start the interview when it is time.</p>`),
    text: `Interview scheduled for ${jobTitle} at ${when}.`,
  }
}

export const buildStatusUpdateEmail = ({ candidateName, jobTitle, status }) => ({
  subject: `Application update — ${jobTitle}`,
  html: layout('Application update', `
    <p>Hi ${escapeHtml(candidateName || 'there')},</p>
    <p>Your application for <strong>${escapeHtml(jobTitle)}</strong> is now marked <strong>${escapeHtml(status)}</strong>.</p>`),
  text: `Your application for ${jobTitle} is now ${status}.`,
})
