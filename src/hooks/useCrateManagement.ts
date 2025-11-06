import { useCallback } from 'react';
import { getNextCrateValue } from '../utils/patternUtils';
import { MASTER_PATTERN, CRATE_TYPES } from '../utils/constants';
import logger from '../utils/logger';

// Define the state interface
interface AppState {
  allCrates: string[];
  config: {
    wins: number;
    gpWins: number;
  };
}

interface UseCrateManagementOptions {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  setIgnoreRemoteChanges: (ignore: boolean) => void;
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
 * @param options - Configuration options including state and state setter
 * @returns Object containing crate management functions
 */
export function useCrateManagement({
  state,
  setState,
  setIgnoreRemoteChanges,
}: UseCrateManagementOptions): UseCrateManagementReturn {
  /**
   * Adds a new crate to the history and updates win counters.
   * Uses the CRATE_TYPES configuration to determine crate values and win tracking.
   *
   * @param crateKey - The key identifier for the crate type (e.g., 'GP', 'N', etc.)
   */
  const addCrate = useCallback(
    (crateKey: string): void => {
      const crateType = CRATE_TYPES.find(t => t.key === crateKey);
      const crateValue = crateType ? crateType.value : '?';
      const newAll = [...state.allCrates, crateValue];
      const newConfig = { ...state.config };
      newConfig.wins += 1;
      if (crateKey === 'GP') newConfig.gpWins += 1;

      logger.log(`➕ Adding crate: ${crateKey} (${crateValue}) - Total wins: ${newConfig.wins}`);

      // Update state immediately - let Firebase handle the sync naturally
      setState({ ...state, allCrates: newAll, config: newConfig });

      // Don't use setIgnoreRemoteChanges for crate operations
      // Let Firebase's natural debouncing and sync handle it
    },
    [state, setState]
  );

  /**
   * Removes the last crate from history and adjusts win counters accordingly.
   * Handles both regular wins and GP wins based on the crate value.
   */
  const undoCrate = useCallback((): void => {
    if (state.allCrates.length === 0) {
      logger.log('⚠️ No crates to undo');
      return; // Nothing to undo
    }

    const lastCrate = state.allCrates[state.allCrates.length - 1];
    const newAllCrates = state.allCrates.slice(0, -1);
    const newConfig = { ...state.config };
    newConfig.wins -= 1;
    if (lastCrate === 'X') newConfig.gpWins -= 1; // 'X' represents GP crates

    logger.log(`↶ Undoing crate: ${lastCrate} - Total wins: ${newConfig.wins}`);

    // Update state immediately - let Firebase handle the sync naturally
    setState({ ...state, allCrates: newAllCrates, config: newConfig });

    // Don't use setIgnoreRemoteChanges for crate operations
    // Let Firebase's natural debouncing and sync handle it
  }, [state, setState]);

  /**
   * Performs a bulk fast-forward operation, adding multiple crates at once.
   * Adds GP crates first, then uses the prediction algorithm to fill remaining wins.
   * Temporarily ignores remote changes to prevent sync conflicts during bulk operations.
   *
   * @param additionalGP - Number of additional GP wins to add
   * @param newTotal - Target total win count
   */
  const fastForwardSubmit = useCallback(
    (additionalGP: number, newTotal: number) => {
      const currentGP = state.config.gpWins;

      const diffGP = additionalGP;
      const diffTotal = newTotal - (state.config.wins + additionalGP);

      logger.log(`🚀 Fast-forward: Adding ${diffGP} GP crates and ${diffTotal} total crates`);
      logger.log(`🚀 Target: ${newTotal} total wins (${currentGP + diffGP} GP wins)`);

      let newAllCrates = [...state.allCrates];
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
        `✅ Fast-forward complete: ${newAllCrates.length} total crates, ${newConfig.wins} wins`
      );

      setState({ ...state, allCrates: newAllCrates, config: newConfig });

      // Ignore remote changes for a longer period due to bulk additions
      setIgnoreRemoteChanges(true);
      setTimeout(() => setIgnoreRemoteChanges(false), 10000);
    },
    [state, setState, setIgnoreRemoteChanges]
  );

  return {
    addCrate,
    undoCrate,
    fastForwardSubmit,
  };
}
