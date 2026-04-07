/**
 * Delivery Service — honest scaffolding for email and SMS invite delivery.
 *
 * This module detects what delivery channels are actually configured.
 * It NEVER reports a delivery as successful unless it actually happened.
 * When a channel is not configured, it returns a manual-share result so the
 * caller can clearly communicate the limitation to the UI.
 *
 * To enable email delivery: set SMTP_HOST + SMTP_USER + SMTP_PASS in env,
 *   or SENDGRID_API_KEY, or RESEND_API_KEY.
 * To enable SMS delivery: set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER.
 */

// ─── Channel detection ────────────────────────────────────

export function isEmailConfigured() {
  return !!(
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
    process.env.SENDGRID_API_KEY ||
    process.env.RESEND_API_KEY
  );
}

export function isSmsConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

// ─── Delivery result shape ────────────────────────────────
// { delivered: boolean, channel: string, deliveryStatus: string, reason?: string }

// ─── Email invite ─────────────────────────────────────────

/**
 * Send an invite email to the farmer.
 * Returns an honest delivery result — never fakes success.
 */
export async function sendInviteEmail({ toEmail, farmerName, inviteUrl, inviterName, expiresAt }) {
  if (!isEmailConfigured()) {
    return {
      delivered: false,
      channel: 'link',
      deliveryStatus: 'manual_share_ready',
      reason: 'Email delivery not configured. Copy the invite link and send it manually.',
    };
  }

  // ── Placeholder for actual email delivery ──
  // Uncomment and adapt when an email provider is configured:
  //
  // const subject = `You have been invited to AgriPilot`;
  // const text = [
  //   `Hello ${farmerName},`,
  //   ``,
  //   `${inviterName || 'Your agricultural institution'} has invited you to join AgriPilot.`,
  //   ``,
  //   `Click the link below to activate your account:`,
  //   inviteUrl,
  //   ``,
  //   expiresAt ? `This link expires on ${new Date(expiresAt).toLocaleDateString()}.` : '',
  //   ``,
  //   `If you did not expect this invitation, you can ignore this message.`,
  // ].join('\n');
  //
  // await sendViaConfiguredProvider({ to: toEmail, subject, text });

  return {
    delivered: false,
    channel: 'link',
    deliveryStatus: 'manual_share_ready',
    reason: 'Email service scaffolded but not yet active. Copy the invite link and send it manually.',
  };
}

// ─── SMS invite ───────────────────────────────────────────

/**
 * Send an invite SMS to the farmer's phone number.
 * Returns an honest delivery result — never fakes success.
 */
export async function sendInviteSms({ toPhone, farmerName, inviteUrl, inviteCode }) {
  if (!isSmsConfigured()) {
    return {
      delivered: false,
      channel: 'phone',
      deliveryStatus: 'manual_share_ready',
      reason: 'SMS delivery not configured. Copy the invite link and send it via WhatsApp, SMS, or any other channel.',
    };
  }

  // ── Placeholder for actual SMS delivery ──
  // Uncomment and adapt when Twilio (or equivalent) is configured:
  //
  // const message = `Hello ${farmerName}, you have been invited to AgriPilot. Register here: ${inviteUrl}`;
  // await sendViaTwilio({ to: toPhone, body: message });

  return {
    delivered: false,
    channel: 'phone',
    deliveryStatus: 'manual_share_ready',
    reason: 'SMS service scaffolded but not yet active. Copy the invite link and send it manually.',
  };
}

// ─── Delivery status label ────────────────────────────────

/**
 * Human-readable delivery status for the UI.
 * Maps internal status values to clear, honest labels.
 */
export function getDeliveryStatusLabel(inviteDeliveryStatus, hasUserAccount) {
  if (hasUserAccount) return { label: 'Account Active', cls: 'badge-approved' };
  const map = {
    manual_share_ready: { label: 'Link Generated — Share Manually', cls: 'badge-draft' },
    email_sent:         { label: 'Invite Email Sent', cls: 'badge-submitted' },
    phone_sent:         { label: 'Invite SMS Sent', cls: 'badge-submitted' },
    accepted:           { label: 'Invite Accepted', cls: 'badge-approved' },
    expired:            { label: 'Invite Expired', cls: 'badge-rejected' },
  };
  return map[inviteDeliveryStatus] || { label: 'No Invite Sent', cls: '' };
}
