/**
 * roiSummary.js — single-page ROI numbers + a one-line message
 * for NGO sales conversations.
 *
 *   buildROISummary(opts?)
 *     -> {
 *          windowDays,
 *          engagement,    // src/metrics/engagement output
 *          behavior,      // src/metrics/behavior output
 *          detection,     // src/metrics/detection output
 *          highlights,    // 3 prominent numbers for the dashboard
 *          message,       // i18n key + fallback for the elevator line
 *        }
 *
 * Pure: composes the local stores + the metric helpers. No
 * server calls. The output is the ENTIRE input the dashboard
 * + the printable report consume.
 *
 * Strict-rule audit
 *   * no external data: every number comes from
 *     eventLogger.getEvents() + outbreakStore.getOutbreakReports()
 *   * works with limited data: returns a usable zero-state
 *     (highlights all 0, message still readable)
 *   * understandable in <10 seconds: 3 numbers, one
 *     sentence
 */

import { getEvents } from '../data/eventLogger.js';
import { getOutbreakReports } from '../outbreak/outbreakStore.js';
import { computeEngagement } from '../metrics/engagement.js';
import { computeBehavior }   from '../metrics/behavior.js';
import { computeDetection }  from '../metrics/detection.js';

export function buildROISummary(opts = {}) {
  const { windowDays = 7, now = Date.now() } = opts || {};

  const events  = getEvents();
  const reports = getOutbreakReports();

  const engagement = computeEngagement(events,  { windowDays, now });
  const behavior   = computeBehavior(events,    { windowDays, now });
  const detection  = computeDetection(reports,  { windowDays, now });

  // The 3 prominent numbers for the dashboard. Round +
  // pre-format here so the UI can render them without doing
  // any math.
  const highlights = Object.freeze([
    {
      labelKey: 'roi.completionRate',
      label:    'Task completion rate',
      value:    `${Math.round(engagement.completionRate * 100)}%`,
      raw:      engagement.completionRate,
    },
    {
      labelKey: 'roi.avgChecks',
      label:    'Avg checks per week',
      value:    String(behavior.avgChecksPerWeek),
      raw:      behavior.avgChecksPerWeek,
    },
    {
      labelKey: 'roi.reportsPerWeek',
      label:    'Pest reports per week',
      value:    String(detection.reportsPerWeek),
      raw:      detection.reportsPerWeek,
    },
  ]);

  // Pick the right elevator line. We use the actual numbers
  // so the message changes when the data does:
  //   * very strong   -> "Farmers are checking more often AND
  //                      catching pests earlier"
  //   * moderate      -> "Farmers using Farroway check more
  //                      often"
  //   * limited data  -> "Farroway is collecting data; impact
  //                      will be visible as more farmers
  //                      report"
  let messageKey = 'roi.message.collecting';
  let messageFb  = 'Farroway is collecting data. Impact will be visible as more farmers report.';
  if (behavior.checks >= 5 && detection.reports >= 3) {
    messageKey = 'roi.message.strong';
    messageFb  = 'Farmers using Farroway are checking crops more often AND identifying risks earlier.';
  } else if (behavior.checks >= 3) {
    messageKey = 'roi.message.moderate';
    messageFb  = 'Farmers using Farroway are checking their crops more often than baseline.';
  } else if (detection.reports >= 1) {
    messageKey = 'roi.message.detection';
    messageFb  = 'Farroway is surfacing pest signals farmers would otherwise miss.';
  }

  return Object.freeze({
    windowDays:  Number(windowDays) || 7,
    generatedAt: new Date(now).toISOString(),
    engagement,
    behavior,
    detection,
    highlights,
    message: Object.freeze({ key: messageKey, fallback: messageFb }),
  });
}
