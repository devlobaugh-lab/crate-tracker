import { useMemo } from 'react';
import { nextPatternValues, getCrateTypesFromValues } from '../utils/patternUtils.js';
import { MASTER_PATTERN } from '../utils/constants.js';

/**
 * Custom hook for crate pattern prediction logic
 * @param {string[]} allCrates - Array of all crate values
 * @returns {Object} Pattern prediction data and utilities
 */
export function useCratePattern(allCrates) {
  // Memoize pattern predictions to avoid expensive calculations on every render
  const patternData = useMemo(() => {
    if (!allCrates || allCrates.length === 0) {
      return {
        lastTen: [],
        futureTen: [],
        predictions: []
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
      predictionValues: predictions
    };
  }, [allCrates]);

  return patternData;
}
