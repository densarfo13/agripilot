/**
 * sellDecisionEngine — honest "should I sell today?" decision support (Market Intelligence MVP).
 *
 * Composes REAL signals only — buyer interest (marketDemand) and whether a price reference
 * exists — into one of four verdicts. It NEVER invents a market price or a price value: when
 * there is nothing to compare it says so (NEED_MORE_PRICE_DATA), and it only says WAIT when a
 * real rising-price signal is present (not a guess). SELL_NOW is driven by real buyer demand,
 * not a fabricated price.
 *
 * Pure. Never throws. Returns i18n key + English fallback for every farmer-facing string
 * (the `{count}` token is interpolated by the caller).
 */
export type SellDecisionCode = 'SELL_NOW' | 'WAIT' | 'NEED_MORE_PRICE_DATA' | 'NO_BUYERS_FOUND';

export interface SellDecisionInput {
  buyerInterestCount: number;            // real buyers looking for this crop
  priceAvailable: boolean;               // a price reference exists to compare against
  priceTrend?: 'up' | 'down' | 'flat';   // ONLY set from a real live feed; absent today
}

export interface SellDecision {
  code: SellDecisionCode;
  titleKey: string; titleFallback: string;
  reasonKey: string; reasonFallback: string;     // may contain {count}
  nextStepKey: string; nextStepFallback: string;
  /** True only when the verdict rests on a real price reference/trend (not demand alone). */
  priceBacked: boolean;
}

function _verdict(
  code: SellDecisionCode, priceBacked: boolean,
  titleFallback: string, reasonFallback: string, nextStepFallback: string,
): SellDecision {
  const k = code.toLowerCase();
  return Object.freeze({
    code,
    titleKey: `sell.decision.${k}.title`, titleFallback,
    reasonKey: `sell.decision.${k}.reason`, reasonFallback,
    nextStepKey: `sell.decision.${k}.nextStep`, nextStepFallback,
    priceBacked,
  });
}

export function decideSell(input: SellDecisionInput): SellDecision {
  const buyers = (typeof input?.buyerInterestCount === 'number' && input.buyerInterestCount > 0)
    ? Math.floor(input.buyerInterestCount) : 0;
  const priceAvailable = input?.priceAvailable === true;
  const trend = input?.priceTrend;

  // No demand → nothing to sell into yet. List so buyers can find it.
  if (buyers <= 0) {
    return _verdict('NO_BUYERS_FOUND', false,
      'No buyers yet',
      'No buyers are looking for this crop in your area right now.',
      'List your produce so buyers can find you.');
  }

  // Real rising-price signal (only ever set by a live feed) → waiting may fetch more.
  if (priceAvailable && trend === 'up') {
    return _verdict('WAIT', true,
      'You may get more by waiting',
      '{count} buyers are interested, and local prices are rising — waiting could fetch a better price.',
      'Hold for now and re-check in a few days.');
  }

  // Buyers but nothing to compare on price → ask for a local price. NEVER invent one.
  if (!priceAvailable) {
    return _verdict('NEED_MORE_PRICE_DATA', false,
      'Add a price to compare',
      '{count} buyers are interested, but price data is not available yet to judge timing.',
      'Enter a local price to compare later.');
  }

  // Real demand + a price to compare against → a good time to sell.
  return _verdict('SELL_NOW', true,
    'Good time to sell',
    '{count} buyers are interested and you have a price to compare.',
    'Contact buyers or list your crop now.');
}
