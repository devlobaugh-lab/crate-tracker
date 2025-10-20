import React from 'react';

/**
 * SmallRow component for displaying a row of crate indicators
 * @param {Object} props
 * @param {Array} props.crates - Array of crate objects with color and other properties
 * @param {string} props.className - Additional CSS classes
 */
function SmallRow({ crates = [], className = '' }) {
  if (crates.length === 0) {
    return (
      <div className={`text-center text-gray-400 italic py-1 ${className}`}>
        No data
      </div>
    );
  }

  return (
    <div className={`flex gap-2 justify-center ${className}`}>
      {crates.map((crate, index) => (
        <div
          key={index}
          className={`w-8 h-8 rounded-none shadow-lg border ${crate.color}`}
          title={crate.label}
        />
      ))}
    </div>
  );
}

export default SmallRow;
