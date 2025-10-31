import { CRATE_TYPES, VALID_CRATE_CHARS, PREDICTION_COUNT, CrateType } from './constants';

/**
 * Pattern prediction utilities for F1 Clash crate tracking
 */

/**
 * Generates the next N pattern values based on user input and the master pattern
 * @param userInput - Array of crate values from user input
 * @param masterPattern - The master pattern string
 * @returns Array of predicted next crate values
 */
export function nextPatternValues(userInput: string[], masterPattern: string): string[] {
  // Clean up pattern (remove whitespace, newlines, etc.)
  const pattern = masterPattern.replace(/\s+/g, '');

  // Filter only valid input values
  const validInputs = userInput.filter((v: string) => VALID_CRATE_CHARS.includes(v));

  // If no valid inputs, return unknowns
  if (validInputs.length === 0) {
    return Array(PREDICTION_COUNT).fill('?');
  }

  const matches: number[] = [];

  // Try every possible starting position in the pattern
  for (let start = 0; start < pattern.length; start++) {
    let fits = true;
    for (let i = 0; i < validInputs.length; i++) {
      const expected = pattern[(start + i) % pattern.length];
      if (validInputs[i] !== expected) {
        fits = false;
        break;
      }
    }
    if (fits) {
      matches.push(start);
    }
  }

  // If no match found, all outputs are unknown
  if (matches.length === 0) {
    return Array(PREDICTION_COUNT).fill('?');
  }

  // Generate next values for each matching offset
  const predictions = matches.map((start: number) => {
    const arr: string[] = [];
    for (let i = validInputs.length; i < validInputs.length + PREDICTION_COUNT; i++) {
      arr.push(pattern[(start + i) % pattern.length]);
    }
    return arr;
  });

  // Combine predictions — '?' where multiple possibilities disagree
  const result: string[] = [];
  for (let i = 0; i < PREDICTION_COUNT; i++) {
    const chars = predictions.map((p: string[]) => p[i]);
    const allSame = chars.every((c: string) => c === chars[0]);
    result.push(allSame ? chars[0] : '?');
  }

  return result;
}

/**
 * Converts crate values to crate type objects for display
 * @param crateValues - Array of crate values ('B', 'G', 'P', 'L', 'X', '?')
 * @returns Array of crate type objects with display properties
 */
export function getCrateTypesFromValues(crateValues: string[]): CrateType[] {
  return crateValues.map((value: string) => {
    return CRATE_TYPES.find((t: CrateType) => t.value === value) ?? CRATE_TYPES[5]; // Index 5 is Unknown
  });
}

/**
 * Validates if a crate value is valid
 * @param value - The crate value to validate
 * @returns True if valid, false otherwise
 */
export function isValidCrateValue(value: string): boolean {
  return VALID_CRATE_CHARS.includes(value) || value === 'X' || value === '?';
}

/**
 * Gets the next crate value from the pattern based on current position
 * @param currentCrates - Current crate history
 * @param masterPattern - Master pattern string
 * @returns Next crate value or null if cannot determine
 */
export function getNextCrateValue(currentCrates: string[], masterPattern: string): string | null {
  if (currentCrates.length === 0) return null;

  const predictions = nextPatternValues(currentCrates, masterPattern);
  return predictions.length > 0 ? predictions[0] : null;
}

/**
 * Finds the next known Platinum ('P') or Legendary ('L') crate in predictions
 * Only looks within the standard 10 prediction window
 * @param predictions - Array of predicted crate values ('B', 'G', 'P', 'L', 'X', or '?')
 * @returns Object with count (number of crates until next special) and type, or null if none found
 */
export function findNextSpecialCrate(predictions: string[]): { count: number; type: string } | null {
  for (let i = 0; i < predictions.length; i++) {
    const prediction = predictions[i];

    if (prediction === 'P') {
      return { count: i + 1, type: 'Platinum' };
    }
    if (prediction === 'L') {
      return { count: i + 1, type: 'Legendary' };
    }
    // Skip ambiguous predictions and continue looking
    if (prediction === '?') continue;
  }

  // No Platinum or Legend found in predictions
  return null;
}

/**
 * Finds the next known Platinum ('P') or Legendary ('L') crate by looking further ahead
 * Extends beyond the standard prediction window to find special crates
 * @param userInput - Current user crate history
 * @param masterPattern - Master pattern string
 * @returns Object with count and type, or null if none found in extended search
 */
export function findNextSpecialCrateExtended(userInput: string[], masterPattern: string): { count: number; type: string } | null {
  const maxLookAhead = 100; // Look up to 100 crates ahead

  // Clean up pattern
  const pattern = masterPattern.replace(/\s+/g, '');

  // Filter only valid input values
  const validInputs = userInput.filter((v: string) => VALID_CRATE_CHARS.includes(v));

  // If no valid inputs, can't predict
  if (validInputs.length === 0) return null;

  const matches: number[] = [];

  // Try every possible starting position in the pattern
  for (let start = 0; start < pattern.length; start++) {
    let fits = true;
    for (let i = 0; i < validInputs.length; i++) {
      const expected = pattern[(start + i) % pattern.length];
      if (validInputs[i] !== expected) {
        fits = false;
        break;
      }
    }
    if (fits) {
      matches.push(start);
    }
  }

  // If no match found, can't predict
  if (matches.length === 0) return null;

  // For each matching offset, look ahead to find the next P or L
  for (const start of matches) {
    for (let i = validInputs.length; i < validInputs.length + maxLookAhead; i++) {
      const predictedChar = pattern[(start + i) % pattern.length];

      if (predictedChar === 'P') {
        return { count: i - validInputs.length + 1, type: 'Platinum' };
      }
      if (predictedChar === 'L') {
        return { count: i - validInputs.length + 1, type: 'Legendary' };
      }
    }
  }

  // No special crates found in extended search
  return null;
}
