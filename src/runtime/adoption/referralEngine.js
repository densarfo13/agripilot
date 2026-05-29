/**
 * runtime/adoption/referralEngine.js — Phase 13 referral state.
 *
 *   import {
 *     computeReferralState,
 *     REFERRAL_BADGES, REWARD_KIND,
 *   } from 'src/runtime/adoption/referralEngine.js';
 *
 * What this is
 * ────────────
 *   Pure computation of referral state from a caller-injected log.
 *   Does NOT send invites — that requires backend (deferred). Does
 *   NOT redeem rewards — caller hands the envelope's reward list to
 *   the wave-8 entitlements runtime when backend lands.
 *
 *   Returns a frozen envelope:
 *     {
 *       invitesSent, invitesJoined, conversionRate,
 *       rewards:  [{kind, amount, unlockedAt, sourceInviteId}],
 *       badges:   [{kind, unlocked, unlockedAt}],
 *       nextBadge, nextReward,
 *       deferred,
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No network calls. No persistence writes.
 *   • Composition-only — caller owns the referralLog source.
 *   • No PII in the envelope — invite records are flattened to
 *     counts/IDs only.
 */

export const REFERRAL_VERSION = 'referral-engine-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

export const REWARD_KIND = Object.freeze({
  SCAN_CREDITS:     'SCAN_CREDITS',
  PREMIUM_DAYS:     'PREMIUM_DAYS',
  RECOGNITION_BADGE: 'RECOGNITION_BADGE',
});

export const REFERRAL_BADGES = Object.freeze({
  FIRST_INVITE:   { threshold: 1,  kind: 'FIRST_INVITE',
                    labelKey: 'adoption.referral.badge.firstInvite',
                    labelDefault: 'First invite' },
  THREE_JOINED:   { threshold: 3,  kind: 'THREE_JOINED',
                    labelKey: 'adoption.referral.badge.threeJoined',
                    labelDefault: 'Three farmers joined' },
  TEN_JOINED:     { threshold: 10, kind: 'TEN_JOINED',
                    labelKey: 'adoption.referral.badge.tenJoined',
                    labelDefault: 'Ten farmers joined' },
  COMMUNITY_LEAD: { threshold: 25, kind: 'COMMUNITY_LEAD',
                    labelKey: 'adoption.referral.badge.communityLead',
                    labelDefault: 'Community leader' },
});

const REWARD_TABLE = Object.freeze([
  { threshold: 1,  kind: REWARD_KIND.SCAN_CREDITS,    amount: 5 },
  { threshold: 3,  kind: REWARD_KIND.SCAN_CREDITS,    amount: 20 },
  { threshold: 3,  kind: REWARD_KIND.PREMIUM_DAYS,    amount: 7 },
  { threshold: 10, kind: REWARD_KIND.PREMIUM_DAYS,    amount: 30 },
  { threshold: 10, kind: REWARD_KIND.RECOGNITION_BADGE, amount: 1 },
]);

function _normalizeInvite(raw) {
  if (!_isObj(raw)) return null;
  // PII drop: we keep only enough to count + identify the invite
  // record. No phone/email/name allowed in the envelope.
  const sentAt   = _str(raw.sentAt)   || _str(raw.invitedAt);
  const joinedAt = _str(raw.joinedAt) || _str(raw.acceptedAt);
  return Object.freeze({
    id:       _str(raw.id) || _str(raw.inviteId) || '',
    sentAt,
    joinedAt,
    joined:   !!joinedAt,
  });
}

export function computeReferralState(ctx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {};
    const raw     = _arr(c.referralLog);
    const invites = raw.map(_normalizeInvite).filter(Boolean);

    const invitesSent   = invites.length;
    const invitesJoined = invites.filter((i) => i.joined).length;
    const conversionRate = invitesSent === 0
      ? 0
      : Math.round((invitesJoined / invitesSent) * 100) / 100;

    // Badges — driven by invitesJoined.
    const badges = Object.values(REFERRAL_BADGES).map((b) => {
      const unlocked = invitesJoined >= b.threshold;
      return Object.freeze({
        kind:         b.kind,
        threshold:    b.threshold,
        unlocked,
        unlockedAt:   unlocked
          ? (_str(_arr(invites)[b.threshold - 1] && invites[b.threshold - 1].joinedAt)
             || '')
          : '',
        labelKey:     b.labelKey,
        labelDefault: b.labelDefault,
      });
    });

    // Rewards — anything where invitesJoined ≥ threshold is unlocked.
    const rewards = REWARD_TABLE
      .filter((r) => invitesJoined >= r.threshold)
      .map((r) => Object.freeze({
        kind:   r.kind,
        amount: r.amount,
        threshold: r.threshold,
        unlockedAt: _str(_arr(invites)[r.threshold - 1]
          && invites[r.threshold - 1].joinedAt) || '',
      }));

    const nextBadge = badges.find((b) => !b.unlocked) || null;
    const nextReward = REWARD_TABLE.find((r) => invitesJoined < r.threshold) || null;

    return Object.freeze({
      runtimeVersion: REFERRAL_VERSION,
      invitesSent,
      invitesJoined,
      conversionRate,
      rewards:        Object.freeze(rewards),
      badges:         Object.freeze(badges),
      nextBadge,
      nextReward:     nextReward ? Object.freeze({
        kind: nextReward.kind, amount: nextReward.amount,
        threshold: nextReward.threshold,
        remaining: nextReward.threshold - invitesJoined,
      }) : null,
      deferred: Object.freeze({
        inviteSend:       'no backend yet; UI may collect intent but '
                         + 'cannot deliver invites',
        rewardRedemption: 'no entitlements backend yet; rewards are '
                         + 'computed but not granted',
      }),
    });
  }, Object.freeze({
    runtimeVersion: REFERRAL_VERSION,
    invitesSent: 0, invitesJoined: 0, conversionRate: 0,
    rewards: Object.freeze([]), badges: Object.freeze([]),
    nextBadge: null, nextReward: null,
    deferred: Object.freeze({}),
  }));
}

// Default export aliases for runtime + audit consumers
export const _internals = Object.freeze({ REWARD_TABLE, _num });
