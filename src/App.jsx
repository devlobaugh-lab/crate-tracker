import React, { useEffect, useState } from 'react'

const CRATE_TYPES = [
  { key: 'Green', color: 'bg-green-700', label: 'Green', value: 'B' },
  { key: 'Gold', color: 'bg-yellow-400', label: 'Gold', value: 'G' },
  { key: 'Platinum', color: 'bg-gray-400', label: 'Platinum', value: 'P' },
  { key: 'Legendary', color: 'bg-amber-700', label: 'Legendary', value: 'L' },
  { key: 'GP', color: 'bg-blue-500', label: 'GP', value: 'X' },
  { key: 'Unknown', color: 'bg-white', label: 'Unknown', value: '?'}
]

const STORAGE_KEY = 'crate-tracker:v1'

const MASTER_PATTERN = `BBBBBBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBGBBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBG
BBBGBBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBLBBGBBBGBBBBGBGBBBBGBBBBGBBG
BBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBL
BBBBBBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBGBBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBG
BBBGBBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBLBBGBBBGBBBBGBGBBBBGBBBBGBBG
BBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBL
BBBBBBBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBGBBBBBPBGBBBBGBBGBBBGBBBBGBGBBBBLBBBBGBBB
GBBBGBBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBLBBGBBBGBBBBGBGBBBBGBBBBGBB
GBBBBPBBGBBBBGBBGBBBGBBBBGBGBBBBGBBBBGBBGBBBBGBBGBBBBPBBGBBBGBBBBGBGBBBBGBBBBGBBL`;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to read localStorage', e)
    return null
  }
}

function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to write localStorage', e)
  }
}

// function SmallRow({ crates = [] }) {
//   return (
//     <div className="flex gap-2 justify-center">
//       {/* {crates.toString()} */}
//       {crates.map((c, i) => (
//         <div key={i} className={`w-8 h-8 rounded-none shadow-lg border ${c.color}`}></div>
//       ))}
//     </div>
//   )
// }

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

function App() {
  const [state, setState] = useState(() => {
    const stored = loadFromStorage()
    if (stored) return stored
    return { allCrates: [], config: { wins: 0, gpWins: 0 } }
  })

  useEffect(() => saveToStorage(state), [state])

  const lastTen = state.allCrates.slice(-10).map(v => CRATE_TYPES.find(t => t.value === v) || CRATE_TYPES.find(t => t.value === '?'));
  const futureTen = nextPatternValues(state.allCrates, MASTER_PATTERN).map(v => CRATE_TYPES.find(t => t.value === v) || CRATE_TYPES.find(t => t.value === '?'));

  function addCrate(crateKey) {
    const crateType = CRATE_TYPES.find(t => t.key === crateKey)
    const crateValue = crateType ? crateType.value : '?'
    const newAll = [...state.allCrates, crateValue]
    const newConfig = { ...state.config }
    newConfig.wins += 1
    if (crateKey === 'GP') newConfig.gpWins += 1
    // else newConfig.patternLocation += 1
    setState({ ...state, allCrates: newAll, config: newConfig })
  }

  function undoCrate() {
    if (state.allCrates.length === 0) return; // Nothing to undo
    const lastCrate = state.allCrates[state.allCrates.length - 1];
    const newAllCrates = state.allCrates.slice(0, -1);
    const newConfig = { ...state.config };
    newConfig.wins -= 1;
    if (lastCrate === 'X') newConfig.gpWins -= 1;
    setState({ ...state, allCrates: newAllCrates, config: newConfig });
  } 

  const [view, setView] = useState('main')

  return (
  <div className="min-h-screen bg-gray-900 p-6 max-w-md mx-auto font-sans flex flex-col justify-center">
      <header className="flex items-center justify-between mb-8 rounded-xl shadow-lg bg-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-white tracking-wide">Crate Tracker</h1>
        <div className="text-sm text-gray-200 font-semibold">Wins: {state.config.wins}</div>
        {/* <button className="text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200" onClick={() => setView('config')}>Config</button> */}
      </header>

      {view === 'main' && (
        <main>
          <section className="mb-8">
            <div className="text-xs text-gray-300 mb-2 font-semibold tracking-wide">Last 10 crates</div>
            <SmallRow crates={lastTen} />
          </section>

          <section className="mb-8 bg-gray-700 p-6 rounded-2xl shadow-lg">
            <div className="text-sm text-gray-200 mb-4 font-semibold">Choose current crate</div>
            <div className="grid grid-cols-3 gap-4">
              {CRATE_TYPES.map(ct => (
                  <button key={ct.key} onClick={() => addCrate(ct.key)} className={`p-3 rounded-lg shadow-md flex items-center justify-center transition-transform duration-150 hover:scale-105 hover:shadow-xl ${ct.color} ${ct.key === 'Unknown' ? 'border border-gray-400' : ''}`}>
                    <span className={`font-semibold text-sm ${ct.value === '?' || ct.value === 'G' || ct.value === 'P' ? 'text-gray-800' : 'text-white'}`}>{ct.label}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-8">
              <button onClick={() => undoCrate()} className="px-4 py-2 rounded-lg bg-red-700 text-white font-semibold text-sm shadow hover:bg-red-900 transition-colors duration-200">Undo</button>
            </div>
          </section>

          <section className="mb-6">
            <div className="text-xs text-gray-300 mb-2 font-semibold tracking-wide">Next 10 (predictions)</div>
            <SmallRow crates={futureTen} />
          </section>

          <section className="mb-0 mt-6 text-center">
             <button className="text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200" onClick={() => setView('config')}>Config</button>
          </section>
        </main>
      )}

      {view === 'config' && (
        <ConfigView config={state.config} onChange={(cfg, resetAllCrates) => {
          if (resetAllCrates) {
            setState(s => ({ ...s, allCrates: [], config: cfg }))
          } else {
            setState(s => ({ ...s, config: cfg }))
          }
        }} onBack={() => setView('main')} />
      )}

  <footer className="mt-8 text-xs text-gray-500 text-center">All data stored locally in your browser.</footer>
    </div>
  )
}

function ConfigView({ config, onChange, onBack }) {
  const [local, setLocal] = useState(config)

  useEffect(() => setLocal(config), [config])

  function commit() {
    onChange(local)
    onBack()
  }

  function reset() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('crate-tracker:v1', JSON.stringify({ allCrates: [], config: { wins: 0, gpWins: 0 } }))
    }
    onChange({ wins: 0, gpWins: 0 }, true)
    onBack()
  }

  return (
  <div className="bg-gray-700 p-6 rounded-2xl shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white tracking-wide">Config</h2>
        <button className="text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200" onClick={onBack}>Back</button>
      </div>

      <label className="block mb-4">
        <div className="text-xs text-gray-300 font-semibold">Number of wins</div>
        <input type="number" value={local.wins} onChange={e => setLocal({...local, wins: Number(e.target.value)})} className="mt-2 w-full p-3 border rounded-xl bg-gray-700 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </label>

      <label className="block mb-4">
        <div className="text-xs text-gray-300 font-semibold">GP wins</div>
        <input type="number" value={local.gpWins} onChange={e => setLocal({...local, gpWins: Number(e.target.value)})} className="mt-2 w-full p-3 border rounded-xl bg-gray-700 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </label>

      <div className="flex gap-4">
        <button onClick={commit} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition-colors duration-200">Save</button>
        {/* <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-gray-500 text-gray-300 font-semibold shadow hover:bg-gray-700 transition-colors duration-200">Cancel</button> */}
        <button onClick={reset} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition-colors duration-200">Reset All Values</button>
      </div>
    </div>
  )
}

export default App
