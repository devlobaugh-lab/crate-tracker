import React from 'react';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { CRATE_TYPES } from '../../utils/constants.js';

/**
 * CrateGrid component for displaying and selecting crate types
 * @param {Object} props
 * @param {Function} props.onCrateSelect - Callback when a crate is selected
 * @param {Function} props.onUndo - Callback for undo action
 */
function CrateGrid({ onCrateSelect, onUndo }) {
  return (
    <section className="mb-4 bg-gray-700 p-6 pb-8 rounded-2xl shadow-lg">
      <div className="text-sm text-gray-200 mb-4 font-semibold flex justify-between items-center">
        <div>Choose current crate</div>
        <button
          onClick={onUndo}
          className="text-sm underline mr-1 text-gray-300 hover:text-blue-400 transition-colors duration-200"
          title="Undo last crate"
        >
          <ArrowUturnLeftIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {CRATE_TYPES.map(crateType => (
          <button
            key={crateType.key}
            onClick={() => onCrateSelect(crateType.key)}
            className={`p-3 rounded-lg shadow-md flex items-center justify-center transition-transform duration-150 hover:scale-105 hover:shadow-xl ${crateType.color} ${crateType.key === 'Unknown' ? 'border border-gray-400' : ''}`}
          >
            <span className={`font-semibold text-sm ${crateType.value === '?' || crateType.value === 'G' || crateType.value === 'P' ? 'text-gray-800' : 'text-white'}`}>
              {crateType.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default CrateGrid;
