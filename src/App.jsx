import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login'
import UserProfile from './UserProfile'
import { ArrowUturnLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

const CRATE_TYPES = [
  { key: 'Green', color: 'bg-green-700', label: 'Green', value: 'B' },
  { key: 'Gold', color: 'bg-yellow-400', label: 'Gold', value: 'G' },
  { key: 'Platinum', color: 'bg-gray-400', label: 'Platinum', value: 'P' },
  { key: 'Legendary', color: 'bg-amber-700', label: 'Legendary', value: 'L' },
  { key: 'GP', color: 'bg-blue-500', label: 'GP', value: 'X' },
  { key: 'Unknown', color: 'bg-white', label: 'Unknown', value: '?'}
]

const MASTER_PATTERN = `BBBBBBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBGBBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBG
BBBGBBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBLBBGBBBGBBBBGBGBBBBGBBBBGBBG
BBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBL
BBBBBBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBGBBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBG
BBBGBBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBLBBGBBBGBBBBGBGBBBBGBBBBGBBG
BBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBL
BBBBBBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBGBBBBBPBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBB
GBBBGBBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBLBBGBBBGBBBBGBGBBBBGBBBBGBB
GBBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBL`;

const STORAGE_KEY = 'crate-tracker:v1'

const APP_VERSION = '1.1.3'

function SmallRow({ crates = [] }) {
  if (crates.length === 0) {
    return <div className="text-center text-gray-400 italic py-1">No data</div>
  } else {
    return (
      <div className="flex gap-2 justify-center">
        {crates.map((c, i) => (
          <div key={i} className={`w-8 h-8 rounded-none shadow-lg border ${c.color}`}></div>
        ))}
      </div>
    )
  }
}

function nextPatternValues(userInput, masterPattern) {
  // Clean up pattern (remove whitespace, newlines, etc.)
  const pattern = masterPattern.replace(/\s+/g, '');
  const validChars = ['B', 'G', 'P', 'L'];

 // Filter only valid input values
  const validInputs = userInput.filter(v => validChars.includes(v));
  
  // If no valid inputs, return 10 unknowns
  if (validInputs.length === 0) return Array(10).fill('?');

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
    if (fits) matches.push(start);
  }

  // If no match found, all outputs are unknown
  if (matches.length === 0) return Array(10).fill('?');

  // Generate next 10 pattern values for each matching offset
  const predictions = matches.map(start => {
    const arr = [];
    for (let i = validInputs.length; i < validInputs.length + 10; i++) {
      arr.push(pattern[(start + i) % pattern.length]);
    }
    return arr;
  });

  // Combine predictions — '?' where multiple possibilities disagree
  const result = [];
  for (let i = 0; i < 10; i++) {
    const chars = predictions.map(p => p[i]);
    const allSame = chars.every(c => c === chars[0]);
    result.push(allSame ? chars[0] : '?');
  }
  return result;
}

