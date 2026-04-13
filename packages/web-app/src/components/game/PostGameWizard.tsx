/**
 * Post-Game Wizard Component
 * Step-by-step wizard for post-game processing including injuries
 */

import { useState, useEffect } from 'react';
import {
  completePostGameWorkflow,
  rollAndApplyCasualty,
  applyManualCasualty,
  addHatredTrait,
  getPlayerAdvancementInfo
} from '../../lib/game-workflows';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

interface PostGameWizardProps {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  gameType: 'friendly' | 'fixture';
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = 'results' | 'injuries' | 'advancement' | 'summary';

export default function PostGameWizard({
  gameId,
  homeTeamId,
  awayTeamId,
  gameType,
  onComplete,
  onCancel
}: PostGameWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('results');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Game results
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [homeStalling, setHomeStalling] = useState(false);
  const [awayStalling, setAwayStalling] = useState(false);

  // Casualties
  const [casualties, setCasualties] = useState<Array<{
    playerId: string;
    playerName: string;
    teamId: string;
    d16Roll?: number;
    d6Roll?: number;
    result?: any;
    hatredTarget?: string;
  }>>([]);
  const [currentCasualtyIndex, setCurrentCasualtyIndex] = useState(0);

  // Post-game summary
  const [summary, setSummary] = useState<any>(null);

  const handleRecordResults = () => {
    if (casualties.length > 0) {
      setCurrentStep('injuries');
    } else {
      processPostGame();
    }
  };

  const handleRollCasualty = async () => {
    const casualty = casualties[currentCasualtyIndex];
    setLoading(true);
    setError(null);

    try {
      const result = await rollAndApplyCasualty(casualty.playerId, gameId);

      const updated = [...casualties];
      updated[currentCasualtyIndex] = {
        ...casualty,
        d16Roll: result.d16Roll,
        d6Roll: result.d6Roll,
        result: result.injuryResult
      };
      setCasualties(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to roll casualty');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCasualty = async (d16: number, d6?: number) => {
    const casualty = casualties[currentCasualtyIndex];
    setLoading(true);
    setError(null);

    try {
      const result = await applyManualCasualty(casualty.playerId, d16, d6);

      const updated = [...casualties];
      updated[currentCasualtyIndex] = {
        ...casualty,
        d16Roll: d16,
        d6Roll: d6,
        result: result.injuryResult
      };
      setCasualties(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply casualty');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHatred = async () => {
    const casualty = casualties[currentCasualtyIndex];
    if (!casualty.hatredTarget) {
      setError('Please specify what the player hates');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await addHatredTrait(casualty.playerId, casualty.hatredTarget);

      // Move to next casualty or finish
      if (currentCasualtyIndex < casualties.length - 1) {
        setCurrentCasualtyIndex(currentCasualtyIndex + 1);
      } else {
        processPostGame();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add hatred trait');
    } finally {
      setLoading(false);
    }
  };

  const processPostGame = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await completePostGameWorkflow(gameId, {
        homeScore,
        awayScore,
        homeStalling,
        awayStalling,
        casualties: casualties.map(c => ({
          playerId: c.playerId,
          manualRoll: c.d16Roll ? { d16: c.d16Roll, d6: c.d6Roll } : undefined
        }))
      });

      setSummary(result);
      setCurrentStep('summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process post-game');
    } finally {
      setLoading(false);
    }
  };

  const currentCasualty = casualties[currentCasualtyIndex];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Post-Game Processing {gameType === 'friendly' && '(Friendly)'}
        </h2>
        <div className="flex gap-2">
          {['results', 'injuries', 'advancement', 'summary'].map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded ${
                currentStep === step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Step: Game Results */}
      {currentStep === 'results' && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4">Game Results</h3>

          <div className="grid grid-cols-2 gap-6">
            <div className="border rounded-lg p-4">
              <h4 className="font-bold text-lg mb-3">Home Team</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Touchdowns
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={homeScore}
                    onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={homeStalling}
                    onChange={(e) => setHomeStalling(e.target.checked)}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">
                    Opponent was stalling
                  </label>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h4 className="font-bold text-lg mb-3">Away Team</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Touchdowns
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={awayScore}
                    onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={awayStalling}
                    onChange={(e) => setAwayStalling(e.target.checked)}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">
                    Opponent was stalling
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Casualties Input */}
          <div className="border rounded-lg p-4 mt-4">
            <h4 className="font-bold text-lg mb-3">Casualties</h4>
            <p className="text-sm text-gray-600 mb-2">
              Add players who suffered casualties during the game:
            </p>
            <button
              onClick={() => {/* TODO: Add player selector modal */}}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Add Casualty
            </button>
            {casualties.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-700">{casualties.length} casualties recorded</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleRecordResults}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {casualties.length > 0 ? 'Next: Process Injuries' : 'Complete'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Injury Processing */}
      {currentStep === 'injuries' && currentCasualty && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4">
            Injury Roll ({currentCasualtyIndex + 1} of {casualties.length})
          </h3>

          <div className="border rounded-lg p-6 bg-gray-50">
            <div className="text-center mb-4">
              <h4 className="text-2xl font-bold text-gray-900">{currentCasualty.playerName}</h4>
            </div>

            {!currentCasualty.result ? (
              <div className="space-y-4">
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleRollCasualty}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
                  >
                    🎲 Roll D16 (Auto)
                  </button>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-2 text-center">Or enter manual roll:</p>
                  <div className="flex gap-4 justify-center">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">D16 Result</label>
                      <input
                        type="number"
                        min="1"
                        max="16"
                        placeholder="1-16"
                        className="w-20 px-2 py-1 border rounded text-center"
                        id="manual-d16"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">D6 (if 13-14)</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        placeholder="1-6"
                        className="w-20 px-2 py-1 border rounded text-center"
                        id="manual-d6"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const d16 = parseInt((document.getElementById('manual-d16') as HTMLInputElement).value);
                        const d6 = parseInt((document.getElementById('manual-d6') as HTMLInputElement).value);
                        if (d16 >= 1 && d16 <= 16) {
                          handleManualCasualty(d16, d6 || undefined);
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-gray-600">Roll Result:</span>
                    <span className="font-bold text-lg">
                      D16: {currentCasualty.d16Roll}
                      {currentCasualty.d6Roll && `, D6: ${currentCasualty.d6Roll}`}
                    </span>
                  </div>
                  <div className={`p-3 rounded text-center font-bold text-lg ${
                    currentCasualty.result.type === 'dead' ? 'bg-black text-white' :
                    currentCasualty.result.type === 'characteristic_reduction' ? 'bg-red-100 text-red-800' :
                    currentCasualty.result.type === 'niggling_injury' ? 'bg-orange-100 text-orange-800' :
                    currentCasualty.result.type === 'miss_next_game' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {currentCasualty.result.description}
                  </div>
                </div>

                {currentCasualty.result.type !== 'none' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="font-semibold text-purple-900 mb-2">
                      Player gains Hatred trait!
                    </p>
                    <label className="block text-sm text-gray-700 mb-1">
                      What does this player hate?
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Orcs, Empire of Man, etc."
                      value={currentCasualty.hatredTarget || ''}
                      onChange={(e) => {
                        const updated = [...casualties];
                        updated[currentCasualtyIndex].hatredTarget = e.target.value;
                        setCasualties(updated);
                      }}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleAddHatred}
                    disabled={loading || (currentCasualty.result.type !== 'none' && !currentCasualty.hatredTarget)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {currentCasualtyIndex < casualties.length - 1 ? 'Next Casualty' : 'Complete Injuries'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {loading && <LoadingSpinner />}
        </div>
      )}

      {/* Step: Summary */}
      {currentStep === 'summary' && summary && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4">Post-Game Summary</h3>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-bold text-lg mb-3">Game Complete!</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Result:</p>
                <p className="font-bold text-lg">{summary.gameResult.replace('_', ' ').toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Score:</p>
                <p className="font-bold text-lg">{homeScore} - {awayScore}</p>
              </div>
            </div>
          </div>

          {gameType === 'fixture' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h5 className="font-bold mb-2">Home Team</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Winnings:</span>
                      <span className="font-semibold">{(summary.homeWinnings / 1000).toFixed(0)}k</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dedicated Fans:</span>
                      <span className="font-semibold">{summary.homeFans}</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h5 className="font-bold mb-2">Away Team</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Winnings:</span>
                      <span className="font-semibold">{(summary.awayWinnings / 1000).toFixed(0)}k</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dedicated Fans:</span>
                      <span className="font-semibold">{summary.awayFans}</span>
                    </div>
                  </div>
                </div>
              </div>

              {summary.casualtyResults && summary.casualtyResults.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h5 className="font-bold mb-2">Casualties</h5>
                  <div className="space-y-2">
                    {summary.casualtyResults.map((cas: any, idx: number) => (
                      <div key={idx} className="text-sm">
                        <span className="font-semibold">{cas.playerName}:</span>{' '}
                        <span className="text-gray-700">{cas.injuryResult.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {gameType === 'friendly' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">
                Friendly game complete. All changes have been reverted to pre-game state.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
