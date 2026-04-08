/**
 * Notification sender — channel dispatch with SMS→email→in_app fallback.
 *
 * Priority order: sms → email → in_app
 * Falls back to the next available channel when delivery fails or is unconfigured.
 */

import { isEmailConfigured, isSmsConfigured } from '../notifications/deliveryService.js';

// ─── SMS ──────────────────────────────────────────────────

async function sendSms(toPhone, message) {
  if (!toPhone) throw new Error('No phone number');
  if (!isSmsConfigured()) throw new Error('SMS not configured');

  const twilio = (await import('twilio')).default;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toPhone,
  });
}

// ─── Email ────────────────────────────────────────────────

async function sendEmail(toEmail, subject, message) {
  if (!toEmail) throw new Error('No email address');
  if (!isEmailConfigured()) throw new Error('Email not configured');

  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const fromName    = process.env.EMAIL_FROM_NAME    || 'Farroway';
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#1d4ed8;margin-bottom:8px">${subject}</h2>
      <p style="white-space:pre-line">${message}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">This is an automated message from Farroway. Do not reply directly to this email.</p>
    </div>
  `;

  await sgMail.send({
    to: toEmail,
    from: { email: fromAddress, name: fromName },
    subject,
    text: message,
    html,
  });
}

// ─── In-app (FarmerNotification) ─────────────────────────

async function sendInApp({ farmerId, subject, message }) {
  if (!farmerId) throw new Error('No farmerId for in_app notification');
  const prisma = (await import('../../config/database.js')).default;
  await prisma.farmerNotification.create({
    data: {
      farmerId,
      notificationType: 'system',
      title: subject || 'Farroway Notification',
      message,
    },
  });
}

// ─── Channel-aware dispatch with fallback ─────────────────

/**
 * Attempt delivery via preferred channel, falling back as needed.
 *
 * @param {Object} params
 * @param {string}      params.preferredChannel - 'sms' | 'email' | 'in_app'
 * @param {string}      params.subject
 * @param {string}      params.message
 * @param {string|null} params.phone
 * @param {string|null} params.email
 * @param {string|null} params.farmerId
 * @returns {Promise<{ channel: string, fallback: boolean }>}
 */
export async function dispatch({ preferredChannel, subject, message, phone, email, farmerId }) {
  const channels = buildChannelOrder(preferredChannel, { phone, email, farmerId });

  let lastError;
  for (const channel of channels) {
    try {
      if (channel === 'sms') {
        await sendSms(phone, message);
      } else if (channel === 'email') {
        await sendEmail(email, subject, message);
      } else if (channel === 'in_app') {
        await sendInApp({ farmerId, subject, message });
      }
      return { channel, fallback: channel !== preferredChannel };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All channels failed');
}

function buildChannelOrder(preferred, { phone, email, farmerId }) {
  const all = ['sms', 'email', 'in_app'];

  // Start from preferred, then continue through remaining channels
  const idx = all.indexOf(preferred);
  const ordered = idx >= 0
    ? [...all.slice(idx), ...all.slice(0, idx)]
    : all;

  // Filter out channels that have no target
  return ordered.filter(ch => {
    if (ch === 'sms')    return !!phone;
    if (ch === 'email')  return !!email;
    if (ch === 'in_app') return !!farmerId;
    return false;
  });
}
