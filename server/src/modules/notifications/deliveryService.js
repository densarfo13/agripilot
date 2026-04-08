/**
 * Delivery Service — real email and SMS invite delivery via SendGrid and Twilio.
 *
 * Honesty contract: NEVER reports delivery as successful unless it actually happened.
 * When a channel is not configured or delivery fails, returns manual_share_ready so
 * the caller can clearly communicate the limitation to the UI.
 *
 * Environment variables:
 *   Email: SENDGRID_API_KEY + EMAIL_FROM_ADDRESS (+ optional EMAIL_FROM_NAME)
 *   SMS:   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER
 */

// ─── Channel detection ────────────────────────────────────

export function isEmailConfigured() {
  return !!(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM_ADDRESS);
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
 * Send an invite email to the farmer via SendGrid.
 * Returns an honest delivery result — never fakes success.
 */
export async function sendInviteEmail({ toEmail, farmerName, inviteUrl, inviterName, expiresAt }) {
  if (!toEmail) {
    return {
      delivered: false,
      channel: 'link',
      deliveryStatus: 'manual_share_ready',
      reason: 'No email address provided for this farmer.',
    };
  }

  if (!isEmailConfigured()) {
    return {
      delivered: false,
      channel: 'link',
      deliveryStatus: 'manual_share_ready',
      reason: 'Email delivery not configured. Set SENDGRID_API_KEY and EMAIL_FROM_ADDRESS to enable.',
    };
  }

  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const fromName = process.env.EMAIL_FROM_NAME || 'Farroway';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS;
    const expiryText = expiresAt
      ? `This link expires on ${new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
      : '';

    const text = [
      `Hello ${farmerName},`,
      ``,
      `${inviterName || 'Your agricultural institution'} has invited you to join Farroway.`,
      ``,
      `Click the link below to activate your account:`,
      inviteUrl,
      ``,
      expiryText,
      ``,
      `If you did not expect this invitation, you can safely ignore this message.`,
    ].filter(l => l !== undefined).join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#1d4ed8;margin-bottom:8px">You have been invited to Farroway</h2>
        <p>Hello <strong>${farmerName}</strong>,</p>
        <p>${inviterName || 'Your agricultural institution'} has invited you to join <strong>Farroway</strong>.</p>
        <p>Click the button below to activate your account:</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0">
          Activate My Account
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">Or copy this link: <a href="${inviteUrl}">${inviteUrl}</a></p>
        ${expiryText ? `<p style="color:#6b7280;font-size:13px">${expiryText}</p>` : ''}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">If you did not expect this invitation, you can safely ignore this message.</p>
      </div>
    `;

    await sgMail.send({
      to: toEmail,
      from: { email: fromAddress, name: fromName },
      subject: `You have been invited to join Farroway`,
      text,
      html,
    });

    return {
      delivered: true,
      channel: 'email',
      deliveryStatus: 'email_sent',
    };
  } catch (err) {
    const reason = err?.response?.body?.errors?.[0]?.message || err?.message || 'Unknown SendGrid error';
    console.error('[deliveryService] SendGrid email failed:', reason);
    // Route through opsLogger so admin monitoring captures provider failures
    import('../../utils/opsLogger.js').then(({ logDeliveryEvent }) => {
      logDeliveryEvent('provider_error', { provider: 'sendgrid', error: reason, toEmail });
    }).catch(() => {});
    return {
      delivered: false,
      channel: 'link',
      deliveryStatus: 'manual_share_ready',
      reason: `Email delivery failed: ${reason}. Copy the invite link and send it manually.`,
    };
  }
}

// ─── SMS invite ───────────────────────────────────────────

/**
 * Send an invite SMS to the farmer's phone via Twilio.
 * Returns an honest delivery result — never fakes success.
 */
export async function sendInviteSms({ toPhone, farmerName, inviteUrl }) {
  if (!toPhone) {
    return {
      delivered: false,
      channel: 'link',
      deliveryStatus: 'manual_share_ready',
      reason: 'No phone number provided for this farmer.',
    };
  }

  if (!isSmsConfigured()) {
    return {
      delivered: false,
      channel: 'link',
      deliveryStatus: 'manual_share_ready',
      reason: 'SMS delivery not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to enable.',
    };
  }

  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const body = `Hello ${farmerName}, you have been invited to Farroway. Tap this link to activate your account: ${inviteUrl}`;

    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toPhone,
    });

    return {
      delivered: true,
      channel: 'phone',
      deliveryStatus: 'phone_sent',
    };
  } catch (err) {
    const reason = err?.message || 'Unknown Twilio error';
    console.error('[deliveryService] Twilio SMS failed:', reason);
    import('../../utils/opsLogger.js').then(({ logDeliveryEvent }) => {
      logDeliveryEvent('provider_error', { provider: 'twilio', error: reason, toPhone });
    }).catch(() => {});
    return {
      delivered: false,
      channel: 'link',
      deliveryStatus: 'manual_share_ready',
      reason: `SMS delivery failed: ${reason}. Copy the invite link and send it manually.`,
    };
  }
}

// ─── Channel-aware dispatch ───────────────────────────────

/**
 * Dispatch an invite using the requested channel.
 * Falls back to manual_share_ready when the channel is unavailable or delivery fails.
 *
 * @param {Object} params
 * @param {string} params.channel - 'email' | 'phone' | 'link'
 * @param {string} params.toEmail - farmer's contact email (for email channel)
 * @param {string} params.toPhone - farmer's phone (for phone channel)
 * @param {string} params.farmerName
 * @param {string} params.inviteUrl
 * @param {string} [params.inviterName]
 * @param {Date|string} [params.expiresAt]
 * @returns {Promise<{delivered, channel, deliveryStatus, reason?}>}
 */
export async function dispatchInvite({ channel, toEmail, toPhone, farmerName, inviteUrl, inviterName, expiresAt }) {
  if (channel === 'email') {
    return sendInviteEmail({ toEmail, farmerName, inviteUrl, inviterName, expiresAt });
  }
  if (channel === 'phone') {
    return sendInviteSms({ toPhone, farmerName, inviteUrl });
  }
  // 'link' or unrecognised — manual share, no delivery attempted
  return {
    delivered: false,
    channel: 'link',
    deliveryStatus: 'manual_share_ready',
  };
}

// ─── Delivery status label ────────────────────────────────

/**
 * Human-readable delivery status for the UI.
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