// AppContent component that contains the main app logic
function AppContent() {
  const { currentUser, userData, saveUserData, setIgnoreRemoteChanges } = useAuth();

  const [state, setState] = useState(() => {
    // Use userData if available, otherwise use default empty state
    if (userData) return userData;
    return { allCrates: [], config: { wins: 0, gpWins: 0 } };
  });

  // Update state when userData changes (from real-time listener)
  useEffect(() => {
    if (userData) {
      setState(userData);
    }
  }, [userData]);

  // Save state to Firestore 
  useEffect(() => {
    if (state && currentUser) {
      saveUserData(state);
    }
  }, [state, saveUserData, currentUser]);

  const lastTen = state.allCrates.slice(-10).map(v => CRATE_TYPES.find(t => t.value === v) || CRATE_TYPES.find(t => t.value === '?'));
  const futureTen = nextPatternValues(state.allCrates, MASTER_PATTERN).map(v => CRATE_TYPES.find(t => t.value === v) || CRATE_TYPES.find(t => t.value === '?'));

  function addCrate(crateKey) {
    // Temporarily ignore remote changes to prevent sync loop
    setIgnoreRemoteChanges(true);
    const crateType = CRATE_TYPES.find(t => t.key === crateKey);
    const crateValue = crateType ? crateType.value : '?';
    const newAll = [...state.allCrates, crateValue];
    const newConfig = { ...state.config };
    newConfig.wins += 1;
    if (crateKey === 'GP') newConfig.gpWins += 1;
    setState({ ...state, allCrates: newAll, config: newConfig });

    // Re-enable remote changes after a short delay
    setTimeout(() => setIgnoreRemoteChanges(false), 200);
  }

  function undoCrate() {
    if (state.allCrates.length === 0) return; // Nothing to undo
    // Temporarily ignore remote changes to prevent sync loop
    setIgnoreRemoteChanges(true);
    const lastCrate = state.allCrates[state.allCrates.length - 1];
    const newAllCrates = state.allCrates.slice(0, -1);
    const newConfig = { ...state.config };
    newConfig.wins -= 1;
    if (lastCrate === 'X') newConfig.gpWins -= 1;
    setState({ ...state, allCrates: newAllCrates, config: newConfig });

    // Re-enable remote changes after a short delay
    setTimeout(() => setIgnoreRemoteChanges(false), 200);
  }

  const [view, setView] = state.allCrates.length == 0 ? useState('intro') : useState('main');

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6 max-w-md mx-auto font-sans flex flex-col">
      <header className="flex items-center justify-between mb-2 rounded-xl shadow-lg bg-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-white tracking-wide">Crate Tracker</h1>
        <div className="text-sm text-gray-200 font-semibold">Wins: {state.config.wins}</div>
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

          <section className="mb-4 bg-gray-700 p-6 pb-8 rounded-2xl shadow-lg">
            <div className="text-sm text-gray-200 mb-4 font-semibold flex justify-between items-center">
              <div>Choose current crate</div>
              <div><button
                onClick={() => undoCrate()}
                className="text-sm underline mr-1 text-gray-300 hover:text-blue-400 transition-colors duration-200"
              >
                <ArrowUturnLeftIcon className="w-6 h-6" />
              </button></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {CRATE_TYPES.map(ct => (
                <button
                  key={ct.key}
                  onClick={() => addCrate(ct.key)}
                  className={`p-3 rounded-lg shadow-md flex items-center justify-center transition-transform duration-150 hover:scale-105 hover:shadow-xl ${ct.color} ${ct.key === 'Unknown' ? 'border border-gray-400' : ''}`}
                >
                  <span className={`font-semibold text-sm ${ct.value === '?' || ct.value === 'G' || ct.value === 'P' ? 'text-gray-800' : 'text-white'}`}>
                    {ct.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

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
            // Temporarily ignore remote changes to prevent sync loop
            setIgnoreRemoteChanges(true);
            if (importData) {
              // Handle import case - restore complete state
              setState(importData);
            } else if (resetAllCrates) {
              setState(s => ({ ...s, allCrates: [], config: cfg }));
            } else {
              setState(s => ({ ...s, config: cfg }));
            }
            // Re-enable remote changes after a short delay
            setTimeout(() => setIgnoreRemoteChanges(false), 200);
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
        <div>
          {currentUser ? 'Data synced to your account' : 'Sign in to save your data to the cloud'}
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

function ConfigView({ config, onChange, onBack, setIgnoreRemoteChanges }) {
  const { currentUser, saveUserData, exportUserData, importUserData } = useAuth();
  const [local, setLocal] = useState(config);
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => setLocal(config), [config]);

  function commit() {
    onChange(local);
    onBack();
  }

  async function reset() {
    // Temporarily ignore remote changes to prevent sync loop
    setIgnoreRemoteChanges(true);

    const resetData = { allCrates: [], config: { wins: 0, gpWins: 0 } };

    // Save to Firestore
    if (currentUser) {
      try {
        await saveUserData(resetData);
      } catch (error) {
        console.error('Firestore reset save failed:', error);
      }
    } else {
      console.log('No current user, cannot reset data');
    }
    
    // Update state and navigate back
    onChange({ wins: 0, gpWins: 0 }, true);
    setImportStatus('All Data reset successfully!');
    setTimeout(() => setImportStatus(''), 3000);

    // Re-enable remote changes after a longer delay to ensure all operations complete
    setTimeout(() => {
      console.log('Re-enabling remote changes');
      setIgnoreRemoteChanges(false);
    }, 200);
  }

  async function handleExport() {
    try {
      await exportUserData();
      setImportStatus('Data exported successfully!');
      setTimeout(() => setImportStatus(''), 3000);
    } catch (error) {
      setImportStatus('Export failed: ' + error.message);
      setTimeout(() => setImportStatus(''), 3000);
    }
  }

  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setImportStatus('Importing...');
      const importedData = await importUserData(file);

      // Prepare the complete state data for import
      const completeImportData = {
        allCrates: importedData.allCrates,
        config: {
          wins: importedData.config.wins || 0,
          gpWins: importedData.config.gpWins || 0
        }
      };

      // Use onChange with importData parameter to restore complete state
      onChange(null, false, completeImportData);

      setImportStatus('Data imported successfully!');
      setTimeout(() => setImportStatus(''), 3000);
    } catch (error) {
      setImportStatus('Import failed: ' + error.message);
      setTimeout(() => setImportStatus(''), 3000);
    }

    // Clear the input
    event.target.value = '';
  }

  return (
  <div className="bg-gray-700 px-6 py-4 rounded-2xl shadow-lg">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-white tracking-wide">Config</h2>
      <button className="text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200" onClick={onBack}>Back</button>
    </div>

    <label className="block mb-4">
      <div className="text-xs text-gray-300 font-semibold">Number of wins</div>
      <input type="number" value={local.wins} onChange={e => setLocal({...local, wins: Number(e.target.value)})} className="mt-2 w-full py-2 px-3 border rounded-xl bg-gray-700 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </label>

    <label className="block mb-4">
      <div className="text-xs text-gray-300 font-semibold">GP wins</div>
      <input type="number" value={local.gpWins} onChange={e => setLocal({...local, gpWins: Number(e.target.value)})} className="mt-2 w-full py-2 px-3 border rounded-xl bg-gray-700 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </label>


    <div className="flex gap-4">
      <button onClick={commit} className="flex-1 py-2 px-3 rounded-lg bg-blue-600 text-white font-semibold text-sm shadow hover:bg-blue-700 transition-colors duration-200">Save</button>
      <button onClick={onBack} className="flex-1 py-2 px-3 rounded-lg border border-gray-500 bg-gray-600 text-gray-300 font-semibold text-sm shadow hover:bg-gray-700 transition-colors duration-200">Cancel</button>
    </div>
    <div className="mt-6">
      <div className="text-sm text-gray-300 mb-3 font-semibold text-center">Data Management</div>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <button
          onClick={handleExport}
          className="py-2 px-3 rounded-lg bg-green-600 text-white font-semibold text-sm shadow hover:bg-green-700 transition-colors duration-200"
        >
          Export Data
        </button>
        <label className="py-2 px-3 rounded-lg bg-purple-600 text-white font-semibold text-sm shadow hover:bg-purple-700 transition-colors duration-200 cursor-pointer text-center">
          Import Data
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
        <button 
          onClick={reset} 
          className="py-2 px-3 col-span-full rounded-lg bg-red-600 text-white text-sm font-semibold shadow hover:bg-red-700 transition-colors duration-200">
            Reset All Values
        </button>
    
      </div>
      {importStatus && (
        <div className={`text-sm p-2 rounded-lg text-center ${importStatus.includes('failed') || importStatus.includes('Failed') ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {importStatus}
        </div>
      )}
    </div>
  </div>
  )
}

function IntroView({onBack}) {
  return (
    <div className="bg-gray-700 px-6 py-4 rounded-2xl shadow-lg">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-white tracking-wide">Introduction</h2>
      <button className="text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200" onClick={onBack}>Back</button>
    </div>

    <div className="">
      <div className="text-sm text-gray-300 mb-3 font-semibold text-center">Welcome to the Crate Tracker for F1 Clash!</div>
      <div className="text-xs text-gray-300 mb-3">
        This app helps you track your crate wins and predict future crates based on the known pattern. 
        Simply log each crate you win and get predictions for the next 10. Predictions get better the more crates you log. 
      </div>
      <div className="text-xs text-gray-300 mb-3">
        Note: Since you signed in with your Google account. Your data will be synced to the cloud, allowing you to access it from any device.
      </div>
      <div className="text-xs text-gray-300 mb-3">
        To get started:
        <ul className="list-disc list-inside mt-2 mb-2">
          <li>Log any crates you already know IN ORDER</li>
          <li>Set your total wins to match your in-game total (Click the gear icon at top right)</li>
        </ul>
      </div>
      <div className="text-xs text-gray-300 mb-3">
        Once setup, simply log each crate you win. The app will automatically update your win count and GP wins (Blue crates).
      </div>
    </div>
  </div>
  )
}
        
export default App
