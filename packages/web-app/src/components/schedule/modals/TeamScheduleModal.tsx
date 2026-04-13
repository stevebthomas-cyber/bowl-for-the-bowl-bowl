/**
 * TeamScheduleModal Component
 *
 * Modal displayed when clicking on a team slot in the schedule.
 * Shows team information and their full schedule across all rounds.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';
import { formatDateTime } from '../../../utils/dateUtils';

interface TeamScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  leagueId: string;
  seasonNumber: number;
  onRemoveFromSchedule: () => void;
}

interface TeamInfo {
  id: string;
  name: string;
  race: string;
  tier: number;
  division: number | null;
  wins: number;
  losses: number;
  ties: number;
  league_points: number;
  team_value: number;
  team_ownership?: {
    owner?: {
      display_name: string;
    };
  }[];
}

interface TeamMatch {
  id: string;
  match_number: number;
  week_number: number;
  scheduled_date: string | null;
  home_team_id: string;
  away_team_id: string;
  venue?: { name: string };
  pitch?: { name: string };
  home_team?: { name: string };
  away_team?: { name: string };
  status: string;
}

export default function TeamScheduleModal({
  isOpen,
  onClose,
  teamId,
  leagueId,
  seasonNumber,
  onRemoveFromSchedule,
}: TeamScheduleModalProps) {
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && teamId) {
      loadTeamData();
    }
  }, [isOpen, teamId]);

  const loadTeamData = async () => {
    setIsLoading(true);
    try {
      // Load team information
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          race,
          tier,
          division,
          wins,
          losses,
          ties,
          league_points,
          team_value,
          team_ownership!team_ownership_team_id_fkey(
            owner:users!team_ownership_user_id_fkey(
              display_name
            )
          )
        `)
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;
      setTeamInfo(team);

      // Load all matches for this team
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          id,
          match_number,
          week_number,
          scheduled_date,
          home_team_id,
          away_team_id,
          status,
          home_team:teams!matches_home_team_id_fkey(name),
          away_team:teams!matches_away_team_id_fkey(name),
          venue:venues(name),
          pitch:pitches(name)
        `)
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order('week_number', { ascending: true })
        .order('match_number', { ascending: true });

      if (matchError) throw matchError;
      setMatches(matchData || []);
    } catch (err) {
      console.error('Error loading team data:', err);
      alert('Failed to load team information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    const confirmed = confirm(
      `Remove ${teamInfo?.name} from all games in this schedule?\n\nThis will clear them from all ${matches.length} assigned games.`
    );
    if (confirmed) {
      onRemoveFromSchedule();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Team Schedule</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading team information...</div>
          ) : teamInfo ? (
            <>
              {/* Team Information Card */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-4">
                  {/* Team Logo Placeholder */}
                  <div className="w-20 h-20 rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0 bg-white">
                    <span className="text-gray-400 text-2xl">?</span>
                  </div>

                  {/* Team Info */}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{teamInfo.name}</h3>
                    <div className="text-sm text-gray-600 mt-1">
                      {teamInfo.race} (Tier {teamInfo.tier})
                      {teamInfo.division && ` • Division ${teamInfo.division}`}
                    </div>
                    <div className="text-sm text-gray-600">
                      Coach: {Array.isArray(teamInfo.team_ownership) && teamInfo.team_ownership[0]?.owner?.display_name || 'Unknown'}
                    </div>

                    {/* Record */}
                    <div className="mt-3 flex gap-4 text-sm">
                      <div>
                        <span className="font-semibold">Record:</span>{' '}
                        <span className="text-gray-700">
                          {teamInfo.wins}W - {teamInfo.losses}L - {teamInfo.ties}T
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">Points:</span>{' '}
                        <span className="text-gray-700">{teamInfo.league_points}</span>
                      </div>
                      <div>
                        <span className="font-semibold">TV:</span>{' '}
                        <span className="text-gray-700">{teamInfo.team_value.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule List */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  Season Schedule ({matches.length} games)
                </h4>

                {matches.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    No games scheduled yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {matches.map((match) => {
                      const isHome = match.home_team_id === teamId;
                      const opponent = isHome ? match.away_team?.name : match.home_team?.name;
                      const opponentLabel = opponent || (isHome ? '[Away Team TBD]' : '[Home Team TBD]');
                      const venue = match.venue?.name || '[Venue TBD]';
                      const pitch = match.pitch?.name;
                      const venueDisplay = pitch ? `${venue} - ${pitch}` : venue;

                      return (
                        <div
                          key={match.id}
                          className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                Round {match.week_number} - Match {match.match_number}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {isHome ? (
                                  <>
                                    <span className="font-semibold">{teamInfo.name}</span> vs {opponentLabel}
                                  </>
                                ) : (
                                  <>
                                    {opponentLabel} vs <span className="font-semibold">{teamInfo.name}</span>
                                  </>
                                )}
                                {isHome ? ' (Home)' : ' (Away)'}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {venueDisplay}
                                {match.scheduled_date && (
                                  <> • {formatDateTime(match.scheduled_date)}</>
                                )}
                              </div>
                            </div>
                            <div className="ml-4">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  match.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : match.status === 'in_progress'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {match.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-red-600">Failed to load team information</div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={handleRemove}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Remove from Schedule
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
