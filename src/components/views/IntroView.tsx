import React from 'react';

/**
 * IntroView component for the welcome screen
 */
interface IntroViewProps {
  onBack: () => void;
}

function IntroView({ onBack }: IntroViewProps) {
  return (
    <div className="bg-gray-700 px-6 py-4 rounded-2xl shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white tracking-wide">Introduction</h2>
        <button
          className="py-1 px-4 rounded-lg bg-blue-600 text-white font-semibold text-sm shadow hover:bg-blue-700 transition-colors duration-200"
          onClick={onBack}
        >
          Start
        </button>
      </div>

      <div className="">
        <div className="text-sm text-gray-300 mb-3 font-semibold text-center">
          Welcome to the Crate Tracker for F1 Clash!
        </div>
        <div className="text-xs text-gray-300 mb-3">
          This app helps you track your crate wins and predict future crates based on the known pattern.
          Simply log each crate you win and get predictions for the next 10. Predictions get better the more crates you log.
        </div>
        <div className="text-xs text-gray-300 mb-3">
          Note: Since you signed in with your Google account. Your data will be synced to the cloud, allowing you to access it from any device.
        </div>
        <div className="text-xs text-gray-300 mb-3">
          To get started:
          <ul className="list-disc list-inside mt-2 mb-2">
            <li>Log any crates you already know IN ORDER</li>
            <li>Set your total wins to match your in-game total (Click the gear icon at top right)</li>
          </ul>
        </div>
        <div className="text-xs text-gray-300 mb-3">
          Once setup, simply log each crate you win. The app will automatically update your win count and GP wins (Blue crates).
        </div>
      </div>
    </div>
  );
}

export default IntroView;
