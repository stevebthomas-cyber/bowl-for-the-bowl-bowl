/**
 * Pre-Game Wizard Component
 * Step-by-step wizard for pre-game setup
 */

import { useState, useEffect } from 'react';
import {
  checkPreGameEligibility,
  autoHireJourneymen,
  calculatePettyCash,
  getAvailableInducements,
  getAvailableStarPlayers,
  capturePreGameSnapshot
} from '../../lib/game-workflows';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';

interface PreGameWizardProps {
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  gameType: 'friendly' | 'fixture';
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = 'eligibility' | 'journeymen' | 'inducements' | 'confirm';

export default function PreGameWizard({
  gameId,
  homeTeamId,
  awayTeamId,
  gameType,
  onComplete,
  onCancel
}: PreGameWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('eligibility');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [homeEligibility, setHomeEligibility] = useState<any>(null);
  const [awayEligibility, setAwayEligibility] = useState<any>(null);
  const [pettyCash, setPettyCash] = useState<any>(null);
  const [homeInducements, setHomeInducements] = useState<any[]>([]);
  const [awayInducements, setAwayInducements] = useState<any[]>([]);
  const [homeStarPlayers, setHomeStarPlayers] = useState<any[]>([]);
  const [awayStarPlayers, setAwayStarPlayers] = useState<any[]>([]);

  // Selection state
  const [selectedHomeLinemanPosition, setSelectedHomeLinemanPosition] = useState<string | null>(null);
  const [selectedAwayLinemanPosition, setSelectedAwayLinemanPosition] = useState<string | null>(null);
  const [homeInducementsPurchased, setHomeInducementsPurchased] = useState<any[]>([]);
  const [awayInducementsPurchased, setAwayInducementsPurchased] = useState<any[]>([]);

  useEffect(() => {
    loadPreGameData();
  }, []);

  const loadPreGameData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check eligibility
      const [homeElig, awayElig, petty] = await Promise.all([
        checkPreGameEligibility(homeTeamId),
        checkPreGameEligibility(awayTeamId),
        calculatePettyCash(homeTeamId, awayTeamId)
      ]);

      setHomeEligibility(homeElig);
      setAwayEligibility(awayElig);
      setPettyCash(petty);

      // Load inducements and star players
      const [homeInd, awayInd, homeSP, awaySP] = await Promise.all([
        getAvailableInducements(homeTeamId),
        getAvailableInducements(awayTeamId),
        getAvailableStarPlayers(homeTeamId),
        getAvailableStarPlayers(awayTeamId)
      ]);

      setHomeInducements(homeInd);
      setAwayInducements(awayInd);
      setHomeStarPlayers(homeSP);
      setAwayStarPlayers(awaySP);

      // If friendly, capture snapshots
      if (gameType === 'friendly') {
        await Promise.all([
          capturePreGameSnapshot(gameId, homeTeamId),
          capturePreGameSnapshot(gameId, awayTeamId)
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pre-game data');
    } finally {
      setLoading(false);
    }
  };

  const handleHireJourneymen = async (teamId: string, positionId?: string) => {
    try {
      setLoading(true);
      await autoHireJourneymen(teamId, positionId);
      await loadPreGameData(); // Reload to update counts
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to hire journeymen');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  if (loading && !homeEligibility) {
    return (
      <div className="p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ErrorMessage message={error} />
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Pre-Game Setup {gameType === 'friendly' && '(Friendly)'}
        </h2>
        <div className="flex gap-2">
          {['eligibility', 'journeymen', 'inducements', 'confirm'].map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded ${
                currentStep === step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step: Eligibility Check */}
      {currentStep === 'eligibility' && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4">Team Eligibility</h3>

          <div className="grid grid-cols-2 gap-6">
            {/* Home Team */}
            <div className="border rounded-lg p-4">
              <h4 className="font-bold text-lg mb-3">Home Team</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Available Players:</span>
                  <span className="font-semibold">{homeEligibility?.availablePlayers || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Team Value:</span>
                  <span className="font-semibold">
                    {((homeEligibility?.currentTeamValue || 0) / 1000).toFixed(0)}k
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Journeymen Needed:</span>
                  <span className={`font-semibold ${
                    (homeEligibility?.journeymenNeeded || 0) > 0 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {homeEligibility?.journeymenNeeded || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Away Team */}
            <div className="border rounded-lg p-4">
              <h4 className="font-bold text-lg mb-3">Away Team</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Available Players:</span>
                  <span className="font-semibold">{awayEligibility?.availablePlayers || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Team Value:</span>
                  <span className="font-semibold">
                    {((awayEligibility?.currentTeamValue || 0) / 1000).toFixed(0)}k
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Journeymen Needed:</span>
                  <span className={`font-semibold ${
                    (awayEligibility?.journeymenNeeded || 0) > 0 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {awayEligibility?.journeymenNeeded || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Petty Cash */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-bold text-lg mb-3">Petty Cash</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-700">Home Team:</span>
                <span className="ml-2 font-bold text-blue-600">
                  {((pettyCash?.homePettyCash || 0) / 1000).toFixed(0)}k
                </span>
              </div>
              <div>
                <span className="text-gray-700">Away Team:</span>
                <span className="ml-2 font-bold text-blue-600">
                  {((pettyCash?.awayPettyCash || 0) / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => setCurrentStep('journeymen')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next: Journeymen
            </button>
          </div>
        </div>
      )}

      {/* Step: Journeymen Hiring */}
      {currentStep === 'journeymen' && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4">Hire Journeymen</h3>

          {(homeEligibility?.journeymenNeeded || 0) === 0 &&
           (awayEligibility?.journeymenNeeded || 0) === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800">Both teams have 11 players. No journeymen needed!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* Home Team Journeymen */}
              {(homeEligibility?.journeymenNeeded || 0) > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-bold text-lg mb-3">
                    Home Team ({homeEligibility.journeymenNeeded} needed)
                  </h4>
                  {homeEligibility.requiresJourneymanChoice ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Select lineman type:</p>
                      <div className="space-y-2">
                        {homeEligibility.linemanOptions?.map((option: any) => (
                          <button
                            key={option.id}
                            onClick={() => setSelectedHomeLinemanPosition(option.id)}
                            className={`w-full p-2 border rounded text-left ${
                              selectedHomeLinemanPosition === option.id
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            {option.position_name} ({(option.cost / 1000).toFixed(0)}k)
                          </button>
                        ))}
                      </div>
                      {selectedHomeLinemanPosition && (
                        <button
                          onClick={() => handleHireJourneymen(homeTeamId, selectedHomeLinemanPosition)}
                          className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Hire Journeymen
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleHireJourneymen(homeTeamId)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Auto-Hire Journeymen
                    </button>
                  )}
                </div>
              )}

              {/* Away Team Journeymen */}
              {(awayEligibility?.journeymenNeeded || 0) > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-bold text-lg mb-3">
                    Away Team ({awayEligibility.journeymenNeeded} needed)
                  </h4>
                  {awayEligibility.requiresJourneymanChoice ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Select lineman type:</p>
                      <div className="space-y-2">
                        {awayEligibility.linemanOptions?.map((option: any) => (
                          <button
                            key={option.id}
                            onClick={() => setSelectedAwayLinemanPosition(option.id)}
                            className={`w-full p-2 border rounded text-left ${
                              selectedAwayLinemanPosition === option.id
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            {option.position_name} ({(option.cost / 1000).toFixed(0)}k)
                          </button>
                        ))}
                      </div>
                      {selectedAwayLinemanPosition && (
                        <button
                          onClick={() => handleHireJourneymen(awayTeamId, selectedAwayLinemanPosition)}
                          className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Hire Journeymen
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleHireJourneymen(awayTeamId)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Auto-Hire Journeymen
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between gap-2 mt-6">
            <button
              onClick={() => setCurrentStep('eligibility')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentStep('inducements')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next: Inducements
            </button>
          </div>
        </div>
      )}

      {/* Step: Inducements (simplified for now) */}
      {currentStep === 'inducements' && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4">Purchase Inducements</h3>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-gray-700">
              Inducement purchasing UI coming soon. For now, proceed to complete setup.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Available: {homeInducements.length} inducements, {homeStarPlayers.length} star players (home)
            </p>
          </div>

          <div className="flex justify-between gap-2 mt-6">
            <button
              onClick={() => setCurrentStep('journeymen')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentStep('confirm')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next: Confirm
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {currentStep === 'confirm' && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4">Ready to Play!</h3>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-semibold mb-2">Pre-game setup complete!</p>
            <ul className="text-sm text-green-700 space-y-1">
              <li>✓ Team eligibility verified</li>
              <li>✓ Journeymen hired (if needed)</li>
              {gameType === 'friendly' && <li>✓ Game snapshot captured</li>}
            </ul>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
            >
              Start Game!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
