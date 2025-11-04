/**
 * SmallRow component for displaying a row of crate indicators
 */
interface CrateItem {
  color: string;
  label: string;
}

interface SmallRowProps {
  crates?: CrateItem[];
  className?: string;
}

function SmallRow({ crates = [], className = '' }: SmallRowProps) {
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
}

export default SmallRow;
