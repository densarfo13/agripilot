/**
 * SendGrid Email Provider
 *
 * Handles actual email delivery via SendGrid API.
 * Fails safely if SENDGRID_API_KEY is not set.
 * Provider abstraction is minimal — swap this file for SES/Postmark later.
 */

let sgMail = null;

function isConfigured() {
  return !!process.env.SENDGRID_API_KEY;
}

async function getSgMail() {
  if (!sgMail) {
    sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }
  return sgMail;
}

/**
 * Send an email via SendGrid.
 * @param {{ to: string, from: { email: string, name: string }, subject: string, html: string, text: string }} params
 * @returns {{ success: boolean, error?: string }}
 */
export async function send({ to, from, subject, html, text }) {
  if (!isConfigured()) {
    return { success: false, error: 'SENDGRID_API_KEY not configured' };
  }

  try {
    const client = await getSgMail();
    await client.send({ to, from, subject, html, text });
    return { success: true };
  } catch (err) {
    const message = err?.response?.body?.errors?.[0]?.message || err?.message || 'Unknown SendGrid error';
    return { success: false, error: message };
  }
}

export { isConfigured };
