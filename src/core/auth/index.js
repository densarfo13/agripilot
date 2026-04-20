/**
 * src/core/auth/index.js — single import surface for the
 * auth-reliability helpers that sit above the existing
 * AuthContext + API client.
 */

export {
  isSafeReturnPath,
  saveReturnTo, peekReturnTo, consumeReturnTo, clearReturnTo,
} from './returnToStorage.js';

export {
  enqueueStepUpRetry, flushStepUpRetryQueue,
  rejectStepUpRetryQueue, stepUpRetryQueueSize,
} from './stepUpRetryQueue.js';

export {
  assertRequestHasToken,
  assertRefreshNotRacing,
  assertAdminPageGuarded,
  assertMfaRouted,
  assertSessionUpdatedAfterRefresh,
  assertBannerAfterRecovery,
} from './authDevAssertions.js';
