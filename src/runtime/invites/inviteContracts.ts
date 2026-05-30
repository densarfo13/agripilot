/**
 * src/runtime/invites/inviteContracts.ts — frozen types for the
 * Invite runtime. NEVER stores raw tokens; only hashes.
 *
 * Strict-rule audit
 *   • Pure data.
 *   • No React / DOM types.
 *   • No PII in the persisted shape — destination is MASKED
 *     before storage (e.g. "a***@example.com").
 */

export const INVITE_RUNTIME_VERSION = 'invite-runtime-v1';

export const INVITE_TYPE = Object.freeze({
  FARMER_ACTIVATION:        'farmer_activation',
  NGO_USER_ACTIVATION:      'ngo_user_activation',
  BUYER_ACTIVATION:         'buyer_activation',
  FIELD_OFFICER_ACTIVATION: 'field_officer_activation',
  PROGRAM_ENROLLMENT:       'program_enrollment',
} as const);

export type InviteTypeValue =
  typeof INVITE_TYPE[keyof typeof INVITE_TYPE];

export const INVITE_STATUS = Object.freeze({
  PENDING:   'pending',
  SENT:      'sent',
  DELIVERED: 'delivered',
  FAILED:    'failed',
  ACCEPTED:  'accepted',
  EXPIRED:   'expired',
  REVOKED:   'revoked',
} as const);

export type InviteStatusValue =
  typeof INVITE_STATUS[keyof typeof INVITE_STATUS];

export const INVITE_CHANNEL = Object.freeze({
  EMAIL: 'email',
  SMS:   'sms',
  BOTH:  'both',
} as const);

export type InviteChannelValue =
  typeof INVITE_CHANNEL[keyof typeof INVITE_CHANNEL];

export interface InviteRecord {
  id:                  string;
  userId:              string;
  organizationId?:     string;
  programId?:          string;
  role:                string;
  inviteType:          InviteTypeValue;
  tokenHash:           string;       // SHA-256 hex; never the raw token
  channel:             InviteChannelValue;
  destinationMasked:   string;       // e.g. 'a***@example.com' or '+233***1234'
  status:              InviteStatusValue;
  expiresAt:           string;
  createdAt:           string;
  acceptedAt?:         string;
}

export interface InviteDeliveryResult {
  channel:    InviteChannelValue;
  ok:         boolean;
  reason?:    'no_provider' | 'fail' | 'delivered';
  providerSafe: boolean;     // true when not fake; CI-enforced
}

export interface InviteHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  emailProviderConfigured:  boolean;
  smsProviderConfigured:    boolean;
  tokenHashingReady:        boolean;
  activationFlowReady:      boolean;
  fakeDelivery:             boolean;  // ALWAYS false in production
  // Wave-39 — adoption-readiness extensions.
  activationRouteReady:     boolean;  // /activate route mounted
  resendReady:              boolean;  // POST /api/invites/resend wired
  expirationReady:          boolean;  // expiresAt enforced
  inviteStatusVisible:      boolean;  // admin can see invite status
}

/** Token expiry default — 14 days. */
export const INVITE_TOKEN_TTL_DAYS = 14;
