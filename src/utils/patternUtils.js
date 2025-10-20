import { CRATE_TYPES, VALID_CRATE_CHARS, PREDICTION_COUNT } from './constants.js';

/**
 * Pattern prediction utilities for F1 Clash crate tracking
 */

/**
 * Generates the next N pattern values based on user input and the master pattern
 * @param {string[]} userInput - Array of crate values from user input
 * @param {string} masterPattern - The master pattern string
 * @returns {string[]} Array of predicted next crate values
 */
export function nextPatternValues(userInput, masterPattern) {
  // Clean up pattern (remove whitespace, newlines, etc.)
  const pattern = masterPattern.replace(/\s+/g, '');

  // Filter only valid input values
  const validInputs = userInput.filter(v => VALID_CRATE_CHARS.includes(v));

  // If no valid inputs, return unknowns
  if (validInputs.length === 0) {
    return Array(PREDICTION_COUNT).fill('?');
  }

  const matches = [];

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
  const predictions = matches.map(start => {
    const arr = [];
    for (let i = validInputs.length; i < validInputs.length + PREDICTION_COUNT; i++) {
      arr.push(pattern[(start + i) % pattern.length]);
    }
    return arr;
  });

  // Combine predictions — '?' where multiple possibilities disagree
  const result = [];
  for (let i = 0; i < PREDICTION_COUNT; i++) {
    const chars = predictions.map(p => p[i]);
    const allSame = chars.every(c => c === chars[0]);
    result.push(allSame ? chars[0] : '?');
  }

  return result;
}

/**
 * Converts crate values to crate type objects for display
 * @param {string[]} crateValues - Array of crate values ('B', 'G', 'P', 'L', 'X', '?')
 * @returns {Object[]} Array of crate type objects with display properties
 */
export function getCrateTypesFromValues(crateValues) {
  return crateValues.map(value => {
    const crateType = CRATE_TYPES.find(t => t.value === value);
    return crateType || CRATE_TYPES.find(t => t.value === '?');
  });
}

/**
 * Validates if a crate value is valid
 * @param {string} value - The crate value to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidCrateValue(value) {
  return VALID_CRATE_CHARS.includes(value) || value === 'X' || value === '?';
}

/**
 * Gets the next crate value from the pattern based on current position
 * @param {string[]} currentCrates - Current crate history
 * @param {string} masterPattern - Master pattern string
 * @returns {string|null} Next crate value or null if cannot determine
 */
export function getNextCrateValue(currentCrates, masterPattern) {
  if (currentCrates.length === 0) return null;

  const predictions = nextPatternValues(currentCrates, masterPattern);
  return predictions.length > 0 ? predictions[0] : null;
}
