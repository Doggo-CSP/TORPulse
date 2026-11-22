import nodemailer from 'nodemailer'

import { env } from '../../config/env.js'
import { headerSafe } from '../../lib/html.js'

export interface MailMessage {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

export interface Mailer {
  send(message: MailMessage): Promise<void>
}

const SINGLE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/

export function createSmtpMailer(): Mailer {
  if (!env.SMTP_HOST) {
    throw new Error('SMTP_HOST is required to send notification emails')
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    // Port 587: STARTTLS is mandatory, never fall back to plain text (ASVS V12.3.1)
    requireTLS: !env.SMTP_SECURE,
    tls: { minVersion: 'TLSv1.2' },
    // Production: SMTP goes out through the egress proxy (HTTP CONNECT), since the app
    // containers have no direct route to the internet (ASVS V13.2.5)
    ...(process.env.SMTP_PROXY?.trim() ? { proxy: process.env.SMTP_PROXY.trim() } : {}),
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })

  return {
    async send(message) {
      // One plain address per message (no lists, display names or line breaks), and a single-line
      // subject, so data from the database cannot add recipients or headers (ASVS V1.3.11)
      if (!SINGLE_ADDRESS.test(message.to)) {
        throw new Error('Refusing to send email: recipient is not a single plain address')
      }
      await transport.sendMail({ ...message, subject: headerSafe(message.subject) })
    },
  }
}
