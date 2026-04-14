import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Upload Health Utility Tests ─────────────────────────

describe('Upload Health Utilities', () => {
  let isValidFileReference;

  beforeEach(async () => {
    const mod = await import('../utils/uploadHealth.js');
    isValidFileReference = mod.isValidFileReference;
  });

  describe('isValidFileReference', () => {
    it('accepts valid /uploads/ paths', () => {
      expect(isValidFileReference('/uploads/abc-123.jpg')).toBe(true);
      expect(isValidFileReference('/uploads/550e8400-e29b-41d4-a716-446655440000.png')).toBe(true);
    });

    it('accepts valid https URLs', () => {
      expect(isValidFileReference('https://storage.example.com/images/photo.jpg')).toBe(true);
      expect(isValidFileReference('http://localhost:4000/uploads/test.png')).toBe(true);
    });

    it('rejects directory traversal in /uploads/ paths', () => {
      expect(isValidFileReference('/uploads/../etc/passwd')).toBe(false);
      expect(isValidFileReference('/uploads/../../secret')).toBe(false);
    });

    it('rejects null bytes', () => {
      expect(isValidFileReference('/uploads/file\0.jpg')).toBe(false);
    });

    it('rejects empty or null values', () => {
      expect(isValidFileReference('')).toBe(false);
      expect(isValidFileReference(null)).toBe(false);
      expect(isValidFileReference(undefined)).toBe(false);
    });

    it('rejects paths with subdirectories in /uploads/', () => {
      expect(isValidFileReference('/uploads/subdir/file.jpg')).toBe(false);
    });

    it('rejects bare relative paths', () => {
      expect(isValidFileReference('file.jpg')).toBe(false);
      expect(isValidFileReference('./uploads/file.jpg')).toBe(false);
    });
  });
});

// ─── Upload Cleanup Middleware Tests ─────────────────────

describe('Upload Cleanup Middleware', () => {
  let uploadCleanup;

  beforeEach(async () => {
    const mod = await import('../middleware/uploadCleanup.js');
    uploadCleanup = mod.uploadCleanup;
  });

  it('calls next and does not interfere on success', () => {
    const req = {};
    const res = {
      statusCode: 200,
      end: vi.fn(),
    };
    let nextCalled = false;
    uploadCleanup(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('wraps res.end to intercept error responses', () => {
    const req = { file: { path: '/tmp/test-file.jpg' } };
    const originalEnd = vi.fn();
    const res = {
      statusCode: 200,
      end: originalEnd,
    };
    uploadCleanup(req, res, () => {});

    // res.end should be replaced
    expect(res.end).not.toBe(originalEnd);
  });
});

// ─── Image Validation with File Reference Check ─────────

vi.mock('../config/database.js', () => {
  const mockPrisma = {
    farmer: { findUnique: vi.fn() },
    farmSeason: { findUnique: vi.fn(), update: vi.fn() },
    seasonProgressEntry: { findMany: vi.fn(), create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    officerValidation: { count: vi.fn().mockResolvedValue(0) },
    farmActivity: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (fn) => fn(mockPrisma)),
  };
  return { default: mockPrisma };
});

vi.mock('../modules/regionConfig/service.js', () => ({
  DEFAULT_COUNTRY_CODE: 'KE',
  getRegionConfig: () => ({
    areaUnit: 'acres', currencyCode: 'KES', country: 'Kenya',
    cropCalendars: { maize: { growingDays: 120 } },
  }),
}));

import prisma from '../config/database.js';
import { addProgressImage } from '../modules/seasons/imageValidation.js';

describe('Image Validation — File Reference Safety', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const mockSeason = {
    id: 's-1', farmerId: 'f-1', cropType: 'maize', status: 'active',
    plantingDate: new Date(Date.now() - 30 * 86400000),
    farmer: { countryCode: 'KE' },
  };

  it('rejects directory traversal in imageUrl', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason);

    await expect(addProgressImage('s-1', {
      imageUrl: '/uploads/../etc/passwd',
      imageStage: 'early_growth',
    })).rejects.toThrow(/Invalid imageUrl/);
  });

  it('rejects bare filename without path prefix', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason);

    await expect(addProgressImage('s-1', {
      imageUrl: 'just-a-filename.jpg',
      imageStage: 'early_growth',
    })).rejects.toThrow(/Invalid imageUrl/);
  });

  it('accepts valid /uploads/ path', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason);

    const mockEntry = { id: 'e-1', imageUrl: '/uploads/valid-image.jpg' };
    prisma.seasonProgressEntry.create.mockResolvedValue(mockEntry);
    prisma.farmSeason.update.mockResolvedValue({});

    const { entry } = await addProgressImage('s-1', {
      imageUrl: '/uploads/valid-image.jpg',
      imageStage: 'early_growth',
    });
    expect(entry.imageUrl).toBe('/uploads/valid-image.jpg');
  });

  it('accepts valid https URL', async () => {
    prisma.farmSeason.findUnique.mockResolvedValue(mockSeason);

    const mockEntry = { id: 'e-2', imageUrl: 'https://cdn.example.com/image.jpg' };
    prisma.seasonProgressEntry.create.mockResolvedValue(mockEntry);
    prisma.farmSeason.update.mockResolvedValue({});

    const { entry } = await addProgressImage('s-1', {
      imageUrl: 'https://cdn.example.com/image.jpg',
      imageStage: 'mid_stage',
    });
    expect(entry.imageUrl).toBe('https://cdn.example.com/image.jpg');
  });
});
