import { ArrowUturnLeftIcon, ForwardIcon } from '@heroicons/react/24/outline';
import { CRATE_TYPES, CrateType } from '../../utils/constants';

/**
 * CrateGrid component for displaying and selecting crate types
 */
interface CrateGridProps {
  onCrateSelect: (crateKey: string) => void;
  onUndo: () => void;
  onFastForward: () => void;
}

function CrateGrid({ onCrateSelect, onUndo, onFastForward }: CrateGridProps) {
  return (
    <section className='mb-4 bg-gray-700 p-6 pb-8 rounded-2xl shadow-lg'>
      <div className='text-sm text-gray-200 mb-4 font-semibold flex justify-between items-center'>
        <div>Choose current crate</div>
        <div className='flex gap-2'>
          <button
            onClick={onFastForward}
            className='text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200'
            title='Fast forward to add bulk wins'
          >
            <ForwardIcon className='w-6 h-6' />
          </button>
          <button
            onClick={onUndo}
            className='text-sm underline mr-1 text-gray-300 hover:text-blue-400 transition-colors duration-200'
            title='Undo last crate'
          >
            <ArrowUturnLeftIcon className='w-6 h-6' />
          </button>
        </div>
      </div>
      <div className='grid grid-cols-3 gap-4'>
        {CRATE_TYPES.map((crateType: CrateType) => (
          <button
            key={crateType.key}
            onClick={() => onCrateSelect(crateType.key)}
            className={`p-3 rounded-lg shadow-md flex items-center justify-center transition-transform duration-150 hover:scale-105 hover:shadow-xl ${crateType.color} ${crateType.key === 'Unknown' ? 'border border-gray-400' : ''}`}
          >
            <span
              className={`font-semibold text-sm ${crateType.value === '?' || crateType.value === 'G' || crateType.value === 'P' ? 'text-gray-800' : 'text-white'}`}
            >
              {crateType.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default CrateGrid;
