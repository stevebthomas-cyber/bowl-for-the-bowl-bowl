/**
 * Player Advancement Modal
 * Interface for spending SPP on skills and characteristic improvements
 */

import { useState, useEffect } from 'react';
import {
  getPlayerAdvancementInfo,
  rollRandomSkill,
  rollCharacteristicImprovement,
  applySkillAdvancement,
  applyCharacteristicImprovement
} from '../../lib/game-workflows';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

interface PlayerAdvancementModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  primarySkills: string[];
  secondarySkills: string[];
  onAdvancementComplete: () => void;
}

export default function PlayerAdvancementModal({
  isOpen,
  onClose,
  playerId,
  playerName,
  primarySkills,
  secondarySkills,
  onAdvancementComplete
}: PlayerAdvancementModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancementInfo, setAdvancementInfo] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<'primary' | 'secondary' | 'characteristic' | null>(null);
  const [rolledSkill, setRolledSkill] = useState<string | null>(null);
  const [rolledCharacteristic, setRolledCharacteristic] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadAdvancementInfo();
    }
  }, [isOpen, playerId]);

  const loadAdvancementInfo = async () => {
    setLoading(true);
    setError(null);
    setSelectedOption(null);
    setRolledSkill(null);
    setRolledCharacteristic(null);

    try {
      const info = await getPlayerAdvancementInfo(playerId);
      setAdvancementInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load advancement info');
    } finally {
      setLoading(false);
    }
  };

  const handleRollPrimarySkill = async () => {
    setLoading(true);
    setError(null);
    try {
      const skill = await rollRandomSkill('Primary');
      setRolledSkill(skill);
      setSelectedOption('primary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to roll skill');
    } finally {
      setLoading(false);
    }
  };

  const handleRollSecondarySkill = async () => {
    setLoading(true);
    setError(null);
    try {
      const skill = await rollRandomSkill('Secondary');
      setRolledSkill(skill);
      setSelectedOption('secondary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to roll skill');
    } finally {
      setLoading(false);
    }
  };

  const handleRollCharacteristic = async () => {
    setLoading(true);
    setError(null);
    try {
      const characteristic = await rollCharacteristicImprovement();
      setRolledCharacteristic(characteristic);
      setSelectedOption('characteristic');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to roll characteristic');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAdvancement = async () => {
    if (!selectedOption) return;

    setLoading(true);
    setError(null);

    try {
      if (selectedOption === 'primary' && rolledSkill) {
        await applySkillAdvancement(playerId, rolledSkill, advancementInfo.primaryCost);
      } else if (selectedOption === 'secondary' && rolledSkill) {
        await applySkillAdvancement(playerId, rolledSkill, advancementInfo.secondaryCost);
      } else if (selectedOption === 'characteristic' && rolledCharacteristic) {
        await applyCharacteristicImprovement(
          playerId,
          rolledCharacteristic.type,
          rolledCharacteristic.value,
          advancementInfo.characteristicCost
        );
      }

      onAdvancementComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply advancement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Player Advancement</h2>
            <p className="text-gray-600">{playerName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {error && <ErrorMessage message={error} />}

        {loading && !advancementInfo ? (
          <LoadingSpinner />
        ) : advancementInfo && (
          <div className="space-y-6">
            {/* SPP Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-600">Total SPP</div>
                  <div className="text-2xl font-bold text-blue-600">{advancementInfo.currentSPP}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Spent</div>
                  <div className="text-2xl font-bold text-gray-600">{advancementInfo.spentSPP}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Unspent</div>
                  <div className="text-2xl font-bold text-green-600">{advancementInfo.unspentSPP}</div>
                </div>
              </div>
              <div className="mt-3 text-center">
                <span className="text-sm text-gray-600">Level: </span>
                <span className="font-bold text-gray-900">{advancementInfo.playerLevel}</span>
              </div>
            </div>

            {/* Advancement Options */}
            {!rolledSkill && !rolledCharacteristic && (
              <div className="space-y-3">
                <h3 className="font-bold text-lg">Choose Advancement Type</h3>

                {/* Primary Skill */}
                <button
                  onClick={handleRollPrimarySkill}
                  disabled={advancementInfo.unspentSPP < advancementInfo.primaryCost || loading}
                  className="w-full p-4 border-2 rounded-lg hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <div className="font-bold text-lg">Primary Skill (Random)</div>
                      <div className="text-sm text-gray-600">Roll 2D6 for a primary skill</div>
                      <div className="text-xs text-gray-500 mt-1">
                        From: {primarySkills.slice(0, 3).join(', ')}
                        {primarySkills.length > 3 && `... (+${primarySkills.length - 3} more)`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {advancementInfo.primaryCost} SPP
                      </div>
                    </div>
                  </div>
                </button>

                {/* Secondary Skill */}
                <button
                  onClick={handleRollSecondarySkill}
                  disabled={advancementInfo.unspentSPP < advancementInfo.secondaryCost || loading}
                  className="w-full p-4 border-2 rounded-lg hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <div className="font-bold text-lg">Secondary Skill (Random)</div>
                      <div className="text-sm text-gray-600">Roll 2D6 for a secondary skill</div>
                      <div className="text-xs text-gray-500 mt-1">
                        From: {secondarySkills.slice(0, 3).join(', ')}
                        {secondarySkills.length > 3 && `... (+${secondarySkills.length - 3} more)`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">
                        {advancementInfo.secondaryCost} SPP
                      </div>
                    </div>
                  </div>
                </button>

                {/* Characteristic Improvement */}
                <button
                  onClick={handleRollCharacteristic}
                  disabled={advancementInfo.unspentSPP < advancementInfo.characteristicCost || loading}
                  className="w-full p-4 border-2 rounded-lg hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <div className="font-bold text-lg">Characteristic Improvement</div>
                      <div className="text-sm text-gray-600">Roll D8 for stat increase</div>
                      <div className="text-xs text-gray-500 mt-1">
                        MA, ST, AG, PA, or AV improvement
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600">
                        {advancementInfo.characteristicCost} SPP
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Show Rolled Result */}
            {(rolledSkill || rolledCharacteristic) && (
              <div className="space-y-4">
                <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 text-center">
                  <div className="text-sm text-gray-600 mb-2">You Rolled:</div>
                  <div className="text-3xl font-bold text-green-700 mb-2">
                    {rolledSkill || rolledCharacteristic?.type}
                  </div>
                  {rolledCharacteristic && (
                    <div className="text-sm text-gray-600">
                      {rolledCharacteristic.value > 0 ? '+' : ''}{rolledCharacteristic.value}
                      {' '}to {rolledCharacteristic.type}
                    </div>
                  )}
                  <div className="mt-4">
                    <div className="text-sm text-gray-600">Cost:</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {selectedOption === 'primary' && `${advancementInfo.primaryCost} SPP`}
                      {selectedOption === 'secondary' && `${advancementInfo.secondaryCost} SPP`}
                      {selectedOption === 'characteristic' && `${advancementInfo.characteristicCost} SPP`}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setRolledSkill(null);
                      setRolledCharacteristic(null);
                      setSelectedOption(null);
                    }}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                  >
                    Cancel / Re-roll
                  </button>
                  <button
                    onClick={handleApplyAdvancement}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold disabled:opacity-50"
                  >
                    {loading ? 'Applying...' : 'Apply Advancement'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
