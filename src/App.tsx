import { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext.tsx';
import Login from './Login.tsx';
import UnauthorizedAccess from './components/common/UnauthorizedAccess.tsx';
import UserProfile from './UserProfile.tsx';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import {
  ErrorBoundary,
  AuthErrorBoundary,
  FirebaseErrorBoundary,
} from './components/common/ErrorBoundary.tsx';
import logger from './utils/logger';

// Import extracted components and utilities
import SmallRow from './components/common/SmallRow.tsx';
// import ConnectionStatus from './components/common/ConnectionStatus.tsx';
import ConfigView from './components/views/ConfigView.tsx';
import AdminView from './components/views/AdminView.tsx';
import IntroView from './components/views/IntroView.tsx';
import FastForward from './components/views/FastForward.tsx';
import CrateGrid from './components/crate/CrateGrid.tsx';
import { useCratePattern } from './hooks/useCratePattern.ts';
import { useIgnoreRemoteChanges } from './hooks/useIgnoreRemoteChanges.ts';
import { APP_VERSION, CRATE_TYPES, MASTER_PATTERN } from './utils/constants.ts';
import { getNextCrateValue } from './utils/patternUtils';

// Define the state interface
interface AppState {
  allCrates: string[];
  config: {
    wins: number;
    gpWins: number;
  };
}

// AppContent component that contains the main app logic
function AppContent() {
  const {
    currentUser,
    userData,
    saveUserData,
    setIgnoreRemoteChanges,
    isOnline,
    syncStatus,
    // actionQueue,
    saveOfflineData,
    clearOfflineData,
    loadOfflineData,
    authorizationStatus,
  } = useAuth() as any;

  // Use extracted custom hooks
  const setIgnoreWithTimeout = useIgnoreRemoteChanges(setIgnoreRemoteChanges);

  // Ref for focus management when returning to main page
  const mainHeaderRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<AppState>(() => {
    logger.log('🚀 App initializing - checking data sources');
    logger.log(
      '🚀 Current context state - isOnline:',
      isOnline,
      'syncStatus:',
      syncStatus,
      'currentUser:',
      currentUser?.uid?.substring(0, 8)
    );

    // Check if we're in offline mode and should prioritize localStorage
    if (!isOnline && syncStatus === 'error' && currentUser) {
      logger.log('🔄 App startup in offline mode - prioritizing localStorage');

      try {
        const key = `crate-tracker-offline-${currentUser.uid}`;
        logger.log('🔍 Checking localStorage key:', key);

        // Debug: Check all localStorage keys
        logger.log('🔍 All localStorage keys:', Object.keys(localStorage));

        const savedData = localStorage.getItem(key);
        logger.log('📦 Raw localStorage data for key:', savedData);

        if (savedData && savedData !== 'null' && savedData !== 'undefined') {
          const parsedData = JSON.parse(savedData);
          const { data, timestamp } = parsedData;

          logger.log('✅ Found offline data:');
          logger.log('  - Timestamp:', timestamp);
          logger.log('  - Wins:', data.config.wins);
          logger.log('  - Crates:', data.allCrates.length);
          logger.log('  - Full data:', data);

          logger.log(
            '🔄 Initializing with offline data (wins:',
            data.config.wins,
            ', crates:',
            data.allCrates.length,
            ')'
          );
          return data;
        } else {
          logger.log('ℹ️ No valid offline data found in localStorage');
          logger.log('📦 localStorage value was:', savedData);
        }
      } catch (error) {
        logger.error('❌ Failed to load offline data during initialization:', error);
        logger.error('❌ Error details:', (error as Error).message);
      }
    }

    // Use userData if available, otherwise use default empty state
    if (userData) {
      logger.log('🔄 Initializing with Firebase data (wins:', userData.config?.wins || 0, ')');
      return userData;
    }

    logger.log('🔄 Initializing with default empty state');
    return { allCrates: [], config: { wins: 0, gpWins: 0 } };
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update state when userData changes (from real-time listener)
  useEffect(() => {
    // Only update state from Firebase if we're truly online and not in error state
    if (userData && isOnline && syncStatus === 'synced') {
      logger.log('📡 Updating state from Firebase real-time data');
      setState(userData);
    } else {
      logger.log('📡 Ignoring Firebase real-time data - not in online synced state');
    }
  }, [userData, isOnline, syncStatus]);

  // Save to localStorage when state changes and we're offline
  useEffect(() => {
    if (state && currentUser && !isOnline && syncStatus === 'error') {
      logger.log('💾 Saving offline state to localStorage');
      logger.log('💾 State data:', state);
      saveOfflineData(state);
    }
  }, [state, currentUser, isOnline, syncStatus, saveOfflineData]);

  // Clear localStorage when successfully synced
  useEffect(() => {
    if (isOnline && syncStatus === 'synced' && currentUser) {
      logger.log('🗑️ Clearing localStorage after successful sync');
      clearOfflineData();
    }
  }, [isOnline, syncStatus, currentUser, clearOfflineData]);

  // Load offline data on app startup if we're offline
  useEffect(() => {
    if (currentUser && !isOnline && syncStatus === 'error') {
      logger.log('🔄 App startup - attempting to load offline data');
      // Small delay to ensure localStorage functions are available
      setTimeout(() => {
        const offlineData = loadOfflineData();
        if (offlineData) {
          logger.log('✅ Setting offline data to state');
          setState(offlineData);
        } else {
          logger.log('ℹ️ No offline data found');
        }
      }, 100);
    }
  }, [currentUser, isOnline, syncStatus, loadOfflineData]);

  // Debounced save state to Firestore to prevent excessive calls
  useEffect(() => {
    // Don't save if we're offline due to quota errors
    if (state && currentUser && isOnline && syncStatus !== 'error') {
      logger.log('📤 State changed, scheduling save...');

      // Clear any existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout - this ensures saves happen even with rapid clicks
      const timeout = setTimeout(() => {
        logger.log('💾 Executing scheduled save');
        saveUserData(state);
        saveTimeoutRef.current = null;
      }, 500); // Debounce saves by 500ms

      saveTimeoutRef.current = timeout;
    } else if (!isOnline || syncStatus === 'error') {
      logger.log('⏸️ Skipping scheduled save due to offline/quota error state');
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [state, saveUserData, currentUser, isOnline, syncStatus]);

  // Use pattern hook after state is defined
  const { lastTen, futureTen, nextSpecialCrate } = useCratePattern(state?.allCrates || []);

  // Crate management functions
  function addCrate(crateKey: string): void {
    const crateType = CRATE_TYPES.find(t => t.key === crateKey);
    const crateValue = crateType ? crateType.value : '?';
    const newAll = [...state.allCrates, crateValue];
    const newConfig = { ...state.config };
    newConfig.wins += 1;
    if (crateKey === 'GP') newConfig.gpWins += 1;

    // Update state immediately - let Firebase handle the sync naturally
    setState({ ...state, allCrates: newAll, config: newConfig });

    // Don't use setIgnoreRemoteChanges for crate operations
    // Let Firebase's natural debouncing and sync handle it
  }

  function undoCrate(): void {
    if (state.allCrates.length === 0) return; // Nothing to undo
    const lastCrate = state.allCrates[state.allCrates.length - 1];
    const newAllCrates = state.allCrates.slice(0, -1);
    const newConfig = { ...state.config };
    newConfig.wins -= 1;
    if (lastCrate === 'X') newConfig.gpWins -= 1;

    // Update state immediately - let Firebase handle the sync naturally
    setState({ ...state, allCrates: newAllCrates, config: newConfig });

    // Don't use setIgnoreRemoteChanges for crate operations
    // Let Firebase's natural debouncing and sync handle it
  }

  const [view, setView] = useState<'intro' | 'main' | 'config' | 'admin'>(
    (state?.allCrates?.length || 0) == 0 ? 'intro' : 'main'
  );
  const [showFastForward, setShowFastForward] = useState(false);

  // Fast forward submit handler
  function fastForwardSubmit(additionalGP: number, newTotal: number) {
    const currentGP = state.config.gpWins;

    const diffGP = additionalGP;
    const diffTotal = newTotal - (state.config.wins + additionalGP);

    let newAllCrates = [...state.allCrates];
    const newConfig = { ...state.config, gpWins: currentGP + diffGP };

    // Add GP crates
    for (let i = 0; i < diffGP; i++) {
      newAllCrates = [...newAllCrates, 'X'];
      newConfig.wins += 1;
    }

    // Add remaining total wins using predictor
    for (let i = 0; i < diffTotal; i++) {
      const next = getNextCrateValue(newAllCrates, MASTER_PATTERN) || '?';
      newAllCrates = [...newAllCrates, next];
      newConfig.wins += 1;
    }

    setState({ ...state, allCrates: newAllCrates, config: newConfig });
    setShowFastForward(false);

    // Ignore remote changes for a longer period due to bulk additions
    setIgnoreWithTimeout(10000);
  }

  // Handle different authorization states
  if (authorizationStatus === 'unauthorized') {
    return <UnauthorizedAccess />;
  }

  if (!currentUser) {
    return <Login />;
  }

  // Focus management functions
  const focusMainHeader = () => {
    if (mainHeaderRef.current) {
      mainHeaderRef.current.focus();
      // Scroll to top as well for better UX
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBackToMain = () => {
    setView('main');
    // Use setTimeout to ensure the view has changed before focusing
    setTimeout(focusMainHeader, 0);
  };

  const handleFastForwardCancel = () => {
    setShowFastForward(false);
    // Use setTimeout to ensure the modal has closed before focusing
    setTimeout(focusMainHeader, 0);
  };

  return (
    <div className='min-h-screen bg-gray-900 p-6 max-w-md mx-auto font-sans flex flex-col'>
      <header
        ref={mainHeaderRef}
        className='flex items-center justify-between mb-2 rounded-xl shadow-lg bg-gray-700 px-6 py-4'
        tabIndex={-1}
      >
        <h1 className='text-2xl font-bold text-white tracking-wide'>Crate Tracker</h1>
        <div className='flex items-center gap-4'>
          <div className='text-sm text-gray-200 font-semibold'>
            Wins: {state?.config?.wins || 0}
          </div>
          {/* <ConnectionStatus isOnline={isOnline} syncStatus={syncStatus} actionQueue={actionQueue} /> */}
        </div>
      </header>
      <div className='flex justify-end pl-2 mt-1 mb-2'>
        <button
          className='text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200'
          onClick={() => !showFastForward && setView('config')}
        >
          <Cog6ToothIcon className='w-5 h-5' />
        </button>
      </div>

      <ErrorBoundary
        fallback={
          <div className='p-4 bg-red-900/20 border border-red-500 rounded-lg'>
            <p className='text-red-400 text-sm'>
              Error loading main content. Please refresh the page.
            </p>
          </div>
        }
      >
        {view === 'main' && !showFastForward && (
          <main>
            <ErrorBoundary
              fallback={
                <div className='p-2 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-400 text-xs'>
                  Error loading crate history
                </div>
              }
            >
              <section className='mb-4'>
                <div className='text-xs text-gray-300 mb-2 font-semibold tracking-wide'>
                  Last 10 crates
                </div>
                <SmallRow crates={lastTen} />
              </section>
            </ErrorBoundary>

            <ErrorBoundary
              fallback={
                <div className='p-2 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-400 text-xs'>
                  Error loading crate grid
                </div>
              }
            >
              <CrateGrid
                onCrateSelect={addCrate}
                onUndo={undoCrate}
                onFastForward={() => view === 'main' && setShowFastForward(true)}
              />
            </ErrorBoundary>

            <ErrorBoundary
              fallback={
                <div className='p-2 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-400 text-xs'>
                  Error loading predictions
                </div>
              }
            >
              <section className='mb-2'>
                <div className='flex justify-between items-center text-xs text-gray-300 mb-2 font-semibold tracking-wide'>
                  <span>Next 10 (predictions)</span>
                  <span className='text-gray-400'>
                    {nextSpecialCrate?.type === 'Not sure'
                      ? '? crates until special'
                      : nextSpecialCrate?.type === 'No data'
                        ? 'Enter crates to see predictions'
                        : nextSpecialCrate?.count === 1
                          ? `The next crate is ${nextSpecialCrate.type}`
                          : nextSpecialCrate
                            ? `${nextSpecialCrate.count} crates until ${nextSpecialCrate.type}`
                            : 'Enter crates to see predictions'}
                  </span>
                </div>
                <SmallRow crates={futureTen} />
              </section>
            </ErrorBoundary>
          </main>
        )}

        {view === 'config' && (
          <ErrorBoundary
            fallback={
              <div className='p-4 bg-red-900/20 border border-red-500 rounded-lg'>
                <p className='text-red-400 text-sm'>
                  Error loading configuration. Please refresh the page.
                </p>
              </div>
            }
          >
            <ConfigView
              config={state.config}
              allCrates={state.allCrates}
              onChange={(cfg: any, resetAllCrates?: boolean, importData?: any) => {
                if (importData) {
                  // Handle import case - restore complete state
                  setState(importData);
                } else if (resetAllCrates) {
                  // Handle reset case - clear all crates and reset config
                  setState(s => ({ ...s, allCrates: [], config: { wins: 0, gpWins: 0 } }));
                } else {
                  // Handle config update case - merge new config
                  setState(s => ({ ...s, config: { ...s.config, ...cfg } }));
                }
                // Use longer timeout for config operations too
                setIgnoreWithTimeout(5000);
              }}
              onBack={handleBackToMain}
              onAdmin={() => !showFastForward && setView('admin')}
              setIgnoreRemoteChanges={setIgnoreRemoteChanges}
            />
          </ErrorBoundary>
        )}

        {showFastForward && (
          <FastForward
            onSubmit={fastForwardSubmit}
            onCancel={handleFastForwardCancel}
            currentGP={state.config.gpWins}
            currentTotal={state.config.wins}
          />
        )}

        {view === 'intro' && (
          <ErrorBoundary
            fallback={
              <div className='p-4 bg-red-900/20 border border-red-500 rounded-lg'>
                <p className='text-red-400 text-sm'>
                  Error loading intro view. Please refresh the page.
                </p>
              </div>
            }
          >
            <IntroView onBack={handleBackToMain} />
          </ErrorBoundary>
        )}

        {view === 'admin' && (
          <ErrorBoundary
            fallback={
              <div className='p-4 bg-red-900/20 border border-red-500 rounded-lg'>
                <p className='text-red-400 text-sm'>
                  Error loading admin view. Please refresh the page.
                </p>
              </div>
            }
          >
            <AdminView onBack={() => setView('config')} />
          </ErrorBoundary>
        )}
      </ErrorBoundary>

      {/* User Profile Section - Bottom of App */}
      <ErrorBoundary
        fallback={
          <div className='p-2 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-400 text-xs'>
            Error loading user profile
          </div>
        }
      >
        <div className='mt-6 mb-4'>
          <UserProfile />
        </div>
      </ErrorBoundary>

      <footer className='flex text-xs text-gray-500 items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span>{currentUser ? '' : 'Sign in to save your data to the cloud'}</span>
          {currentUser && (
            <div className='flex items-center gap-1'>
              {/* <ConnectionStatus
                isOnline={isOnline}
                syncStatus={syncStatus}
                actionQueue={actionQueue}
              /> */}
            </div>
          )}
        </div>
        <div>App version {APP_VERSION}</div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary
      showErrorDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        logger.error('App-level error:', error, errorInfo);
        // Could send to error reporting service
      }}
    >
      <FirebaseErrorBoundary>
        <AuthErrorBoundary>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </AuthErrorBoundary>
      </FirebaseErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;
