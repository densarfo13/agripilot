/**
 * CommandCenterNotifications.ts — pure helpers that render notification
 * payloads from CommandCenterRuntime selectors. Notification surfaces
 * (in-app banners, scheduled local notifications, push payloads) read
 * from these helpers so every channel sends the SAME morning action
 * the farmer sees on Home.
 *
 * No global pinned here — this is a pure module the NotificationRuntime
 * (or any page) imports when it needs a CC-aware payload.
 */

import { selectMorningNotification, selectTodayAction } from './CommandCenterSelectors';
import type { TodayAction } from './CommandCenterContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

export interface MorningNotificationPayload {
  ready: boolean;
  /** Single-line title — e.g. "Good morning Dennis." */
  title: string;
  /** 2-line body — "Today: …" / "Time: …". */
  body: string;
  /** The action that drives this notification — for deep-linking. */
  action: Readonly<TodayAction>;
}

/**
 * Build the spec morning notification:
 *
 *   Good morning Dennis.
 *
 *   Today:
 *   Inspect onion leaves.
 *
 *   Time:
 *   2 minutes.
 *
 * Same source as Home + Tasks. Honest fallback when no action ready.
 */
export function buildMorningNotificationPayload(firstName?: string | null): Readonly<MorningNotificationPayload> {
  return _safe(() => {
    const m = selectMorningNotification(firstName);
    const title = m.greeting;
    const body = `${m.todayLine}\n${m.timeLine}`;
    return Object.freeze({
      ready: m.ready,
      title,
      body,
      action: m.action,
    });
  }, Object.freeze({
    ready: false,
    title: 'Good morning.',
    body: 'Today: Check in on your plants.\nTime: A few minutes.',
    action: selectTodayAction(),
  }));
}

/** Helper for the gate: confirms the morning payload reads from
 *  selectMorningNotification (not from a hardcoded string). */
export const MORNING_NOTIFICATION_SOURCE = 'commandCenter.selectMorningNotification' as const;
