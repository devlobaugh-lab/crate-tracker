import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';

/**
 * ConfigView component for application settings and data management
 * @param {Object} props
 * @param {Object} props.config - Current configuration object
 * @param {Array} props.allCrates - All crate history
 * @param {Function} props.onChange - Callback for config changes
 * @param {Function} props.onBack - Callback to go back to main view
 * @param {Function} props.setIgnoreRemoteChanges - Function to ignore remote changes
 */
function ConfigView({ config, allCrates, onChange, onBack, setIgnoreRemoteChanges }) {
  const { currentUser, saveUserData, exportUserData, importUserData, isOnline, syncStatus } = useAuth();
  const [local, setLocal] = useState(config || { wins: 0, gpWins: 0 });
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    setLocal(config || { wins: 0, gpWins: 0 });
  }, [config]);

  function commit() {
    onChange(local);
    onBack();
  }

  function reset() {
    console.log('🔄 Reset button clicked');

    // Temporarily ignore remote changes to prevent sync loop
    setIgnoreRemoteChanges(true);

    // Update state immediately - this should always work
    console.log('🔄 Resetting state to zero');
    onChange({ wins: 0, gpWins: 0 }, true, false);

    // Save to Firestore (will fail if offline, but that's okay)
    if (currentUser) {
      const resetData = { allCrates: [], config: { wins: 0, gpWins: 0 } };
      saveUserData(resetData).catch(error => {
        console.log('ℹ️ Firestore save failed (expected if offline):', error.message);
      });
    }

    console.log('✅ State reset completed');
    setImportStatus('All Data reset successfully!');
    setTimeout(() => setImportStatus(''), 3000);

    // Re-enable remote changes after a shorter delay
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
        <button
          className="text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200"
          onClick={onBack}
        >
          Back
        </button>
      </div>

      <label className="block mb-4">
        <div className="text-xs text-gray-300 font-semibold">Number of wins</div>
        <input
          type="number"
          value={local.wins}
          onChange={e => setLocal({...local, wins: Number(e.target.value)})}
          className="mt-2 w-full py-2 px-3 border rounded-xl bg-gray-700 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>

      <label className="block mb-4">
        <div className="text-xs text-gray-300 font-semibold">GP wins</div>
        <input
          type="number"
          value={local.gpWins}
          onChange={e => setLocal({...local, gpWins: Number(e.target.value)})}
          className="mt-2 w-full py-2 px-3 border rounded-xl bg-gray-700 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>

      <div className="flex gap-4">
        <button
          onClick={commit}
          className="flex-1 py-2 px-3 rounded-lg bg-blue-600 text-white font-semibold text-sm shadow hover:bg-blue-700 transition-colors duration-200"
        >
          Save
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-2 px-3 rounded-lg border border-gray-500 bg-gray-600 text-gray-300 font-semibold text-sm shadow hover:bg-gray-700 transition-colors duration-200"
        >
          Cancel
        </button>
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
            onClick={() => reset()}
            className="py-2 px-3 col-span-full rounded-lg bg-red-600 text-white text-sm font-semibold shadow hover:bg-red-700 transition-colors duration-200"
          >
            Reset All Values
          </button>
        </div>
        {importStatus && (
          <div className={`text-sm p-2 rounded-lg text-center ${
            importStatus.includes('failed') || importStatus.includes('Failed')
              ? 'bg-red-600 text-white'
              : 'bg-green-600 text-white'
          }`}>
            {importStatus}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConfigView;
