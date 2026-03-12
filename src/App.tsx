import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
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
import { Toaster } from 'react-hot-toast';

// Import extracted components and utilities
import SmallRow from './components/common/SmallRow.tsx';
// import ConnectionStatus from './components/common/ConnectionStatus.tsx';
import ConfigView from './components/views/ConfigView.tsx';
import AdminView from './components/views/AdminView.tsx';
import IntroView from './components/views/IntroView.tsx';
import MigrationNoticeView from './components/views/MigrationNoticeView.tsx';
import FastForward from './components/views/FastForward.tsx';
import CrateGrid from './components/crate/CrateGrid.tsx';
import { useCratePattern } from './hooks/useCratePattern.ts';
import { useIgnoreRemoteChanges } from './hooks/useIgnoreRemoteChanges.ts';
import { useAppState } from './hooks/useAppState.ts';
import { useCrateManagement } from './hooks/useCrateManagement.ts';
import { APP_VERSION } from './utils/constants.ts';
import { initPerformanceMonitoring } from './utils/performance.ts';

const SERIES_INDEX_STORAGE_KEY = 'crate-tracker-series-index';
const SERIES_COUNT = 12;

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
    wasMigrated,
  } = useAuth() as any;

  // Use extracted custom hooks
  const setIgnoreWithTimeout = useIgnoreRemoteChanges(setIgnoreRemoteChanges);

  // Use the extracted app state hook
  const { state, setState, isInitialized } = useAppState({
    currentUser,
    userData,
    isOnline,
    syncStatus,
    saveUserData,
    saveOfflineData,
    loadOfflineData,
    clearOfflineData,
    ignoreRemoteChanges: false, // This will be managed by the hook
  });

  // Series selector state — UI only, persisted to localStorage
  const [currentSeriesIndex, setCurrentSeriesIndex] = useState<number>(() => {
    const saved = localStorage.getItem(SERIES_INDEX_STORAGE_KEY);
    return saved !== null ? parseInt(saved, 10) : 0;
  });

  // Persist series index to localStorage on change
  useEffect(() => {
    localStorage.setItem(SERIES_INDEX_STORAGE_KEY, String(currentSeriesIndex));
  }, [currentSeriesIndex]);

  // Ref for focus management when returning to main page
  const mainHeaderRef = useRef<HTMLDivElement>(null);

  // Derive current series allCrates slice
  const allCrates = useMemo(
    () => state?.series?.[currentSeriesIndex]?.allCrates ?? [],
    [state?.series, currentSeriesIndex]
  );

  // Use pattern hook after state is defined
  const { lastTen, futureTen, nextSpecialCrate } = useCratePattern(allCrates);

  // Use the extracted crate management hook
  const { addCrate, undoCrate, fastForwardSubmit } = useCrateManagement({
    state,
    setState,
    setIgnoreRemoteChanges,
    currentSeriesIndex,
  });

  const isNewUser = (state?.series ?? []).every(s => s.allCrates.length === 0);

  const [view, setView] = useState<'intro' | 'main' | 'config' | 'admin'>(
    allCrates.length === 0 && isNewUser ? 'intro' : 'main'
  );
  const [showFastForward, setShowFastForward] = useState(false);
  const [showMigrationNotice, setShowMigrationNotice] = useState(false);

  // Show migration notice once to users who were migrated to multi-series
  useEffect(() => {
    if (!isInitialized) return;
    const seen = state.config.migrationNoticeSeen;
    if (seen === false) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowMigrationNotice(true);
      setCurrentSeriesIndex(11);
    } else if (seen === undefined) {
      const hasAnyData = state.series.some(s => s.allCrates.length > 0);
      if (hasAnyData) {
        // Backfill: already-migrated user — stamp false so dismiss writes true to Firestore
        setState(s => ({ ...s, config: { ...s.config, migrationNoticeSeen: false } }));
      }
    }
  }, [isInitialized, state.config.migrationNoticeSeen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMigrationNoticeDismiss = useCallback(() => {
    setState(s => ({ ...s, config: { ...s.config, migrationNoticeSeen: true } }));
    setShowMigrationNotice(false);
  }, [setState]);

  // After migration, redirect user to Series 12 where their legacy data landed
  useEffect(() => {
    if (wasMigrated) {
      logger.log('🔄 Migration detected — switching to Series 12');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentSeriesIndex(11);
      setView('main'); // migrated users always have data somewhere
    }
  }, [wasMigrated]);

  // Memoize the next special crate display text
  const specialCrateText = useMemo(() => {
    if (nextSpecialCrate?.type === 'Not sure') {
      return '? crates until special';
    }
    if (nextSpecialCrate?.type === 'No data') {
      return 'Enter crates to see predictions';
    }
    if (nextSpecialCrate?.count === 1) {
      return `The next crate is ${nextSpecialCrate.type}`;
    }
    if (nextSpecialCrate) {
      return `${nextSpecialCrate.count} crates until ${nextSpecialCrate.type}`;
    }
    return 'Enter crates to see predictions';
  }, [nextSpecialCrate]);

  // Focus management functions - memoized to prevent unnecessary re-renders
  const focusMainHeader = useCallback(() => {
    if (mainHeaderRef.current) {
      mainHeaderRef.current.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleBackToMain = useCallback(() => {
    setView('main');
    setTimeout(focusMainHeader, 0);
  }, [focusMainHeader]);

  const handleFastForwardCancel = useCallback(() => {
    setShowFastForward(false);
    setTimeout(focusMainHeader, 0);
  }, [focusMainHeader]);

  const handleFastForwardSubmit = useCallback(
    (additionalGP: number, newTotal: number) => {
      fastForwardSubmit(additionalGP, newTotal);
      setShowFastForward(false);
      setTimeout(focusMainHeader, 0);
    },
    [fastForwardSubmit, focusMainHeader]
  );

  // Handle different authorization states
  if (authorizationStatus === 'unauthorized') {
    return <UnauthorizedAccess />;
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className='min-h-screen bg-gray-900 p-6 max-w-md mx-auto font-sans flex flex-col'>
      <header
        ref={mainHeaderRef}
        className='flex items-center justify-between mb-2 rounded-xl shadow-lg bg-gray-700 px-6 py-4'
        tabIndex={-1}
      >
        <select
          value={currentSeriesIndex}
          onChange={e => {
            const newIndex = Number(e.target.value);
            setCurrentSeriesIndex(newIndex);
            setView('main'); // switching series never triggers intro for existing users
          }}
          className='text-2xl font-bold text-white bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded cursor-pointer'
        >
          {Array.from({ length: SERIES_COUNT }, (_, i) => (
            <option key={i} value={i} className='bg-gray-700 text-white text-base font-normal'>
              Series {i + 1}
            </option>
          ))}
        </select>
        <div className='flex items-center gap-4'>
          <div className='text-lg text-gray-200 font-semibold'>
            Wins: {state?.config?.wins || 0}
          </div>
          {/* <ConnectionStatus isOnline={isOnline} syncStatus={syncStatus} actionQueue={actionQueue} /> */}
        </div>
      </header>
      <div className='flex justify-end pr-2 mb-2 mt-1'>
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
        {view === 'main' && !showFastForward && !showMigrationNotice && (
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
                  <span className='text-gray-400'>{specialCrateText}</span>
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
              allCrates={allCrates}
              currentSeriesIndex={currentSeriesIndex}
              onChange={(cfg: any, action?: any, importData?: any) => {
                if (importData && typeof importData === 'object' && 'type' in importData) {
                  if (importData.type === 'full') {
                    // Full v2 restore: replace all series + config
                    setState(importData.data);
                  } else if (importData.type === 'single') {
                    // Legacy import: replace only current series allCrates
                    setState((s: any) => {
                      const newSeries = [...s.series];
                      newSeries[currentSeriesIndex] = { allCrates: importData.allCrates };
                      return { ...s, series: newSeries };
                    });
                  }
                } else if (action === 'resetCurrentSeries') {
                  // Reset only the current series
                  setState((s: any) => {
                    const newSeries = [...s.series];
                    newSeries[currentSeriesIndex] = { allCrates: [] };
                    return { ...s, series: newSeries };
                  });
                  setView('main'); // reset doesn't make user a new user
                } else {
                  // Config update (wins/gpWins manual adjustment)
                  setState((s: any) => ({ ...s, config: { ...s.config, ...cfg } }));
                }
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
            onSubmit={handleFastForwardSubmit}
            onCancel={handleFastForwardCancel}
            currentGP={state.config.gpWins}
            currentTotal={state.config.wins}
          />
        )}

        {showMigrationNotice && <MigrationNoticeView onDismiss={handleMigrationNoticeDismiss} />}

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
        <div className='mt-6 mb-2'>
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
  // Initialize performance monitoring
  React.useEffect(() => {
    initPerformanceMonitoring();
  }, []);

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
            <Toaster
              position='top-right'
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#374151',
                  color: '#f3f4f6',
                  border: '1px solid #4b5563',
                },
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#f3f4f6',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#f3f4f6',
                  },
                },
              }}
            />
          </AuthProvider>
        </AuthErrorBoundary>
      </FirebaseErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;
