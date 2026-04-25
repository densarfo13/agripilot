/**
 * Notification sender — channel dispatch with full fallback chain.
 *
 *   Priority order: voice → whatsapp → sms → email → in_app
 *
 * Voice + WhatsApp were previously orphaned in `server/services/`
 * (test-only — adapter never wired to runtime). The wiring sprint
 * pulled them into the canonical dispatch path so insight cron rows
 * actually deliver to opt-in channels.
 *
 * Falls back to the next available channel when delivery fails or
 * is unconfigured. Each channel is gated by:
 *   • the matching configured-* check (env vars present)
 *   • the matching farmer preference flag (when supplied)
 *   • the existence of the channel target (phone / email / farmerId)
 */

import { isEmailConfigured, isSmsConfigured } from '../notifications/deliveryService.js';
import { sendEmail as smtpSendEmail } from '../../../lib/mailer.js';
import { sendWhatsApp, isWhatsAppConfigured } from '../../../services/whatsAppService.js';
import { sendVoiceAlert, isVoiceConfigured } from '../../../services/voiceAlertService.js';

// [WIRING] runtime tag — kept on by default so prod ops can grep
// `[WIRING] notification.sent` and confirm the cron actually
// reached a channel. Cheap; one log line per attempted dispatch.
const WIRING_LOG = '[WIRING] notification';

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

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#1d4ed8;margin-bottom:8px">${subject}</h2>
      <p style="white-space:pre-line">${message}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">This is an automated message from Farroway. Do not reply directly to this email.</p>
    </div>
  `;

  // Delegates to the shared SMTP transport; throws on delivery failure
  // so the channel-fallback chain can move on to the next option.
  const result = await smtpSendEmail({
    to: toEmail,
    subject,
    text: message,
    html,
  });
  if (!result.success) {
    throw new Error(result.error || 'smtp_send_failed');
  }
}

// ─── WhatsApp (Twilio Messages) ──────────────────────────

async function sendWhatsAppChannel(toPhone, message) {
  if (!toPhone) throw new Error('No phone number');
  if (!isWhatsAppConfigured()) throw new Error('WhatsApp not configured');
  const result = await sendWhatsApp(toPhone, message);
  if (!result || !result.ok) {
    throw new Error(result?.code || 'whatsapp_send_failed');
  }
}

// ─── Voice (Twilio Programmable Voice) ───────────────────

async function sendVoiceChannel(toPhone, subject, message, language) {
  if (!toPhone) throw new Error('No phone number');
  if (!isVoiceConfigured()) throw new Error('Voice not configured');
  // Subject is prepended so a literacy-mode farmer hears the headline
  // before the body. The voice service truncates safely.
  const spoken = subject ? `${subject}. ${message}` : message;
  const result = await sendVoiceAlert(toPhone, spoken, language || 'en');
  if (!result || !result.ok) {
    throw new Error(result?.code || 'voice_send_failed');
  }
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
export async function dispatch({
  preferredChannel, subject, message, phone, email, farmerId,
  // Fix P2.7 — farmer-level notification preferences. When supplied,
  // these gate sms/whatsapp/voice channels at dispatch time so the
  // cron honours opt-outs persisted in the Farmer table.
  preferences = null,
  // Voice channel needs the spoken-language code so Twilio TTS picks
  // the right accent. Defaults to English when not provided.
  language = 'en',
}) {
  const channels = buildChannelOrder(preferredChannel,
    { phone, email, farmerId, preferences });

  console.log(`${WIRING_LOG}.dispatch farmerId=${farmerId || 'n/a'} `
    + `preferred=${preferredChannel || 'n/a'} order=${channels.join('>') || 'none'}`);

  let lastError;
  for (const channel of channels) {
    try {
      if (channel === 'voice') {
        await sendVoiceChannel(phone, subject, message, language);
      } else if (channel === 'whatsapp') {
        await sendWhatsAppChannel(phone, message);
      } else if (channel === 'sms') {
        await sendSms(phone, message);
      } else if (channel === 'email') {
        await sendEmail(email, subject, message);
      } else if (channel === 'in_app') {
        await sendInApp({ farmerId, subject, message });
      }
      console.log(`${WIRING_LOG}.sent channel=${channel} `
        + `fallback=${channel !== preferredChannel} farmerId=${farmerId || 'n/a'}`);
      return { channel, fallback: channel !== preferredChannel };
    } catch (err) {
      lastError = err;
      console.warn(`${WIRING_LOG}.failed channel=${channel} `
        + `reason=${err && err.message ? err.message : 'unknown'}`);
    }
  }

  throw lastError || new Error('All channels failed');
}

function buildChannelOrder(preferred, { phone, email, farmerId, preferences }) {
  // Voice and WhatsApp added (P-WIRE) so cron-driven smart alerts
  // reach the channels the farmer opted into. Order matters: when a
  // farmer prefers voice (literacy_mode='audio'), we try voice
  // first; otherwise the chain remains text-first.
  const all = ['voice', 'whatsapp', 'sms', 'email', 'in_app'];

  // Start from preferred, then continue through remaining channels
  const idx = all.indexOf(preferred);
  const ordered = idx >= 0
    ? [...all.slice(idx), ...all.slice(0, idx)]
    : all;

  // Filter out channels that have no target — and respect farmer
  // preferences when supplied. SMS / WA / Voice opt-outs block the
  // matching channel even when a phone is on file. in_app is always
  // allowed (it's the dashboard notification list, not outbound).
  return ordered.filter((ch) => {
    if (ch === 'voice') {
      if (!phone) return false;
      if (preferences && preferences.receiveVoiceAlerts === false) return false;
      return true;
    }
    if (ch === 'whatsapp') {
      if (!phone) return false;
      if (preferences && preferences.receiveWhatsApp === false) return false;
      return true;
    }
    if (ch === 'sms') {
      if (!phone) return false;
      if (preferences && preferences.receiveSMS === false) return false;
      return true;
    }
    if (ch === 'email')  return !!email;
    if (ch === 'in_app') return !!farmerId;
    return false;
  });
}
