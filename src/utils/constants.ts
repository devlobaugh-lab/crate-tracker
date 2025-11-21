/**
 * Application constants for the Crate Tracker
 */

// Import package.json to get version dynamically
import packageJson from '../../package.json';

// Crate type interface
export interface CrateType {
  key: string;
  color: string;
  label: string;
  value: string;
}

// Crate types with their properties
export const CRATE_TYPES: CrateType[] = [
  { key: 'Green', color: 'bg-green-700', label: 'Green', value: 'B' },
  { key: 'Gold', color: 'bg-yellow-400', label: 'Gold', value: 'G' },
  { key: 'Platinum', color: 'bg-gray-400', label: 'Platinum', value: 'P' },
  { key: 'Legendary', color: 'bg-amber-700', label: 'Legendary', value: 'L' },
  { key: 'GP', color: 'bg-blue-500', label: 'GP', value: 'X' },
  { key: 'Unknown', color: 'bg-white', label: 'Unknown', value: '?' },
];

// Master pattern for crate predictions (F1 Clash pattern)
export const MASTER_PATTERN: string = `BBBBBBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBGBBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBG
BBBGBBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBLBBGBBBGBBBBGBGBBBBGBBBBGBBG
BBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBL
BBBBBBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBGBBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBG
BBBGBBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBLBBGBBBGBBBBGBGBBBBGBBBBGBBG
BBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBL
BBBBBBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBGBBBBBPBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBB
GBBBGBBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBLBBGBBBGBBBBGBGBBBBGBBBBGBB
GBBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBL`;

// Storage and app configuration
export const STORAGE_KEY: string = 'crate-tracker:v1';
export const APP_VERSION: string = packageJson.version;

// Valid characters for pattern matching
export const VALID_CRATE_CHARS: string[] = ['B', 'G', 'P', 'L'];

// Pattern prediction configuration
export const PREDICTION_COUNT: number = 10;
