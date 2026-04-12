/**
 * Message templates for automated notifications.
 *
 * Each template receives a context object and returns { subject, message }.
 * Keep SMS messages under 160 characters where possible.
 */

const templates = {
  invite_reminder: ({ farmerName, daysSinceInvite, inviteUrl }) => ({
    subject: 'Reminder: Complete your Farroway registration',
    message: inviteUrl
      ? `Hi ${farmerName}, your Farroway invite is still waiting (${daysSinceInvite} days). Tap to join: ${inviteUrl}`
      : `Hi ${farmerName}, your Farroway invite is still waiting (${daysSinceInvite} days). Please contact your field officer.`,
  }),

  no_first_update: ({ farmerName, cropType, daysSincePlanting }) => ({
    subject: 'First farm update needed',
    message: `Hi ${farmerName}, we haven't received your first ${cropType} update yet (${daysSincePlanting} days since planting). Please log your first activity.`,
  }),

  stale_farmer: ({ farmerName, daysSinceActivity, officerName }) => ({
    subject: 'Farm activity update required',
    message: `Hi ${farmerName}, no farm activity recorded in ${daysSinceActivity} days. ${officerName ? `Contact ${officerName} or ` : ''}log an update in Farroway.`,
  }),

  validation_pending: ({ officerName, farmerName, seasonId, daysWaiting }) => ({
    subject: 'Season validation pending',
    message: `${officerName || 'Officer'}: ${farmerName}'s season (${seasonId?.slice(0, 8)}) has been waiting ${daysWaiting} days for your validation. Please review.`,
  }),

  reviewer_backlog: ({ reviewerName, pendingCount }) => ({
    subject: 'Applications awaiting your review',
    message: `${reviewerName || 'Reviewer'}: You have ${pendingCount} application${pendingCount !== 1 ? 's' : ''} pending review in Farroway. Please log in to process them.`,
  }),

  high_risk_alert: ({ officerName, farmerName, riskLevel, riskCategory, seasonId }) => ({
    subject: `${riskLevel} risk alert — ${farmerName}`,
    message: `${officerName || 'Officer'}: ${farmerName}'s season (${seasonId?.slice(0, 8)}) is flagged ${riskLevel} risk (${riskCategory}). Please follow up immediately.`,
  }),

  onboarding_reminder: ({ fullName, nextStep }) => ({
    subject: 'Complete your Farroway setup',
    message: `Hi ${fullName || 'there'}, you started setting up your Farroway account but haven't finished yet. Next step: ${nextStep || 'complete your farm profile'}. Open the app to continue.`,
  }),

  feedback_followup: ({ fullName, issueDescription }) => ({
    subject: 'Did your crop issue improve?',
    message: `Hi ${fullName || 'there'}, a few days ago you reported ${issueDescription || 'a crop issue'}. How is your crop doing? Open Farroway to share your feedback — it helps improve advice for all farmers.`,
  }),
};

/**
 * Render a template by type.
 * @param {string} type - AutoNotifType enum value
 * @param {Object} ctx  - template context variables
 * @returns {{ subject: string, message: string }}
 */
export function renderTemplate(type, ctx) {
  const fn = templates[type];
  if (!fn) throw new Error(`No template for notification type: ${type}`);
  return fn(ctx);
}
