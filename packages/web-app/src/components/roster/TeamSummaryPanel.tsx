/**
 * Team Summary Panel
 * Displays team finances, roster status, and team value calculations
 */

import { useState, useEffect } from 'react';
import {
  calculateRosterValue,
  calculateStaffValue,
  calculateTotalTeamValue,
  calculateCurrentTeamValue
} from '../../lib/team-calculations';
import LoadingSpinner from '../common/LoadingSpinner';

interface TeamSummaryPanelProps {
  team: {
    id: string;
    name: string;
    race: string;
    treasury: number;
    dedicated_fans: number;
    rerolls: number;
    assistant_coaches: number;
    cheerleaders: number;
    apothecary_hired: boolean;
  };
  playerCount: number;
  availablePlayerCount: number;
}

export default function TeamSummaryPanel({ team, playerCount, availablePlayerCount }: TeamSummaryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [rosterValue, setRosterValue] = useState(0);
  const [staffValue, setStaffValue] = useState(0);
  const [totalTV, setTotalTV] = useState(0);
  const [currentTV, setCurrentTV] = useState(0);

  useEffect(() => {
    loadTeamValues();
  }, [team.id]);

  const loadTeamValues = async () => {
    setLoading(true);
    try {
      const [roster, staff, total, current] = await Promise.all([
        calculateRosterValue(team.id),
        calculateStaffValue(team.id),
        calculateTotalTeamValue(team.id),
        calculateCurrentTeamValue(team.id)
      ]);

      setRosterValue(roster);
      setStaffValue(staff);
      setTotalTV(total);
      setCurrentTV(current);
    } catch (error) {
      console.error('Failed to load team values:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
      <div className="grid grid-cols-4 gap-6">
        {/* Financial Summary */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-90">
            Finances
          </h3>
          <div className="space-y-2">
            <div>
              <div className="text-xs opacity-75">Treasury</div>
              <div className="text-2xl font-bold">
                {(team.treasury / 1000).toFixed(0)}k
              </div>
            </div>
            <div>
              <div className="text-xs opacity-75">Dedicated Fans</div>
              <div className="text-xl font-semibold">{team.dedicated_fans}</div>
            </div>
          </div>
        </div>

        {/* Team Value */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-90">
            Team Value
          </h3>
          <div className="space-y-2">
            <div>
              <div className="text-xs opacity-75">Total TV</div>
              <div className="text-2xl font-bold">
                {(totalTV / 1000).toFixed(0)}k
              </div>
            </div>
            <div>
              <div className="text-xs opacity-75">Current TV (Available)</div>
              <div className="text-xl font-semibold text-green-200">
                {(currentTV / 1000).toFixed(0)}k
              </div>
            </div>
          </div>
        </div>

        {/* Value Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-90">
            Value Breakdown
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="opacity-75">Roster:</span>
              <span className="font-semibold">{(rosterValue / 1000).toFixed(0)}k</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Staff:</span>
              <span className="font-semibold">{(staffValue / 1000).toFixed(0)}k</span>
            </div>
            <div className="flex justify-between border-t border-blue-400 pt-1 mt-1">
              <span className="opacity-75">Unavailable:</span>
              <span className="font-semibold text-red-200">
                {((totalTV - currentTV) / 1000).toFixed(0)}k
              </span>
            </div>
          </div>
        </div>

        {/* Roster & Staff */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-90">
            Roster & Staff
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="opacity-75">Players:</span>
              <span className="font-semibold">
                {availablePlayerCount}/{playerCount}
                {playerCount < 11 && (
                  <span className="text-yellow-300 ml-1">⚠️</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Team Rerolls:</span>
              <span className="font-semibold">{team.rerolls}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Coaches:</span>
              <span className="font-semibold">{team.assistant_coaches}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Cheerleaders:</span>
              <span className="font-semibold">{team.cheerleaders}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Apothecary:</span>
              <span className="font-semibold">{team.apothecary_hired ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {(playerCount < 11 || availablePlayerCount < 11) && (
        <div className="mt-4 bg-yellow-500 bg-opacity-20 border border-yellow-300 rounded p-3">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <div className="text-sm">
              {playerCount < 11 ? (
                <p>Your roster has fewer than 11 players. You'll need journeymen to play.</p>
              ) : (
                <p>
                  You have {11 - availablePlayerCount} unavailable player(s).
                  You'll need {11 - availablePlayerCount} journeymen for your next game.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
