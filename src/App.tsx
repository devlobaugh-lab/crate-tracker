import React, { useRef, useState, useMemo, useCallback } from 'react';
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
import FastForward from './components/views/FastForward.tsx';
import CrateGrid from './components/crate/CrateGrid.tsx';
import { useCratePattern } from './hooks/useCratePattern.ts';
import { useIgnoreRemoteChanges } from './hooks/useIgnoreRemoteChanges.ts';
import { useAppState } from './hooks/useAppState.ts';
import { useCrateManagement } from './hooks/useCrateManagement.ts';
import { APP_VERSION } from './utils/constants.ts';
import { initPerformanceMonitoring } from './utils/performance.ts';

// AppContent component that contains the main app logic
function AppContent() {
  /**
   * Main Application Component Logic
   *
   * Business Logic Overview:
   * - Manages application state using custom hooks (useAppState, useCrateManagement)
   * - Handles view navigation between intro/main/config/admin screens
   * - Provides crate tracking functionality with prediction algorithm
   * - Manages user authorization and authentication flow
   *
   * State Management Strategy:
   * - App state centralized in useAppState hook with offline/online sync
   * - Crate operations handled by useCrateManagement hook
   * - View state managed locally for UI navigation
   * - Authorization status determines available features
   *
   * Key Features:
   * - Real-time crate tracking with win counting
   * - Prediction algorithm for next crate outcomes
   * - Fast-forward bulk operations for catch-up scenarios
   * - Offline persistence with automatic sync
   * - Admin panel for user management (role-based)
   *
   * View Logic:
   * - Intro view: Shown for new users with no crate history
   * - Main view: Primary crate tracking interface
   * - Config view: Settings and data management
   * - Admin view: User administration (admin users only)
   *
   * Error Handling:
   * - Component-level error boundaries for graceful degradation
   * - Authorization checks prevent unauthorized access
   * - Network error handling with offline fallbacks
   */
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

  // Use the extracted app state hook
  const { state, setState } = useAppState({
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

  // Ref for focus management when returning to main page
  const mainHeaderRef = useRef<HTMLDivElement>(null);

  // Memoize expensive calculations
  const allCrates = useMemo(() => state?.allCrates || [], [state?.allCrates]);

  // Use pattern hook after state is defined
  const { lastTen, futureTen, nextSpecialCrate } = useCratePattern(allCrates);

  // Use the extracted crate management hook
  const { addCrate, undoCrate, fastForwardSubmit } = useCrateManagement({
    state,
    setState,
    setIgnoreRemoteChanges,
  });

  const [view, setView] = useState<'intro' | 'main' | 'config' | 'admin'>(
    (allCrates.length || 0) == 0 ? 'intro' : 'main'
  );
  const [showFastForward, setShowFastForward] = useState(false);

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
      // Scroll to top as well for better UX
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleBackToMain = useCallback(() => {
    setView('main');
    // Use setTimeout to ensure the view has changed before focusing
    setTimeout(focusMainHeader, 0);
  }, [focusMainHeader]);

  const handleFastForwardCancel = useCallback(() => {
    setShowFastForward(false);
    // Use setTimeout to ensure the modal has closed before focusing
    setTimeout(focusMainHeader, 0);
  }, [focusMainHeader]);

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
        <h1 className='text-2xl font-bold text-white tracking-wide'>Crate Tracker</h1>
        <div className='flex items-center gap-4'>
          <div className='text-sm text-gray-200 font-semibold'>
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
