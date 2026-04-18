/**
 * MarketContext — crop price signals for the farmer's country.
 *
 * Lightweight context: loads signals once per country change.
 * No external API calls yet — uses seasonal pattern data from
 * marketDataService.js. Will switch to live feeds when connected.
 *
 * Provides:
 *   - signals: active price signals for the country
 *   - getSignal(cropCode): get signal for a specific crop
 *   - hasMarketData: whether any data exists for this country
 */
import { createContext, useContext, useMemo } from 'react';
import { useProfile } from './ProfileContext.jsx';
import {
  getCountryPriceSignals,
  getCropPriceSignal,
  isMarketDataAvailable,
} from '../services/marketDataService.js';

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
  const { profile } = useProfile();
  const countryCode = profile?.countryCode || '';

  const hasMarketData = useMemo(
    () => isMarketDataAvailable(countryCode),
    [countryCode],
  );

  const signals = useMemo(() => {
    if (!hasMarketData) return [];
    return getCountryPriceSignals({ countryCode, limit: 8 });
  }, [countryCode, hasMarketData]);

  const getSignal = useMemo(() => {
    if (!hasMarketData) return () => null;
    return (cropCode) => getCropPriceSignal({ cropCode, countryCode });
  }, [countryCode, hasMarketData]);

  const value = useMemo(() => ({
    signals,
    getSignal,
    hasMarketData,
    countryCode,
  }), [signals, getSignal, hasMarketData, countryCode]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const context = useContext(MarketContext);
  if (!context) throw new Error('useMarket must be used within MarketProvider');
  return context;
}
