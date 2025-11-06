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
   * Fast-Forward Bulk Operation Algorithm
   *
   * Business Logic:
   * - Allows users to "catch up" by bulk-adding crates to match their current win counts
   * - Preserves GP win accuracy by adding GP crates first
   * - Uses prediction algorithm for remaining wins to maintain pattern consistency
   * - Temporarily disables real-time sync to prevent conflicts during bulk operations
   *
   * Algorithm Steps:
   * 1. Calculate GP difference: additionalGP parameter
   * 2. Calculate total difference: newTotal - (currentTotal + additionalGP)
   * 3. Add GP crates ('X') to history first, incrementing both GP and total win counters
   * 4. Add remaining wins using prediction algorithm with MASTER_PATTERN
   * 5. Update state with complete new crate history and win counts
   * 6. Ignore remote changes for 10 seconds to allow bulk operation to complete
   *
   * Use Cases:
   * - User has been playing but forgot to track crates in the app
   * - Importing data from external tracking sources
   * - Correcting win count discrepancies
   *
   * Edge Cases:
   * - additionalGP = 0: Only uses prediction algorithm for all wins
   * - newTotal <= currentTotal: No operation performed (validated in UI)
   * - Prediction algorithm returns '?': Uses fallback crate value
   * - Network conflicts: Temporarily ignored during operation
   *
   * Performance Considerations:
   * - Bulk operations can add hundreds of crates at once
   * - Prediction algorithm called for each remaining win
   * - State update triggers debounced save to Firestore
   * - Real-time sync disabled during operation to prevent conflicts
   *
   * @param additionalGP - Number of additional GP wins to add to current GP count
   * @param newTotal - Target total win count to reach
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
