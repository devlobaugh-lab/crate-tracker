import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { UserDataExportSchema, migrateToMultiSeries, AppStateSchema } from './validation';

describe('UserDataExportSchema', () => {
  describe('legacy allCrates validation', () => {
    it('accepts valid string arrays', () => {
      const result = UserDataExportSchema.safeParse({ allCrates: ['B', 'G', 'P', 'L'] });
      expect(result.success).toBe(true);
    });

    it('rejects non-string elements', () => {
      const result = UserDataExportSchema.safeParse({ allCrates: [1, 2, 3] });
      expect(result.success).toBe(false);
    });

    it('rejects mixed arrays', () => {
      const result = UserDataExportSchema.safeParse({ allCrates: ['B', 1, null] });
      expect(result.success).toBe(false);
    });
  });
});

describe('validateLegacyCratesArray', () => {
  const CratesArraySchema = z.array(z.string());

  it('rejects number arrays', () => {
    expect(CratesArraySchema.safeParse([1, 2, 3]).success).toBe(false);
  });

  it('rejects null elements', () => {
    expect(CratesArraySchema.safeParse(['B', null]).success).toBe(false);
  });

  it('accepts valid crate-type strings', () => {
    expect(CratesArraySchema.safeParse(['B', 'G', 'P', 'L', 'X', '?']).success).toBe(true);
  });

  it('accepts empty array', () => {
    expect(CratesArraySchema.safeParse([]).success).toBe(true);
  });
});

describe('migrateToMultiSeries', () => {
  it('handles valid legacy allCrates array', () => {
    const { data } = migrateToMultiSeries({ allCrates: ['B', 'G', 'P'] });
    expect(data.series[11].allCrates).toEqual(['B', 'G', 'P']);
  });

  it('returns default state for unknown format', () => {
    const { data } = migrateToMultiSeries({});
    expect(AppStateSchema.safeParse(data).success).toBe(true);
    expect(data.series).toHaveLength(12);
  });
});
