import { useState } from 'react';

/**
 * FastForward modal component for bulk updating wins and filling crate history
 */
interface FastForwardProps {
  onSubmit: (additionalGP: number, additionalTotal: number) => void;
  onCancel: () => void;
  currentGP: number;
  currentTotal: number;
}

interface PromptState {
  step: 'gp' | 'total';
  additionalGP?: number;
}

function FastForward({ onSubmit, onCancel, currentGP, currentTotal }: FastForwardProps) {
  const [state, setState] = useState<PromptState>({ step: 'gp' });
  const [inputValue, setInputValue] = useState<string>('');

  function handleNext() {
    const value = Number(inputValue);
    if (isNaN(value)) {
      alert('Please enter a valid number');
      return;
    }

    if (state.step === 'gp') {
      if (value < 0) {
        alert('Additional GP wins must be 0 or more');
        return;
      }
      setState({ step: 'total', additionalGP: value });
      setInputValue('');
    } else if (state.step === 'total' && state.additionalGP !== undefined) {
      if (value < currentTotal + state.additionalGP) {
        alert(`New total wins must be ${currentTotal + state.additionalGP} or more`);
        return;
      }
      onSubmit(state.additionalGP, value);
    }
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
      <div className='bg-gray-700 rounded-2xl shadow-lg p-6 max-w-md w-full text-white'>
        <h2 className='text-xl font-bold mb-4'>Fast Forward</h2>

        {state.step === 'gp' ? (
          <>
            <p className='text-sm mb-4'>Current GP wins: {currentGP}</p>
            <label className='block mb-4'>
              <div className='text-sm font-semibold mb-2'>Additional GP wins:</div>
              <input
                type='number'
                className='w-full py-2 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400'
                placeholder='Enter additional GP wins'
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                min={0}
              />
            </label>
          </>
        ) : (
          <>
            <p className='text-sm mb-4'>
              After adding GP crates, current total wins: {currentTotal + (state.additionalGP || 0)}
            </p>
            <label className='block mb-4'>
              <div className='text-sm font-semibold mb-2'>New total wins:</div>
              <input
                type='number'
                className='w-full py-2 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400'
                placeholder='Enter new total wins'
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNext()}
                min={currentTotal + (state.additionalGP || 0)}
              />
            </label>
          </>
        )}

        <div className='flex gap-4'>
          <button
            onClick={onCancel}
            className='flex-1 py-2 px-3 rounded-lg border border-gray-500 bg-gray-600 text-gray-300 font-semibold text-sm hover:bg-gray-700 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleNext}
            className='flex-1 py-2 px-3 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors'
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default FastForward;
