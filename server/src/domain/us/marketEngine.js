/**
 * marketEngine.js — lightweight market + profitability layer.
 *
 * Inputs:
 *   rule.marketStrength           'low' | 'medium' | 'high'
 *   rule.localSellValue (optional) for backyard direct-market hints
 *   farmType                       'backyard' | 'small_farm' | 'commercial'
 *
 * Outputs:
 *   marketDemand:         'high_demand' | 'medium' | 'low'
 *   profitability:        'low' | 'medium' | 'high'
 *   marketTags[]:         human-facing pill labels
 *
 * Profitability is a simple composite:
 *   commercial / small_farm → map marketStrength directly
 *   backyard                → look at localSellValue first,
 *                             then fall back to marketStrength / 2
 */

function mapDemand(marketStrength) {
  if (marketStrength === 'high') return 'high_demand';
  if (marketStrength === 'medium') return 'medium';
  return 'low';
}

function profitabilityFor({ farmType, marketStrength, localSellValue }) {
  if (farmType === 'backyard') {
    if (localSellValue === 'high') return 'high';
    if (localSellValue === 'medium') return 'medium';
    // Home-use farms have no commercial upside — default low.
    return marketStrength === 'high' ? 'medium' : 'low';
  }
  // Commercial / small-farm track straight off marketStrength.
  return marketStrength === 'high' ? 'high'
       : marketStrength === 'medium' ? 'medium' : 'low';
}

function tagsFor({ demand, profitability, localSellValue }) {
  const tags = [];
  if (demand === 'high_demand') tags.push('high_demand');
  if (profitability === 'high') tags.push('high_profitability');
  if (localSellValue === 'high') tags.push('direct_market');
  return tags;
}

export function assessMarket({ rule, farmType }) {
  const marketStrength = rule.marketStrength || 'medium';
  const localSellValue = rule.localSellValue || null;
  const demand = mapDemand(marketStrength);
  const profitability = profitabilityFor({ farmType, marketStrength, localSellValue });
  const marketTags = tagsFor({ demand, profitability, localSellValue });
  return { marketDemand: demand, profitability, marketTags };
}
