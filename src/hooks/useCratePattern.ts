import { useMemo } from 'react';
import { nextPatternValues, getCrateTypesFromValues } from '../utils/patternUtils';
import { MASTER_PATTERN } from '../utils/constants';

/**
 * Custom hook for crate pattern prediction logic
 */
interface PatternData {
  lastTen: any[];
  futureTen: any[];
  predictions: string[];
  lastTenValues: string[];
  predictionValues: string[];
}

export function useCratePattern(allCrates: string[]): PatternData {
  // Memoize pattern predictions to avoid expensive calculations on every render
  const patternData = useMemo((): PatternData => {
    if (!allCrates || allCrates.length === 0) {
      return {
        lastTen: [],
        futureTen: [],
        predictions: [],
        lastTenValues: [],
        predictionValues: [],
      };
    }

    // Get last 10 crates for display
    const lastTenValues = allCrates.slice(-10);
    const lastTen = getCrateTypesFromValues(lastTenValues);

    // Get next 10 predictions
    const predictions = nextPatternValues(allCrates, MASTER_PATTERN);
    const futureTen = getCrateTypesFromValues(predictions);

    return {
      lastTen,
      futureTen,
      predictions,
      lastTenValues,
      predictionValues: predictions,
    };
  }, [allCrates]);

  return patternData;
}
