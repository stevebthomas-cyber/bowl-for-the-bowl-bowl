/**
 * ManualTimeModal Component
 *
 * Modal for manually setting a specific time for a match
 */

import { useState, useEffect } from 'react';

interface ManualTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (date: Date) => void;
  matchNumber: number;
  currentDate?: string;
}

export default function ManualTimeModal({
  isOpen,
  onClose,
  onSave,
  matchNumber,
  currentDate,
}: ManualTimeModalProps) {
  const [dateTime, setDateTime] = useState('');

  useEffect(() => {
    if (isOpen && currentDate) {
      // Convert UTC date to local datetime-local format
      const date = new Date(currentDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      setDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  }, [isOpen, currentDate]);

  const handleSave = () => {
    if (!dateTime) {
      alert('Please select a date and time');
      return;
    }

    // Convert local datetime to UTC Date object
    const date = new Date(dateTime);
    onSave(date);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            Set Time for Match #{matchNumber}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="text-sm text-gray-500">
            <p>Set the exact date and time for this match.</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save
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
  );
}
