/**
 * StandardDailyPlan.jsx — Standard Mode Daily Plan renderer (hard-split
 * partner of SimpleDailyPlan).
 *
 * Re-exports the existing DailyFarmPlanCard under the spec-named symbol
 * `StandardDailyPlan` so the runtime diagnostic + governance gate can
 * attest which renderer is active. DailyFarmPlanCard is the full standard
 * surface (Mark Done / Skip / Add Note / Scan Plant / View Full Plan +
 * next milestone + approximate time to harvest).
 */

import React from 'react';
import DailyFarmPlanCard from '../home/DailyFarmPlanCard.jsx';

export default function StandardDailyPlan() {
  return <DailyFarmPlanCard />;
}
