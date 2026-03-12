/**
 * MigrationNoticeView component — shown once to users migrated to multi-series
 */
interface MigrationNoticeViewProps {
  onDismiss: () => void;
}

function MigrationNoticeView({ onDismiss }: MigrationNoticeViewProps) {
  return (
    <div className='bg-gray-700 px-6 py-4 rounded-2xl shadow-lg'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-xl font-bold text-white tracking-wide'>Update:</h2>
        <button
          className='py-1 px-4 rounded-lg bg-blue-600 text-white font-semibold text-sm shadow hover:bg-blue-700 transition-colors duration-200'
          onClick={onDismiss}
        >
          Got it
        </button>
      </div>

      <div className=''>
        <div className='text-sm text-gray-300 mb-3 font-semibold text-center'>
          Crate Tracker now supports multiple series!
        </div>
        <div className='text-xs text-gray-300 mb-3'>
          As the game has changed to have a separate crate history for each series, I have 
          updated the app to do the same. Now each series has its own crate history and 
          predictions. 
        </div>
        <div className='text-xs text-gray-300 mb-3'>
          Your existing crate history has been saved to <strong>Series 12</strong> and you should
          be able to continue tracking there as before. (If you were not in Series 12, just 
          pretend your current series is named Series 12 for now.)
        </div>
        <div className='text-xs text-gray-300 mb-3'>
          Use the series selector at the top of the screen to switch between series. Your win totals
          remain shared across all series.
        </div>
        <div className='text-xs text-gray-300 mb-3'>
          To start a new series, simply switch to an empty slot and begin logging crates.
        </div>
      </div>
    </div>
  );
}

export default MigrationNoticeView;
