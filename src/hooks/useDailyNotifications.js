/**
 * useDailyNotifications — ties the notification engine to the running app.
 *
 * Runs once per session (guarded by a ref) after the farmer's Home data
 * has loaded. Feeds the same inputs Home uses — current task, urgency,
 * weather, forecast, crop stage — into getDailyNotificationDecision().
 *
 * If a notification should be sent, it is:
 *   1. recorded in history (→ dedupes future runs)
 *   2. delivered as a browser notification (if permission granted)
 *   3. exposed to the caller so Home can render an in-app banner
 *
 * Spec §3: at most one daily notification per day. Dedupe is enforced
 * inside the pure engine via the history ring buffer.
 */
import { useEffect, useRef, useState } from 'react';
import { getDailyNotificationDecision } from '../engine/notificationEngine.js';
import { deliverNotification } from '../services/notificationService.js';
import { getHistory } from '../services/notificationHistory.js';
import { getPreferences } from '../services/notificationPreferences.js';

/**
 * @param {Object} args
 * @param {Object} args.farm          - active farm profile
 * @param {Object} args.currentTask   - the same task Home renders
 * @param {string} args.urgency       - urgency from the view model
 * @param {string} args.actionKey     - actionKey from the view model
 * @param {string} args.cropStage
 * @param {Object} args.weather
 * @param {Object} args.forecast      - rainfall engine output
 * @param {number} args.fetchedAt     - epoch ms when weather was fetched
 * @param {boolean} args.completedToday
 * @param {Function} args.t           - i18n translate
 */
export function useDailyNotifications(args) {
  const [lastDecision, setLastDecision] = useState(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    // Wait until we actually have the pieces we need.
    if (!args || !args.farm || !args.t) return;
    // If there's no task AND no weather yet, don't fire — we'd be forced
    // to skip with skipReason='no_context' and waste a run.
    if (!args.currentTask && !args.weather) return;

    firedRef.current = true;

    const history = getHistory();
    const preferences = getPreferences();

    const decision = getDailyNotificationDecision({
      farm: args.farm,
      crop: args.farm?.cropType || args.farm?.crop,
      cropStage: args.cropStage,
      weather: args.weather,
      forecast: args.forecast,
      currentTask: args.currentTask,
      urgency: args.urgency,
      actionKey: args.actionKey,
      completedToday: !!args.completedToday,
      history,
      weatherFetchedAt: args.fetchedAt,
      preferences,
      now: new Date(),
    });

    setLastDecision(decision);

    if (decision.shouldSend) {
      deliverNotification(decision, args.t);
    }
  }, [args]); // deps intentionally include the stable args object; the ref gate prevents repeats

  return { decision: lastDecision };
}
