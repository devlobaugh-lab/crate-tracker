import { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext.tsx';
import logger from '../../utils/logger';

/**
 * ConfigView component for application settings and data management
 */
interface ConfigViewProps {
  config: {
    wins: number;
    gpWins: number;
  };
  allCrates: string[];
  onChange: (config: any, resetAllCrates?: boolean, importData?: any) => void;
  onBack: () => void;
  onAdmin: () => void;
  setIgnoreRemoteChanges: (ignore: boolean) => void;
}

interface LocalConfig {
  wins: number;
  gpWins: number;
}

function ConfigView({
  config,
  allCrates: _allCrates,
  onChange,
  onBack,
  onAdmin,
  setIgnoreRemoteChanges,
}: ConfigViewProps) {
  const { currentUser, saveUserData, exportUserData, importUserData } = useAuth();
  const [local, setLocal] = useState<LocalConfig>(config || { wins: 0, gpWins: 0 });
  const [importStatus, setImportStatus] = useState<string>('');

  useEffect(() => {
    setLocal(config || { wins: 0, gpWins: 0 });
  }, [config]);

  function commit(): void {
    onChange(local);
    onBack();
  }

  function reset(): void {
    logger.log('🔄 Reset button clicked');

    // Temporarily ignore remote changes to prevent sync loop
    setIgnoreRemoteChanges(true);

    // Update state immediately - this should always work
    logger.log('🔄 Resetting state to zero');
    onChange({ wins: 0, gpWins: 0 }, true, false);

    // Save to Firestore (will fail if offline, but that's okay)
    if (currentUser) {
      const resetData = { allCrates: [], config: { wins: 0, gpWins: 0 } };
      saveUserData(resetData).catch((error: Error) => {
        logger.log('ℹ️ Firestore save failed (expected if offline):', error.message);
      });
    }

    logger.log('✅ State reset completed');
    setImportStatus('All Data reset successfully!');
    setTimeout(() => setImportStatus(''), 3000);

    // Re-enable remote changes after a shorter delay
    setTimeout(() => {
      logger.log('Re-enabling remote changes');
      setIgnoreRemoteChanges(false);
    }, 200);
  }

  async function handleExport(): Promise<void> {
    try {
      await exportUserData();
      setImportStatus('Data exported successfully!');
      setTimeout(() => setImportStatus(''), 3000);
    } catch (error) {
      setImportStatus('Export failed: ' + (error as Error).message);
      setTimeout(() => setImportStatus(''), 3000);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus('Importing...');
      const importedData = await importUserData(file);

      // Prepare the complete state data for import
      const completeImportData = {
        allCrates: importedData.allCrates,
        config: {
          wins: importedData.config.wins || 0,
          gpWins: importedData.config.gpWins || 0,
        },
      };

      // Use onChange with importData parameter to restore complete state
      onChange(null, false, completeImportData);

      setImportStatus('Data imported successfully!');
      setTimeout(() => setImportStatus(''), 3000);
    } catch (error) {
      setImportStatus('Import failed: ' + (error as Error).message);
      setTimeout(() => setImportStatus(''), 3000);
    }

    // Clear the input
    event.target.value = '';
  }

  return (
    <div className='bg-gray-700 px-6 py-4 rounded-2xl shadow-lg'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-xl font-bold text-white tracking-wide'>Config</h2>
        <button
          className='text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200'
          onClick={onBack}
        >
          Back
        </button>
      </div>

      <label className='block mb-4'>
        <div className='text-sm text-white font-semibold'>Number of wins:</div>
        <input
          type='number'
          value={local.wins}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setLocal({ ...local, wins: Number(e.target.value) })
          }
          className='mt-2 w-full py-2 px-3 border rounded-xl bg-gray-600 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      </label>

      <label className='block mb-4'>
        <div className='text-sm text-white font-semibold'>GP wins:</div>
        <input
          type='number'
          value={local.gpWins}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setLocal({ ...local, gpWins: Number(e.target.value) })
          }
          className='mt-2 w-full py-2 px-3 border rounded-xl bg-gray-600 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      </label>

      <div className='flex gap-4'>
        <button
          onClick={commit}
          className='flex-1 py-2 px-3 rounded-lg bg-blue-600 text-white font-semibold text-sm shadow hover:bg-blue-700 transition-colors duration-200'
        >
          Save
        </button>
        <button
          onClick={onBack}
          className='flex-1 py-2 px-3 rounded-lg border border-gray-500 bg-gray-600 text-gray-300 font-semibold text-sm shadow hover:bg-gray-700 transition-colors duration-200'
        >
          Cancel
        </button>
      </div>

      <div className='mt-6'>
        <div className='text-sm text-white mb-3 font-semibold text-center'>Data Management</div>
        <div className='grid grid-cols-2 gap-3 mb-2'>
          <button
            onClick={handleExport}
            className='py-2 px-3 rounded-lg bg-green-700 text-white font-semibold text-sm shadow hover:bg-green-800 transition-colors duration-200'
          >
            Export Data
          </button>
          <label className='py-2 px-3 rounded-lg bg-purple-700 text-white font-semibold text-sm shadow hover:bg-purple-800 transition-colors duration-200 cursor-pointer text-center'>
            Import Data
            <input type='file' accept='.json' onChange={handleImport} className='hidden' />
          </label>
          <button
            onClick={() => reset()}
            className='py-2 px-3 col-span-full rounded-lg bg-red-700 text-white text-sm font-semibold shadow hover:bg-red-800 transition-colors duration-200'
          >
            Reset All Values
          </button>
        </div>
        {importStatus && (
          <div
            className={`text-sm mt-3 py-2 px-3 font-semibold rounded-lg text-center ${
              importStatus.includes('failed') || importStatus.includes('Failed')
                ? 'bg-red-700 text-white'
                : 'bg-green-700 text-white'
            }`}
          >
            {importStatus}
          </div>
        )}
      </div>

      {currentUser?.role === 'admin' && (
        <div className='mt-4 pt-4 border-t border-gray-500'>
          <button
            onClick={onAdmin}
            className='w-full py-2 px-4 rounded-lg bg-blue-700 text-white font-semibold text-sm shadow hover:bg-blue-900 transition-colors duration-200'
          >
            User Administration
          </button>
        </div>
      )}
    </div>
  );
}

export default ConfigView;
