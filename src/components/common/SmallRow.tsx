import React from 'react';

/**
 * SmallRow component for displaying a row of crate indicators
 * Memoized to prevent unnecessary re-renders when crate data hasn't changed
 */
interface CrateItem {
  color: string;
  label: string;
}

interface SmallRowProps {
  crates?: CrateItem[];
  className?: string;
}

const SmallRow = React.memo<SmallRowProps>(({ crates = [], className = '' }) => {
  if (crates.length === 0) {
    return <div className={`text-center text-gray-400 italic py-1 ${className}`}>No data</div>;
  }

  return (
    <div className={`flex gap-2 justify-center ${className}`}>
      {crates.map((crate: CrateItem, index: number) => (
        <div
          key={index}
          className={`w-8 h-8 rounded shadow-lg  ${crate.color}`}
          title={crate.label}
        />
      ))}
    </div>
  );
});

SmallRow.displayName = 'SmallRow';

export default SmallRow;
