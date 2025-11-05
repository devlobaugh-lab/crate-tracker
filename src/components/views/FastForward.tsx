import { useState, useRef, useEffect } from 'react';

/**
 * FastForward modal component for bulk updating wins and filling crate history
 */
interface FastForwardProps {
  onSubmit: (additionalGP: number, additionalTotal: number) => void;
  onCancel: () => void;
  currentGP: number;
  currentTotal: number;
}

function FastForward({ onSubmit, onCancel, currentGP, currentTotal }: FastForwardProps) {
  const [additionalGP, setAdditionalGP] = useState<string>('');
  const [newTotal, setNewTotal] = useState<string>('');
  const gpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (gpInputRef.current) {
      gpInputRef.current.focus();
    }
  }, []);

  function handleSubmit() {
    const gpValue = Number(additionalGP);
    const totalValue = Number(newTotal);

    if (isNaN(gpValue) || isNaN(totalValue)) {
      alert('Please enter valid numbers');
      return;
    }

    if (gpValue < 0) {
      alert('Additional GP wins must be 0 or more');
      return;
    }

    if (totalValue < currentTotal + gpValue) {
      alert(`New total wins must be ${currentTotal + gpValue} or more`);
      return;
    }

    onSubmit(gpValue, totalValue);
  }

  return (
    <div className='mb-2 bg-gray-700 p-6 pb-8 rounded-2xl shadow-lg text-white'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-xl font-bold text-white tracking-wide'>Fast Forward</h2>
        <button
          className='text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200'
          onClick={onCancel}
        >
          Back
        </button>
      </div>
      <p className='text-sm font-semibold text-green-300 mb-1'>Current total wins: {currentTotal}</p>
      <p className='text-sm font-semibold text-blue-300 mb-4'>Current GP wins: {currentGP}</p>

      <label className='block mb-4'>
        <div className='text-sm font-semibold mb-2'>Additional GP wins:</div>
        <input
          ref={gpInputRef}
          type='number'
          className='w-full py-2 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
          placeholder='Enter additional GP wins'
          value={additionalGP}
          onChange={e => setAdditionalGP(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          min={0}
        />
      </label>

      <label className='block mb-6'>
        <div className='text-sm font-semibold mb-2'>New total wins:</div>
        <input
          type='number'
          className='w-full py-2 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
          placeholder='Enter new total wins'
          value={newTotal}
          onChange={e => setNewTotal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          min={currentTotal + Number(additionalGP || 0)}
        />
      </label>

      <div className='flex gap-4'>
        <button
          onClick={handleSubmit}
          className='flex-1 py-2 px-3 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors'
        >
          Submit
        </button>
        <button
          onClick={onCancel}
          className='flex-1 py-2 px-3 rounded-lg border border-gray-500 bg-gray-600 text-gray-300 font-semibold text-sm hover:bg-gray-700 transition-colors'
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default FastForward;
