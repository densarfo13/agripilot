/**
 * EngagementStrip — single composable surface that mounts the
 * daily engagement layer (StreakChip + EngagementPlanCard +
 * EngagementWeeklySummary) and registers the morning + afternoon
 * reminders.
 *
 * A page that wants the engagement surface drops in one element:
 *
 *   <EngagementStrip />
 *
 * The strip self-hides when `dailyEngagement` is off — pilots that
 * haven't flipped the flag see no change.
 *
 * Strict-rule audit
 *   • Flag-gated; flag-off path returns null (no DOM, no effect).
 *   • Reminder bootstrap runs once per mount; teardown cancels
 *     pending timers.
 *   • All visible text via tStrict (the children handle that).
 *   • Inline styles only.
 *   • Never throws — every external call is try/catch wrapped.
 */

import { useEffect } from 'react';
import { isFeatureEnabled } from '../../config/features.js';
import { tStrict } from '../../i18n/strictT.js';
import StreakChip from './StreakChip.jsx';
import EngagementPlanCard from './EngagementPlanCard.jsx';
import EngagementWeeklySummary from './EngagementWeeklySummary.jsx';
import TodaysPriorityCard from './TodaysPriorityCard.jsx';
import { setupEngagementReminders } from '../../engine/engagementReminders.js';
import { setupHabitNotification } from '../../engine/habitNotifications.js';

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    margin: '0 0 16px',
  },
  chipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
};

export default function EngagementStrip({
  showWeekly  = true,
  showStreak  = true,
  weather     = null,
  style,
}) {
  const enabled  = isFeatureEnabled('dailyEngagement');
  const habitOn  = isFeatureEnabled('dailyHabit');

  // Register reminders only when the strip is actually mounted with
  // the flag on. Habit V2 fires ONE reminder/day; V1 fires morning
  // + afternoon. The two paths are mutually exclusive — we never
  // run both schedulers in the same session to avoid duplicate
  // notifications.
  useEffect(() => {
    if (!enabled) return undefined;
    let teardown = () => { /* noop */ };
    try {
      if (habitOn) {
        teardown = setupHabitNotification({
          copy: {
            title: tStrict('habit.reminder.title',
              'Your priority for today'),
            body:  tStrict('habit.reminder.body',
              'Open Farroway and tap today\u2019s priority action.'),
          },
        });
      } else {
        teardown = setupEngagementReminders({
          copy: {
            morning: {
              title: tStrict('engagement.reminder.morning.title',
                'Good morning \u2014 your plan is ready'),
              body:  tStrict('engagement.reminder.morning.body',
                'Open Farroway to see today\u2019s 2 simple actions.'),
            },
            afternoon: {
              title: tStrict('engagement.reminder.afternoon.title',
                'Still time \u2014 one quick action'),
              body:  tStrict('engagement.reminder.afternoon.body',
                'A 2-minute check today keeps your streak going.'),
            },
          },
        });
      }
    } catch { /* swallow — reminders never block render */ }
    return () => {
      try { teardown(); } catch { /* swallow */ }
    };
  }, [enabled, habitOn]);

  if (!enabled) return null;

  return (
    <div style={{ ...S.wrap, ...(style || null) }} data-testid="engagement-strip">
      {showStreak ? (
        <div style={S.chipRow}>
          <StreakChip />
        </div>
      ) : null}
      {habitOn
        ? <TodaysPriorityCard weather={weather} />
        : <EngagementPlanCard weather={weather} />}
      {showWeekly ? <EngagementWeeklySummary /> : null}
    </div>
  );
}
