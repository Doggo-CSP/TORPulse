import nodemailer from 'nodemailer'

import { env } from '../../config/env.js'

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

export function createSmtpMailer(): Mailer {
  if (!env.SMTP_HOST) {
    throw new Error('SMTP_HOST is required to send notification emails')
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })

  return {
    async send(message) {
      await transport.sendMail(message)
    },
  }
}
