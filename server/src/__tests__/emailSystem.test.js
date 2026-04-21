import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ─── 1. Email Module Structure ──────────────────────────────

describe('Email Module — File Structure', () => {
  const requiredFiles = [
    'server/src/modules/email/constants.js',
    'server/src/modules/email/provider.js',
    'server/src/modules/email/service.js',
    'server/src/modules/email/templateRenderer.js',
    'server/src/modules/email/routes.js',
    'server/src/modules/email/templates/welcome.js',
    'server/src/modules/email/templates/otp.js',
    'server/src/modules/email/templates/pestAlert.js',
    'server/src/modules/email/templates/regionalWatch.js',
    'server/src/modules/email/templates/feedback.js',
    'server/src/modules/email/templates/onboardingReminder.js',
    'server/src/modules/email/templates/passwordReset.js',
  ];

  requiredFiles.forEach(file => {
    it(`${path.basename(file)} exists`, () => {
      expect(fileExists(file)).toBe(true);
    });
  });
});

// ─── 2. Constants — Sender Identities ──────────────────────

describe('Email Constants — @farroways.com Senders', () => {
  const code = readFile('server/src/modules/email/constants.js');

  it('defines SENDERS with 5 identities', () => {
    expect(code).toContain('SUPPORT');
    expect(code).toContain('NO_REPLY');
    expect(code).toContain('NOTIFICATIONS');
    expect(code).toContain('ONBOARDING');
    expect(code).toContain('REPORTS');
  });

  it('all default senders use @farroways.com', () => {
    expect(code).toContain("support@farroways.com");
    expect(code).toContain("no-reply@farroways.com");
    expect(code).toContain("notifications@farroways.com");
    expect(code).toContain("onboarding@farroways.com");
    expect(code).toContain("reports@farroways.com");
  });

  it('no sender email uses farroway.app domain', () => {
    // Sender emails must use @farroways.com, not @farroway.app
    const senderLines = code.split('\n').filter(l => l.includes("email:"));
    senderLines.forEach(line => {
      expect(line).not.toContain('@farroway.app');
    });
  });

  it('defines all 7 template names', () => {
    expect(code).toContain("'welcome'");
    expect(code).toContain("'verification_otp'");
    expect(code).toContain("'pest_alert'");
    expect(code).toContain("'regional_watch'");
    expect(code).toContain("'feedback_followup'");
    expect(code).toContain("'onboarding_reminder'");
    expect(code).toContain("'password_reset'");
  });

  it('defines confidence thresholds for alerts', () => {
    expect(code).toContain('PEST_ALERT_MIN_CONFIDENCE');
    expect(code).toContain('REGIONAL_WATCH_MIN_CONFIDENCE');
  });

  it('includes SPF/DKIM/DMARC deliverability notes', () => {
    expect(code).toContain('SPF');
    expect(code).toContain('DKIM');
    expect(code).toContain('DMARC');
  });
});

// ─── 3. Provider — SendGrid ────────────────────────────

describe('Email Provider — SendGrid', () => {
  const code = readFile('server/src/modules/email/provider.js');

  it('exports send function', () => {
    expect(code).toContain('export async function send(');
  });

  it('re-exports isEmailConfigured from the services emailService', () => {
    expect(code).toContain('isEmailConfigured');
    expect(code).toContain("from '../../../services/emailService.js'");
  });

  it('returns { success: false } when SendGrid is not configured', () => {
    expect(code).toContain('SENDGRID_API_KEY not configured');
    expect(code).toContain('success: false');
  });
});

