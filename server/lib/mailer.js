import nodemailer from 'nodemailer';
import { env } from './env.js';

function createTransport() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

const transport = createTransport();

export async function sendEmail({ to, subject, html, text }) {
  if (!transport) {
    console.log('Email transport not configured. Email payload:', { to, subject, text });
    return;
  }

  await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
    text,
  });
}
