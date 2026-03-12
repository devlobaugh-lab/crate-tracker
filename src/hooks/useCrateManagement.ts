import { useCallback } from 'react';
import { getNextCrateValue } from '../utils/patternUtils';
import { MASTER_PATTERN, CRATE_TYPES } from '../utils/constants';
import logger from '../utils/logger';

// Define the state interface
interface AppState {
  series: { allCrates: string[] }[];
  config: {
    wins: number;
    gpWins: number;
  };
}

interface UseCrateManagementOptions {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  setIgnoreRemoteChanges: (ignore: boolean) => void;
  currentSeriesIndex: number;
}

interface UseCrateManagementReturn {
  addCrate: (crateKey: string) => void;
  undoCrate: () => void;
  fastForwardSubmit: (additionalGP: number, newTotal: number) => void;
}

/**
 * Custom hook for managing crate-related operations including adding, undoing,
 * and bulk fast-forward operations using the prediction algorithm.
 *
 * Operations apply only to the series at currentSeriesIndex. Global config
 * (wins, gpWins) tracks cross-series totals.
 *
 * @param options - Configuration options including state, state setter, and current series index
 * @returns Object containing crate management functions
 */
export function useCrateManagement({
  state,
  setState,
  setIgnoreRemoteChanges,
  currentSeriesIndex,
}: UseCrateManagementOptions): UseCrateManagementReturn {
  /**
   * Adds a new crate to the current series and updates global win counters.
   *
   * @param crateKey - The key identifier for the crate type (e.g., 'GP', 'N', etc.)
   */
  const addCrate = useCallback(
    (crateKey: string): void => {
      const crateType = CRATE_TYPES.find(t => t.key === crateKey);
      const crateValue = crateType ? crateType.value : '?';
      const newConfig = { ...state.config };
      newConfig.wins += 1;
      if (crateKey === 'GP') newConfig.gpWins += 1;

      const newSeries = state.series.map((s, i) =>
        i === currentSeriesIndex ? { allCrates: [...s.allCrates, crateValue] } : s
      );

      logger.log(`➕ Adding crate: ${crateKey} (${crateValue}) - Total wins: ${newConfig.wins}`);

      setState({ ...state, series: newSeries, config: newConfig });
    },
    [state, setState, currentSeriesIndex]
  );

  /**
   * Removes the last crate from the current series and adjusts global win counters.
   */
  const undoCrate = useCallback((): void => {
    const currentAllCrates = state.series[currentSeriesIndex]?.allCrates ?? [];
    if (currentAllCrates.length === 0) {
      logger.log('⚠️ No crates to undo');
      return;
    }

    const lastCrate = currentAllCrates[currentAllCrates.length - 1];
    const newAllCrates = currentAllCrates.slice(0, -1);
    const newConfig = { ...state.config };
    newConfig.wins -= 1;
    if (lastCrate === 'X') newConfig.gpWins -= 1; // 'X' represents GP crates

    const newSeries = state.series.map((s, i) =>
      i === currentSeriesIndex ? { allCrates: newAllCrates } : s
    );

    logger.log(`↶ Undoing crate: ${lastCrate} - Total wins: ${newConfig.wins}`);

    setState({ ...state, series: newSeries, config: newConfig });
  }, [state, setState, currentSeriesIndex]);

  /**
   * Fast-Forward Bulk Operation Algorithm
   *
   * Business Logic:
   * - Allows users to "catch up" by bulk-adding crates to match their current win counts
   * - Preserves GP win accuracy by adding GP crates first
   * - Uses prediction algorithm for remaining wins to maintain pattern consistency
   * - Temporarily disables real-time sync to prevent conflicts during bulk operations
   * - Only modifies the current series; all other series remain unchanged
   * - Global config.wins and config.gpWins reflect cross-series totals
   *
   * @param additionalGP - Number of additional GP wins to add to current GP count
   * @param newTotal - Target total win count to reach
   */
  const fastForwardSubmit = useCallback(
    (additionalGP: number, newTotal: number) => {
      const currentGP = state.config.gpWins;
      const currentSeriesAllCrates = state.series[currentSeriesIndex]?.allCrates ?? [];

      const diffGP = additionalGP;
      const diffTotal = newTotal - (state.config.wins + additionalGP);

      logger.log(`🚀 Fast-forward: Adding ${diffGP} GP crates and ${diffTotal} total crates`);
      logger.log(`🚀 Target: ${newTotal} total wins (${currentGP + diffGP} GP wins)`);

      let newAllCrates = [...currentSeriesAllCrates];
      const newConfig = { ...state.config, gpWins: currentGP + diffGP };

      // Add GP crates first
      for (let i = 0; i < diffGP; i++) {
        newAllCrates = [...newAllCrates, 'X']; // 'X' represents GP crates
        newConfig.wins += 1;
      }

      // Add remaining total wins using predictor
      for (let i = 0; i < diffTotal; i++) {
        const next = getNextCrateValue(newAllCrates, MASTER_PATTERN) || '?';
        newAllCrates = [...newAllCrates, next];
        newConfig.wins += 1;
      }

      logger.log(
        `✅ Fast-forward complete: ${newAllCrates.length} total crates in series, ${newConfig.wins} wins`
      );

      const newSeries = state.series.map((s, i) =>
        i === currentSeriesIndex ? { allCrates: newAllCrates } : s
      );

      setState({ ...state, series: newSeries, config: newConfig });

      // Ignore remote changes for a longer period due to bulk additions
      setIgnoreRemoteChanges(true);
      setTimeout(() => setIgnoreRemoteChanges(false), 10000);
    },
    [state, setState, setIgnoreRemoteChanges, currentSeriesIndex]
  );

  return {
    addCrate,
    undoCrate,
    fastForwardSubmit,
  };
}
