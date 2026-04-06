import { describe, it, expect } from 'vitest';
import {
  getRegionConfig,
  getStorageDefault,
  getCropCalendar,
  getCountryCodes,
  listRegionConfigs,
  getCropsForCountry,
  getRegionsForCountry,
  DEFAULT_COUNTRY_CODE,
} from '../modules/regionConfig/service.js';

describe('Region Config Service', () => {
  describe('DEFAULT_COUNTRY_CODE', () => {
    it('should be KE', () => {
      expect(DEFAULT_COUNTRY_CODE).toBe('KE');
    });
  });

  describe('getRegionConfig', () => {
    it('returns Kenya config for KE', () => {
      const cfg = getRegionConfig('KE');
      expect(cfg.country).toBe('Kenya');
      expect(cfg.currencyCode).toBe('KES');
      expect(cfg.areaUnit).toBe('acres');
    });

    it('returns Tanzania config for TZ', () => {
      const cfg = getRegionConfig('TZ');
      expect(cfg.country).toBe('Tanzania');
      expect(cfg.currencyCode).toBe('TZS');
      expect(cfg.areaUnit).toBe('hectares');
    });

    it('is case-insensitive', () => {
      expect(getRegionConfig('ke').country).toBe('Kenya');
      expect(getRegionConfig('tz').country).toBe('Tanzania');
    });

    it('falls back to KE for unknown country codes', () => {
      const cfg = getRegionConfig('XX');
      expect(cfg.country).toBe('Kenya');
    });

    it('falls back to KE for null/undefined', () => {
      expect(getRegionConfig(null).country).toBe('Kenya');
      expect(getRegionConfig(undefined).country).toBe('Kenya');
    });

    it('includes fraud proximity config', () => {
      const ke = getRegionConfig('KE');
      expect(ke.fraudProximityDegrees).toBe(0.001);
    });

    it('includes loan limits', () => {
      const ke = getRegionConfig('KE');
      expect(ke.maxLoanAmount).toBe(5000000);
      expect(ke.minLoanAmount).toBe(5000);

      const tz = getRegionConfig('TZ');
      expect(tz.maxLoanAmount).toBe(50000000);
      expect(tz.minLoanAmount).toBe(50000);
    });

    it('includes verification thresholds', () => {
      expect(getRegionConfig('KE').verificationThreshold).toBe(70);
      expect(getRegionConfig('TZ').verificationThreshold).toBe(65);
    });
  });

  describe('getStorageDefault', () => {
    it('returns crop-specific storage defaults for KE maize', () => {
      const d = getStorageDefault('KE', 'maize');
      expect(d.method).toBe('hermetic_bag');
      expect(d.maxDays).toBe(180);
    });

    it('returns crop-specific storage defaults for TZ cashew', () => {
      const d = getStorageDefault('TZ', 'cashew');
      expect(d.method).toBe('warehouse');
      expect(d.maxDays).toBe(365);
    });

    it('returns generic defaults for unknown crop', () => {
      const d = getStorageDefault('KE', 'mango');
      expect(d.method).toBe('warehouse');
      expect(d.maxDays).toBe(90);
    });

    it('handles case-insensitive crop type', () => {
      const d = getStorageDefault('KE', 'MAIZE');
      expect(d.method).toBe('hermetic_bag');
    });
  });

  describe('getCropCalendar', () => {
    it('returns planting/harvest months for KE maize', () => {
      const cal = getCropCalendar('KE', 'maize');
      expect(cal).not.toBeNull();
      expect(cal.plantMonths).toContain(3);
      expect(cal.growingDays).toBe(120);
    });

    it('returns null for unknown crop', () => {
      expect(getCropCalendar('KE', 'avocado')).toBeNull();
    });
  });

  describe('getCountryCodes', () => {
    it('returns KE and TZ', () => {
      const codes = getCountryCodes();
      expect(codes).toContain('KE');
      expect(codes).toContain('TZ');
    });
  });

  describe('listRegionConfigs', () => {
    it('returns array with code property', () => {
      const list = listRegionConfigs();
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0]).toHaveProperty('code');
      expect(list[0]).toHaveProperty('country');
    });
  });

  describe('getCropsForCountry', () => {
    it('returns KE crops including maize and coffee', () => {
      const crops = getCropsForCountry('KE');
      expect(crops).toContain('maize');
      expect(crops).toContain('coffee');
    });

    it('returns TZ crops including cashew', () => {
      const crops = getCropsForCountry('TZ');
      expect(crops).toContain('cashew');
    });
  });

  describe('getRegionsForCountry', () => {
    it('returns KE regions', () => {
      const regions = getRegionsForCountry('KE');
      expect(regions).toContain('Nakuru');
    });

    it('returns TZ regions', () => {
      const regions = getRegionsForCountry('TZ');
      expect(regions).toContain('Arusha');
    });
  });
});