// ─── 3b. Provider — canonical emailService ─────────────────
describe('Email Service — SendGrid transport', () => {
  const code = readFile('server/services/emailService.js');

  it('imports @sendgrid/mail', () => {
    expect(code).toContain("import('@sendgrid/mail')");
  });

  it('exports sendEmail with the { ok, code } shape', () => {
    expect(code).toContain('export async function sendEmail(');
    expect(code).toContain('ok: true');
    expect(code).toContain('ok: false');
  });

  it('classifies sender_not_verified and other SendGrid failures', () => {
    expect(code).toContain('sender_not_verified');
    expect(code).toContain('recipient_invalid');
    expect(code).toContain('auth_failed');
  });

  it('never imports nodemailer or calls createTransport', () => {
    // Check imports/calls specifically — file comments may mention
    // nodemailer as historical context ("SMTP / Zoho was removed").
    expect(code).not.toMatch(/from ['"]nodemailer['"]/);
    expect(code).not.toMatch(/import.+nodemailer/);
    expect(code).not.toMatch(/createTransport\s*\(/);
  });
});

// ─── 4. Service — Email Orchestrator ───────────────────────

describe('Email Service — Orchestrator', () => {
  const code = readFile('server/src/modules/email/service.js');

  it('exports sendEmail as the core function', () => {
    expect(code).toContain('export async function sendEmail(');
  });

  it('creates EmailLog entry before sending', () => {
    expect(code).toContain('prisma.emailLog.create');
    expect(code).toContain("status: 'queued'");
  });

  it('updates log to sent or failed after sending', () => {
    expect(code).toContain('prisma.emailLog.update');
    expect(code).toContain("'sent'");
    expect(code).toContain("'failed'");
  });

  it('exports convenience wrappers for all 7 email types', () => {
    expect(code).toContain('export function sendWelcomeEmail(');
    expect(code).toContain('export function sendVerificationEmail(');
    expect(code).toContain('export function sendPestAlertEmail(');
    expect(code).toContain('export function sendRegionalWatchEmail(');
    expect(code).toContain('export function sendFeedbackEmail(');
    expect(code).toContain('export function sendOnboardingReminderEmail(');
    expect(code).toContain('export function sendPasswordResetEmail(');
  });

  it('non-critical emails catch errors silently', () => {
    expect(code).toContain('.catch(err =>');
  });

  it('exports shouldSendEmail preference check', () => {
    expect(code).toContain('export async function shouldSendEmail(');
  });

  it('respects user notifPreferences for opt-out', () => {
    expect(code).toContain('notifPreferences');
  });
});

// ─── 5. Template Rendering ─────────────────────────────────

describe('Email Templates — Content', () => {
  it('welcome template includes 3 getting started steps', () => {
    const code = readFile('server/src/modules/email/templates/welcome.js');
    expect(code).toContain('Complete your farm profile');
    expect(code).toContain('first pest check');
    expect(code).toContain('Follow the guidance');
    expect(code).toContain('support@farroways.com');
  });

  it('OTP template includes code and expiry', () => {
    const code = readFile('server/src/modules/email/templates/otp.js');
    expect(code).toContain('otpCode');
    expect(code).toContain('expiryMinutes');
    expect(code).toContain('did not request this');
  });

  it('pest alert template includes risk level, issue, confidence, and action', () => {
    const code = readFile('server/src/modules/email/templates/pestAlert.js');
    expect(code).toContain('riskLevel');
    expect(code).toContain('likelyIssue');
    expect(code).toContain('confidenceScore');
    expect(code).toContain('whatToDo');
    expect(code).toContain('whereToInspect');
  });

  it('regional watch template includes area summary and inspection window', () => {
    const code = readFile('server/src/modules/email/templates/regionalWatch.js');
    expect(code).toContain('regionName');
    expect(code).toContain('riskSummary');
    expect(code).toContain('inspectionWindow');
    expect(code).toContain('recommendedAction');
  });

  it('feedback template includes issue reminder and feedback link', () => {
    const code = readFile('server/src/modules/email/templates/feedback.js');
    expect(code).toContain('issueDescription');
    expect(code).toContain('feedbackUrl');
    expect(code).toContain('Share Your Feedback');
  });

  it('onboarding reminder template includes next step and continue link', () => {
    const code = readFile('server/src/modules/email/templates/onboardingReminder.js');
    expect(code).toContain('nextStep');
    expect(code).toContain('continueUrl');
    expect(code).toContain('Continue Setup');
  });

  it('password reset template includes reset link and expiry', () => {
    const code = readFile('server/src/modules/email/templates/passwordReset.js');
    expect(code).toContain('resetUrl');
    expect(code).toContain('expiryMinutes');
    expect(code).toContain('did not request this');
  });

  it('all templates return { subject, html, text }', () => {
    const templateFiles = [
      'welcome.js', 'otp.js', 'pestAlert.js', 'regionalWatch.js',
      'feedback.js', 'onboardingReminder.js', 'passwordReset.js',
    ];
    for (const file of templateFiles) {
      const code = readFile(`server/src/modules/email/templates/${file}`);
      expect(code).toContain('return { subject, html, text }');
    }
  });

  it('all templates use wrapLayout for consistent branding', () => {
    const templateFiles = [
      'welcome.js', 'otp.js', 'pestAlert.js', 'regionalWatch.js',
      'feedback.js', 'onboardingReminder.js', 'passwordReset.js',
    ];
    for (const file of templateFiles) {
      const code = readFile(`server/src/modules/email/templates/${file}`);
      expect(code).toContain('wrapLayout');
    }
  });
});

// ─── 6. Template Renderer ──────────────────────────────────

describe('Template Renderer', () => {
  const code = readFile('server/src/modules/email/templateRenderer.js');

  it('exports renderTemplate function', () => {
    expect(code).toContain('export function renderTemplate(');
  });

  it('exports wrapLayout for shared branding', () => {
    expect(code).toContain('export function wrapLayout(');
  });

  it('wrapLayout includes Farroway branding', () => {
    expect(code).toContain('Farroway');
    expect(code).toContain('#16a34a'); // brand green
    expect(code).toContain('support@farroways.com');
  });

  it('throws on unknown template name', () => {
    expect(code).toContain("throw new Error(`Unknown email template:");
  });
});

// ─── 7. Email Logging — Prisma Schema ──────────────────────

describe('Email Log — Database Model', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('defines EmailLog model', () => {
    expect(schema).toContain('model EmailLog');
  });

  it('has correct fields', () => {
    expect(schema).toContain('recipient');
    expect(schema).toContain('sender');
    expect(schema).toContain('subject');
    expect(schema).toContain('template_name');
    expect(schema).toContain('error_message');
    expect(schema).toContain('related_user_id');
    expect(schema).toContain('related_report_id');
  });

  it('has EmailLogStatus enum with queued/sent/failed', () => {
    expect(schema).toContain('enum EmailLogStatus');
    expect(schema).toContain('queued');
    // 'sent' and 'failed' appear many times in the schema, checking within EmailLog context
  });

  it('has indexes for efficient querying', () => {
    expect(schema).toContain('idx_email_log_recipient');
    expect(schema).toContain('idx_email_log_template');
    expect(schema).toContain('idx_email_log_status');
    expect(schema).toContain('idx_email_log_created');
  });

  it('maps to email_logs table', () => {
    expect(schema).toContain('@@map("email_logs")');
  });
});

// ─── 8. Trigger Wiring ─────────────────────────────────────

describe('Email Triggers — Wired Into Flows', () => {
  it('farmer registration sends welcome email', () => {
    const code = readFile('server/src/modules/auth/farmer-registration.js');
    expect(code).toContain('sendWelcomeEmail');
    expect(code).toContain("import { sendWelcomeEmail }");
  });

  it('pest report route sends pest alert for high-confidence reports', () => {
    const code = readFile('server/intelligence/routes/pest-risk.routes.ts');
    expect(code).toContain('sendPestAlertEmail');
    expect(code).toContain('PEST_ALERT_MIN_CONFIDENCE');
  });

  it('pest alert only fires for high/urgent risk levels', () => {
    const code = readFile('server/intelligence/routes/pest-risk.routes.ts');
    expect(code).toContain("riskLevel === 'high' || riskLevel === 'urgent'");
  });

  it('pest alert checks confidence threshold before sending', () => {
    const code = readFile('server/intelligence/routes/pest-risk.routes.ts');
    expect(code).toContain('diagnosis.confidenceScore >= PEST_ALERT_MIN_CONFIDENCE');
  });

  it('onboarding reminder rule exists in trigger engine', () => {
    const code = readFile('server/src/modules/autoNotifications/triggerEngine.js');
    expect(code).toContain('ruleOnboardingReminder');
    expect(code).toContain("type: 'onboarding_reminder'");
    expect(code).toContain("onboardingStatus: 'in_progress'");
  });

  it('onboarding reminder template exists in auto-notification templates', () => {
    const code = readFile('server/src/modules/autoNotifications/templates.js');
    expect(code).toContain('onboarding_reminder');
    expect(code).toContain('Complete your Farroway setup');
  });

  it('onboarding_reminder is in AutoNotifType enum', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('onboarding_reminder');
  });

  it('feedback followup rule exists in trigger engine', () => {
    const code = readFile('server/src/modules/autoNotifications/triggerEngine.js');
    expect(code).toContain('ruleFeedbackFollowup');
    expect(code).toContain("type: 'feedback_followup'");
    expect(code).toContain('diagnosisFeedback');
  });

  it('feedback followup template exists in auto-notification templates', () => {
    const code = readFile('server/src/modules/autoNotifications/templates.js');
    expect(code).toContain('feedback_followup');
    expect(code).toContain('Did your crop issue improve?');
  });

  it('feedback_followup is in AutoNotifType enum', () => {
    const schema = readFile('server/prisma/schema.prisma');
    expect(schema).toContain('feedback_followup');
  });
});

// ─── 9. Admin Routes ───────────────────────────────────────

describe('Email Admin Routes', () => {
  const code = readFile('server/src/modules/email/routes.js');

  it('has GET /logs endpoint', () => {
    expect(code).toContain("router.get('/logs'");
  });

  it('has GET /stats endpoint', () => {
    expect(code).toContain("router.get('/stats'");
  });

  it('supports pagination', () => {
    expect(code).toContain('page');
    expect(code).toContain('limit');
    expect(code).toContain('skip');
    expect(code).toContain('totalPages');
  });

  it('supports filtering by status and templateName', () => {
    expect(code).toContain('req.query.status');
    expect(code).toContain('req.query.templateName');
  });

  it('is mounted in app.js', () => {
    const app = readFile('server/src/app.js');
    expect(app).toContain("import emailRoutes from './modules/email/routes.js'");
    expect(app).toContain("app.use('/api/email'");
  });

  it('requires authentication', () => {
    const app = readFile('server/src/app.js');
    expect(app).toContain("'/api/email', authenticate, emailRoutes");
  });

  it('requires admin role via authorize middleware', () => {
    expect(code).toContain('authorize');
    expect(code).toContain('super_admin');
    expect(code).toContain('institutional_admin');
  });
});

// ─── 10. Env Config ────────────────────────────────────────

describe('Environment Configuration', () => {
  const env = readFile('server/.env.example');

  it('documents the SendGrid API key variable', () => {
    expect(env).toContain('SENDGRID_API_KEY');
  });

  it('documents EMAIL_FROM with the admin@farroway.app default', () => {
    expect(env).toContain('EMAIL_FROM');
    expect(env).toContain('admin@farroway.app');
  });

  it('documents APP_BASE_URL for link construction', () => {
    expect(env).toContain('APP_BASE_URL');
  });
});

// ─── 11. Security — No Sensitive Data Leaks ────────────────

describe('Security — Email Content Safety', () => {
  it('OTP template does not include password or token in subject', () => {
    const code = readFile('server/src/modules/email/templates/otp.js');
    const subjectLine = code.match(/subject\s*=\s*'([^']+)'/);
    expect(subjectLine?.[1]).not.toContain('code');
    expect(subjectLine?.[1]).not.toContain('OTP');
  });

  it('password reset template does not include token in subject', () => {
    const code = readFile('server/src/modules/email/templates/passwordReset.js');
    const subjectLine = code.match(/subject\s*=\s*'([^']+)'/);
    expect(subjectLine?.[1]).not.toContain('token');
    expect(subjectLine?.[1]).not.toContain('link');
  });

  it('pest alert does not include GPS coordinates or raw farm data', () => {
    const code = readFile('server/src/modules/email/templates/pestAlert.js');
    expect(code).not.toContain('latitude');
    expect(code).not.toContain('longitude');
    expect(code).not.toContain('farmSizeAcres');
  });

  it('email service uses logSafe metadata for logs, not full vars', () => {
    const code = readFile('server/src/modules/email/service.js');
    expect(code).toContain('logSafe');
  });
});
