/**
 * ManualDateModal Component
 *
 * Modal for manually setting a date/time for a round
 */

import { useState, useEffect } from 'react';
import { datetimeLocalToISO, isoToDatetimeLocal } from '../../../utils/dateUtils';

interface ManualDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (date: Date) => void;
  onSaveToAll?: (date: Date) => void;
  roundNumber: number;
  currentDate?: string;
}

export default function ManualDateModal({
  isOpen,
  onClose,
  onSave,
  onSaveToAll,
  roundNumber,
  currentDate,
}: ManualDateModalProps) {
  const [dateTime, setDateTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (currentDate) {
        // Convert existing UTC date to local datetime-local format
        setDateTime(isoToDatetimeLocal(currentDate));
      } else {
        // Default to now in local time
        const now = new Date();
        setDateTime(isoToDatetimeLocal(now.toISOString()));
      }
    }
  }, [isOpen, currentDate]);

  const handleSave = () => {
    if (!dateTime) {
      alert('Please select a date and time');
      return;
    }

    // Convert local datetime back to UTC Date object
    const isoString = datetimeLocalToISO(dateTime);
    const date = new Date(isoString);
    onSave(date);
    onClose();
  };

  const handleSaveToAll = () => {
    if (!dateTime) {
      alert('Please select a date and time');
      return;
    }

    if (!onSaveToAll) return;

    // Convert local datetime back to UTC Date object
    const isoString = datetimeLocalToISO(dateTime);
    const date = new Date(isoString);
    onSaveToAll(date);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            Set Date for Round {roundNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Date and Time
            </label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="text-sm text-gray-500 space-y-2">
            <p>
              <strong>Save to This Round:</strong> Sets this date/time for all games in Round {roundNumber}.
            </p>
            {onSaveToAll && (
              <p>
                <strong>Apply to All Rounds:</strong> Uses this as the starting date and automatically schedules all rounds with 7-day spacing, adjusting to the earliest available venue time for each round.
              </p>
            )}
            <p className="text-xs">
              Games on the same pitch will be staggered based on game duration. Venue availability will be checked to ensure matches are scheduled when venues are open.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 space-y-3">
          {onSaveToAll && (
            <button
              onClick={handleSaveToAll}
              className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Apply to All Rounds
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save to This Round
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
