/**
 * channelRouter.js — maps a candidate notification + user prefs to a
 * list of channels that should attempt delivery, with a short reason
 * per pick.
 *
 *   chooseChannels({ candidate, preferences, user }) → ChannelPlan[]
 *
 * ChannelPlan:
 *   { channel: 'in_app' | 'email' | 'sms',
 *     reason:  'preference_on' | 'fallback' | 'high_priority' | 'default',
 *     canSend: boolean }
 *
 * Routing defaults (overridable via prefs):
 *
 *   password_reset_notification → email first  (fallback: SMS if phone)
 *   invite_notification         → email first  (fallback: in_app)
 *   daily_task_reminder         → in_app       (+SMS/email if user opted in)
 *   weather_alert (high)        → in_app + SMS (if enabled + phone)
 *   weather_alert (medium)      → in_app only
 *   risk_alert (high)           → in_app + SMS + email (if enabled)
 *   risk_alert (medium)         → in_app
 *   missed_task_reminder        → in_app (+SMS if farmType=commercial and enabled)
 *
 * "canSend" is false when the channel is allowed by prefs but the
 * delivery target is missing (e.g. smsEnabled=true but user.phone
 * missing). The scheduler logs those as skipped with reason so the
 * support team can find them.
 */

const PHONE_RE = /^\+?[\d]{7,15}$/;

function hasEmail(user) {
  return !!(user && user.email && /@/.test(user.email));
}

function hasPhone(user) {
  const p = user && (user.phone || user.phoneE164 || user.mobilePhone);
  if (!p) return false;
  return PHONE_RE.test(String(p).replace(/[\s().-]/g, ''));
}

function row(channel, reason, canSend) {
  return Object.freeze({ channel, reason, canSend: !!canSend });
}

export function chooseChannels({ candidate, preferences, user = null } = {}) {
  if (!candidate || !candidate.type) return [];
  const prefs = preferences || {};
  const priority = candidate.priority || 'medium';
  const plans = [];

  const phoneOnly = !hasEmail(user) && hasPhone(user);

  switch (candidate.type) {
    case 'password_reset_notification': {
      if (hasEmail(user)) {
        plans.push(row('email', 'default', true));
      }
      // Phone-only farmers: SMS becomes the primary recovery channel
      // (the Twilio Verify-driven /forgot-password/sms flow).
      if (hasPhone(user)) {
        plans.push(row('sms',
          phoneOnly ? 'phone_only_primary' : 'fallback',
          prefs.smsEnabled !== false));
      }
      plans.push(row('in_app', 'fallback', true));
      break;
    }

    case 'invite_notification': {
      if (hasEmail(user)) {
        plans.push(row('email', 'default', true));
      }
      // No email? Fall back to SMS for the invite so the farmer can
      // still join. Keeps the backyard / commercial onboarding path
      // open for farmers who never had email to begin with.
      if (phoneOnly && prefs.smsEnabled !== false) {
        plans.push(row('sms', 'phone_only_primary', true));
      }
      plans.push(row('in_app', 'fallback', true));
      break;
    }

    case 'daily_task_reminder': {
      if (prefs.dailyReminderEnabled === false) break;
      plans.push(row('in_app', 'default', true));
      if (prefs.smsEnabled && hasPhone(user)) {
        plans.push(row('sms', 'preference_on', true));
      }
      if (prefs.emailEnabled && hasEmail(user)) {
        plans.push(row('email', 'preference_on', true));
      }
      break;
    }

    case 'weather_alert': {
      if (prefs.weatherAlertsEnabled === false) break;
      plans.push(row('in_app', 'default', true));
      if (priority === 'high' && prefs.smsEnabled && hasPhone(user)) {
        plans.push(row('sms', 'high_priority', true));
      }
      break;
    }

    case 'risk_alert': {
      if (prefs.riskAlertsEnabled === false) break;
      plans.push(row('in_app', 'default', true));
      if (priority === 'high') {
        // Phone-only farmers on high-priority risk: SMS is the only
        // reliable outbound channel, so we escalate to it regardless
        // of whether the farmer opted in to SMS preference — users
        // without email can't receive the email fallback.
        if (prefs.smsEnabled && hasPhone(user)) {
          plans.push(row('sms', 'high_priority', true));
        } else if (phoneOnly && !hasEmail(user)) {
          plans.push(row('sms', 'phone_only_critical', true));
        }
        if (prefs.emailEnabled && hasEmail(user)) {
          plans.push(row('email','high_priority', true));
        }
      }
      break;
    }

    case 'stage_transition': {
      if (prefs.riskAlertsEnabled === false) break;   // reuses risk toggle
      plans.push(row('in_app', 'default', true));
      // Harvest-stage transitions are high-signal — nudge via SMS
      // when the farmer has opted in or has no other channel.
      if (priority === 'high') {
        if (prefs.smsEnabled && hasPhone(user)) {
          plans.push(row('sms', 'high_priority', true));
        } else if (!hasEmail(user) && hasPhone(user)) {
          plans.push(row('sms', 'phone_only_critical', true));
        }
      }
      break;
    }

    case 'missed_task_reminder': {
      if (prefs.missedTaskRemindersEnabled === false) break;
      plans.push(row('in_app', 'default', true));
      // Only nudge commercial farms via SMS to avoid noise for
      // backyard / small_farm users.
      const farmType = candidate.meta && candidate.meta.farmType;
      if (farmType === 'commercial' && prefs.smsEnabled && hasPhone(user)) {
        plans.push(row('sms', 'preference_on', true));
      }
      break;
    }

    default: {
      plans.push(row('in_app', 'default', true));
    }
  }

  return plans;
}

export const _internal = Object.freeze({ hasEmail, hasPhone, PHONE_RE });
