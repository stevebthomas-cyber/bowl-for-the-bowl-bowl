/**
 * ApplyToAllModal Component
 *
 * Confirmation modal shown after dropping a team onto a game slot.
 * Prompts user to apply the change to just this game or all games.
 */

interface ApplyToAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  oldTeamName: string | null;
  onApplyToOne: () => void;
  onApplyToAll: () => void;
  isEmptySlot: boolean;
}

export default function ApplyToAllModal({
  isOpen,
  onClose,
  teamName,
  oldTeamName,
  onApplyToOne,
  onApplyToAll,
  isEmptySlot,
}: ApplyToAllModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Apply to All Games?
        </h3>

        {isEmptySlot ? (
          <p className="text-gray-700 mb-6">
            Assign <span className="font-semibold">{teamName}</span> to this empty slot throughout the entire schedule?
          </p>
        ) : (
          <p className="text-gray-700 mb-6">
            Replace <span className="font-semibold">{oldTeamName}</span> with <span className="font-semibold">{teamName}</span> throughout the entire schedule?
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              onApplyToOne();
              onClose();
            }}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Just This Game
          </button>
          <button
            onClick={() => {
              onApplyToAll();
              onClose();
            }}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Replace All
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
