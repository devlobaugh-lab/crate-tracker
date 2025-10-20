import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login'
import UserProfile from './UserProfile'
import { Cog6ToothIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'

// Import extracted components and utilities
import SmallRow from './components/common/SmallRow'
import ConnectionStatus from './components/common/ConnectionStatus'
import ConfigView from './components/views/ConfigView'
import IntroView from './components/views/IntroView'
import CrateGrid from './components/crate/CrateGrid'
import { useCratePattern } from './hooks/useCratePattern'
import { useIgnoreRemoteChanges } from './hooks/useIgnoreRemoteChanges'
import { APP_VERSION, CRATE_TYPES } from './utils/constants'



// AppContent component that contains the main app logic
function AppContent() {
  const { currentUser, userData, saveUserData, setIgnoreRemoteChanges, isOnline, syncStatus, actionQueue, saveOfflineData, clearOfflineData, loadOfflineData } = useAuth();

  // Use extracted custom hooks
  const setIgnoreWithTimeout = useIgnoreRemoteChanges(setIgnoreRemoteChanges);

  const [state, setState] = useState(() => {
    console.log('🚀 App initializing - checking data sources');
    console.log('🚀 Current context state - isOnline:', isOnline, 'syncStatus:', syncStatus, 'currentUser:', currentUser?.uid?.substring(0, 8));

    // Check if we're in offline mode and should prioritize localStorage
    if (!isOnline && syncStatus === 'error' && currentUser) {
      console.log('🔄 App startup in offline mode - prioritizing localStorage');

      try {
        const key = `crate-tracker-offline-${currentUser.uid}`;
        console.log('🔍 Checking localStorage key:', key);

        // Debug: Check all localStorage keys
        console.log('🔍 All localStorage keys:', Object.keys(localStorage));

        const savedData = localStorage.getItem(key);
        console.log('📦 Raw localStorage data for key:', savedData);

        if (savedData && savedData !== 'null' && savedData !== 'undefined') {
          const parsedData = JSON.parse(savedData);
          const { data, timestamp } = parsedData;

          console.log('✅ Found offline data:');
          console.log('  - Timestamp:', timestamp);
          console.log('  - Wins:', data.config.wins);
          console.log('  - Crates:', data.allCrates.length);
          console.log('  - Full data:', data);

          console.log('🔄 Initializing with offline data (wins:', data.config.wins, ', crates:', data.allCrates.length, ')');
          return data;
        } else {
          console.log('ℹ️ No valid offline data found in localStorage');
          console.log('📦 localStorage value was:', savedData);
        }
      } catch (error) {
        console.error('❌ Failed to load offline data during initialization:', error);
        console.error('❌ Error details:', error.message);
      }
    }

    // Use userData if available, otherwise use default empty state
    if (userData) {
      console.log('🔄 Initializing with Firebase data (wins:', userData.config?.wins || 0, ')');
      return userData;
    }

    console.log('🔄 Initializing with default empty state');
    return { allCrates: [], config: { wins: 0, gpWins: 0 } };
  });

  const [saveTimeout, setSaveTimeout] = useState(null);

  // Update state when userData changes (from real-time listener)
  useEffect(() => {
    // Only update state from Firebase if we're truly online and not in error state
    if (userData && isOnline && syncStatus === 'synced') {
      console.log('📡 Updating state from Firebase real-time data');
      setState(userData);
    } else {
      console.log('📡 Ignoring Firebase real-time data - not in online synced state');
    }
  }, [userData, isOnline, syncStatus]);

  // Save to localStorage when state changes and we're offline
  useEffect(() => {
    if (state && currentUser && !isOnline && syncStatus === 'error') {
      console.log('💾 Saving offline state to localStorage');
      console.log('💾 State data:', state);
      saveOfflineData(state);
    }
  }, [state, currentUser, isOnline, syncStatus, saveOfflineData]);

  // Clear localStorage when successfully synced
  useEffect(() => {
    if (isOnline && syncStatus === 'synced' && currentUser) {
      console.log('🗑️ Clearing localStorage after successful sync');
      clearOfflineData();
    }
  }, [isOnline, syncStatus, currentUser, clearOfflineData]);

  // Load offline data on app startup if we're offline
  useEffect(() => {
    if (currentUser && !isOnline && syncStatus === 'error') {
      console.log('🔄 App startup - attempting to load offline data');
      // Small delay to ensure localStorage functions are available
      setTimeout(() => {
        const offlineData = loadOfflineData();
        if (offlineData) {
          console.log('✅ Setting offline data to state');
          setState(offlineData);
        } else {
          console.log('ℹ️ No offline data found');
        }
      }, 100);
    }
  }, [currentUser, isOnline, syncStatus, loadOfflineData]);

  // Debounced save state to Firestore to prevent excessive calls
  useEffect(() => {
    // Don't save if we're offline due to quota errors
    if (state && currentUser && isOnline && syncStatus !== 'error') {
      console.log('📤 State changed, scheduling save...');

      // Clear any existing timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      // Set new timeout - this ensures saves happen even with rapid clicks
      const timeout = setTimeout(() => {
        console.log('💾 Executing scheduled save');
        saveUserData(state);
        setSaveTimeout(null);
      }, 500); // Debounce saves by 500ms

      setSaveTimeout(timeout);
    } else if (!isOnline || syncStatus === 'error') {
      console.log('⏸️ Skipping scheduled save due to offline/quota error state');
    }

    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        setSaveTimeout(null);
      }
    };
  }, [state, saveUserData, currentUser, isOnline, syncStatus]);

  // Use pattern hook after state is defined
  const { lastTen, futureTen } = useCratePattern(state?.allCrates || []);

  // Crate management functions
  function addCrate(crateKey) {
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

  function undoCrate() {
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

  const [view, setView] = (state?.allCrates?.length || 0) == 0 ? useState('intro') : useState('main');

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6 max-w-md mx-auto font-sans flex flex-col">
      <header className="flex items-center justify-between mb-2 rounded-xl shadow-lg bg-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-white tracking-wide">Crate Tracker</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-200 font-semibold">Wins: {state?.config?.wins || 0}</div>
          {/* <ConnectionStatus isOnline={isOnline} syncStatus={syncStatus} actionQueue={actionQueue} /> */}
        </div>
      </header>
      <div className="flex justify-end pr-2 mb-2">
        <button
          className="pl-2 text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200"
          onClick={() => setView('config')}
          >
          <Cog6ToothIcon className="w-5 h-5" />
        </button>
      </div>

      {view === 'main' && (
        <main>
          <section className="mb-4">
            <div className="text-xs text-gray-300 mb-2 font-semibold tracking-wide">Last 10 crates</div>
            <SmallRow crates={lastTen} />
          </section>

          <CrateGrid onCrateSelect={addCrate} onUndo={undoCrate} />

          <section className="mb-2">
            <div className="text-xs text-gray-300 mb-2 font-semibold tracking-wide">Next 10 (predictions)</div>
            <SmallRow crates={futureTen} />
          </section>
        </main>
      )}

      {view === 'config' && (
        <ConfigView
          config={state.config}
          allCrates={state.allCrates}
          onChange={(cfg, resetAllCrates, importData) => {
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
          onBack={() => setView('main')}
          setIgnoreRemoteChanges={setIgnoreRemoteChanges}
        />
      )}

      {view === 'intro' && (
        <IntroView
          onBack={() => setView('main')}
        />
      )}

      {/* User Profile Section - Bottom of App */}
      <div className="mt-6 mb-4">
        <UserProfile />
      </div>

      <footer className="flex text-xs text-gray-500 items-center justify-between">
        <div className="flex items-center gap-2">
          <span>
            {currentUser ? '' : 'Sign in to save your data to the cloud'}
          </span>
          {currentUser && (
            <div className="flex items-center gap-1">
              <ConnectionStatus isOnline={isOnline} syncStatus={syncStatus} actionQueue={actionQueue} />
            </div>
          )}
        </div>
        <div>
          App version {APP_VERSION}
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}


        
export default App
