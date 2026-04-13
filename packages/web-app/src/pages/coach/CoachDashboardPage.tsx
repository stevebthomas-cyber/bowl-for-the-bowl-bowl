import { useState, useEffect } from 'react';
import { useTeams } from '../../hooks/useTeam';
import { getNextGame, getUpcomingGames, getTeamStreak, setTeamReady, lockTeamRoster, getGameTeamInfo, updateMatchStatus } from '../../lib/game-queries';
import { calculateCurrentTeamValue } from '../../lib/team-calculations';
import CoachLayout from '../../components/layouts/CoachLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PreGameWizard from '../../components/game/PreGameWizard';
import PostGameWizard from '../../components/game/PostGameWizard';

export default function CoachDashboardPage() {
  const { teams, isLoading: teamsLoading } = useTeams();
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [nextGame, setNextGame] = useState<any>(null);
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);
  const [myTeamInfo, setMyTeamInfo] = useState<any>(null);
  const [opponentInfo, setOpponentInfo] = useState<any>(null);
  const [myCTV, setMyCTV] = useState(0);
  const [opponentCTV, setOpponentCTV] = useState(0);
  const [myStreak, setMyStreak] = useState<any>(null);
  const [opponentStreak, setOpponentStreak] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPreGame, setShowPreGame] = useState(false);
  const [showPostGame, setShowPostGame] = useState(false);

  const currentTeam = teams[selectedTeamIndex];

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentTeam) return;

      setLoading(true);
      try {
        // Fetch next game
        const game = await getNextGame(currentTeam.id);
        setNextGame(game);

        if (game) {
          // Fetch team info (opponent only visible if both locked)
          const gameTeamInfo = await getGameTeamInfo(game.id, currentTeam.id);
          setMyTeamInfo(gameTeamInfo.myTeam);
          setOpponentInfo(gameTeamInfo.opponentTeam);

          // Calculate CTVs
          const myCtv = await calculateCurrentTeamValue(currentTeam.id);
          setMyCTV(myCtv);

          if (gameTeamInfo.bothRostersLocked && gameTeamInfo.opponentTeam) {
            const oppTeamId = gameTeamInfo.isHome ? game.away_team_id : game.home_team_id;
            const oppCtv = await calculateCurrentTeamValue(oppTeamId);
            setOpponentCTV(oppCtv);

            // Get opponent streak
            const oppStreak = await getTeamStreak(oppTeamId);
            setOpponentStreak(oppStreak);
          }

          // Get my team's streak
          const streak = await getTeamStreak(currentTeam.id);
          setMyStreak(streak);
        }

        // Fetch upcoming games
        const upcoming = await getUpcomingGames(currentTeam.id, 3);
        setUpcomingGames(upcoming);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentTeam?.id]);

  const handleToggleReady = async () => {
    if (!nextGame || !currentTeam) return;

    const isHome = nextGame.home_team_id === currentTeam.id;
    const currentReady = isHome ? nextGame.home_ready : nextGame.away_ready;

    try {
      await setTeamReady(nextGame.id, currentTeam.id, !currentReady);
      // Refresh game data
      const updated = await getNextGame(currentTeam.id);
      setNextGame(updated);
    } catch (err) {
      console.error('Failed to toggle ready:', err);
    }
  };

  const handleLockRoster = async () => {
    if (!nextGame || !currentTeam) return;

    try {
      await lockTeamRoster(nextGame.id, currentTeam.id);
      // Refresh game data
      const updated = await getNextGame(currentTeam.id);
      setNextGame(updated);
    } catch (err) {
      console.error('Failed to lock roster:', err);
    }
  };

  const getMatchButtonState = () => {
    if (!nextGame || !currentTeam) return { text: 'No Match Scheduled', disabled: true };

    const isHome = nextGame.home_team_id === currentTeam.id;
    const myReady = isHome ? nextGame.home_ready : nextGame.away_ready;
    const myLocked = isHome ? nextGame.home_roster_locked : nextGame.away_roster_locked;
    const oppLocked = isHome ? nextGame.away_roster_locked : nextGame.home_roster_locked;

    // Check if match is completed
    if (nextGame.completed) {
      return { text: 'Match Completed', disabled: true };
    }

    // Check bounty status
    if (nextGame.bounty_status === 'active' || nextGame.bounty_status === 'claimed') {
      return { text: 'Game in Bounty', disabled: true, bounty: true };
    }

    // Match in progress - ready to record post-game
    if (nextGame.status === 'in_progress') {
      return { text: 'Record Post-Game Results', disabled: false, action: 'post-game' };
    }

    // Both locked - ready to initiate pre-game
    if (myLocked && oppLocked) {
      return { text: 'Initiate Pre-Game', disabled: false, action: 'pre-game' };
    }

    // My roster locked, waiting for opponent
    if (myLocked && !oppLocked) {
      return { text: 'Waiting for Opponent', disabled: true };
    }

    // Ready to lock roster
    if (myReady) {
      return { text: 'Submit Roster', disabled: false, action: 'lock-roster' };
    }

    // Not ready yet
    return { text: 'Mark as Ready', disabled: false, action: 'mark-ready' };
  };

  const formatStreak = (streak: any) => {
    if (!streak || !streak.type || streak.count === 0) return '';
    return `${streak.type}${streak.count}`;
  };

  if (teamsLoading || loading) return <LoadingSpinner />;

  if (!teams || teams.length === 0) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <p className="text-xl text-gray-600">You don't have a team yet!</p>
        </div>
      </CoachLayout>
    );
  }

  const buttonState = getMatchButtonState();
  const isHome = nextGame ? nextGame.home_team_id === currentTeam.id : false;
  const bothLocked = nextGame ? nextGame.home_roster_locked && nextGame.away_roster_locked : false;

  return (
    <CoachLayout>
      <div className="space-y-6">
        {/* Team Selector - show only if user has multiple teams */}
        {teams.length > 1 && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-2">
              {teams.map((team, index) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamIndex(index)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    index === selectedTeamIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Next Match Section */}
        {nextGame ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Next Match</h2>

            {/* Team Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* My Team */}
              <div className="bg-gray-800 rounded-lg p-6 text-white">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-32 h-32 rounded-full border-4 border-dashed border-gray-400 flex items-center justify-center">
                    <span className="text-sm text-gray-400">MY TEAM LOGO</span>
                  </div>
                </div>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold">{currentTeam.name}</h3>
                  <p className="text-sm text-gray-400">
                    [{currentTeam.wins || 0}] - [{currentTeam.losses || 0}] - [{currentTeam.ties || 0}]
                  </p>
                  <p className="text-sm text-gray-400">
                    {myStreak && formatStreak(myStreak) && `[${formatStreak(myStreak)}]`}
                  </p>
                </div>
              </div>

              {/* Opponent Team */}
              <div className="bg-gray-400 rounded-lg p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-32 h-32 rounded-full border-4 border-dashed border-gray-600 flex items-center justify-center">
                    <span className="text-sm text-gray-600">OPPONENT LOGO</span>
                  </div>
                </div>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">
                    {isHome ? nextGame.away_team?.name : nextGame.home_team?.name}
                  </h3>
                  {bothLocked && opponentInfo && (
                    <>
                      <p className="text-sm text-gray-700">
                        [{opponentInfo.wins || 0}] - [{opponentInfo.losses || 0}] - [{opponentInfo.ties || 0}]
                      </p>
                      <p className="text-sm text-gray-700">
                        {opponentStreak && formatStreak(opponentStreak) && `[${formatStreak(opponentStreak)}]`}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Match Details */}
            <div className="text-center mb-6">
              <p className="text-lg font-semibold text-gray-900">
                {new Date(nextGame.scheduled_date).toLocaleDateString()} at{' '}
                {new Date(nextGame.scheduled_date).toLocaleTimeString()}
              </p>
              {nextGame.location && (
                <p className="text-gray-600">{nextGame.location}</p>
              )}
            </div>

            {/* Team Info Panels */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* My Team Info */}
              <div className="border border-gray-300 rounded-lg p-4">
                <h4 className="text-lg font-bold text-gray-900 mb-4">{currentTeam.name}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{Math.round(currentTeam.treasury / 1000)}k</div>
                    <div className="text-sm text-gray-600">Treasury</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{Math.round(myCTV / 1000)}k</div>
                    <div className="text-sm text-gray-600">CTV</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{currentTeam.dedicated_fans || 0}</div>
                    <div className="text-sm text-gray-600">Fans</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{currentTeam.rerolls || 0}</div>
                    <div className="text-sm text-gray-600">Rerolls</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Assistant Coaches:</span>
                      <span className="font-semibold">{currentTeam.assistant_coaches || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cheerleaders:</span>
                      <span className="font-semibold">{currentTeam.cheerleaders || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Apothecary:</span>
                      <span className="font-semibold">{currentTeam.apothecary_hired ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Opponent Info (only if both locked) */}
              {bothLocked && opponentInfo ? (
                <div className="border border-gray-300 rounded-lg p-4">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">
                    {isHome ? nextGame.away_team?.name : nextGame.home_team?.name}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{Math.round(opponentInfo.treasury / 1000)}k</div>
                      <div className="text-sm text-gray-600">Treasury</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{Math.round(opponentCTV / 1000)}k</div>
                      <div className="text-sm text-gray-600">CTV</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{opponentInfo.dedicated_fans || 0}</div>
                      <div className="text-sm text-gray-600">Fans</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{opponentInfo.rerolls || 0}</div>
                      <div className="text-sm text-gray-600">Rerolls</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-700 space-y-1">
                      <div className="flex justify-between">
                        <span>Assistant Coaches:</span>
                        <span className="font-semibold">{opponentInfo.assistant_coaches || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cheerleaders:</span>
                        <span className="font-semibold">{opponentInfo.cheerleaders || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Apothecary:</span>
                        <span className="font-semibold">{opponentInfo.apothecary_hired ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg p-4 flex items-center justify-center">
                  <p className="text-gray-500 text-center">
                    Opponent information will be visible once both rosters are locked
                  </p>
                </div>
              )}
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                if (buttonState.action === 'mark-ready') handleToggleReady();
                else if (buttonState.action === 'lock-roster') handleLockRoster();
                else if (buttonState.action === 'pre-game') setShowPreGame(true);
                else if (buttonState.action === 'post-game') setShowPostGame(true);
              }}
              disabled={buttonState.disabled}
              className={`w-full py-3 px-4 rounded-lg font-bold text-white text-lg transition-colors ${
                buttonState.disabled
                  ? 'bg-gray-400 cursor-not-allowed'
                  : buttonState.bounty
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {buttonState.text}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-xl text-gray-600">
              Waiting for next season? Nudge the commissioner! But like be polite. Or don't. I am a website, not a cop.
            </p>
          </div>
        )}

        {/* Upcoming Matches */}
        {upcomingGames.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Upcoming Matches</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {upcomingGames.map((game) => {
                const isHomeTeam = game.home_team_id === currentTeam.id;
                const myReady = isHomeTeam ? game.home_ready : game.away_ready;
                const oppReady = isHomeTeam ? game.away_ready : game.home_ready;

                return (
                  <div key={game.id} className="bg-gray-800 rounded-lg p-4 text-white">
                    <div className="flex justify-between mb-3">
                      <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center text-xs text-center">
                        HOME TEAM
                      </div>
                      <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center text-xs text-center">
                        AWAY TEAM
                      </div>
                    </div>
                    <div className="text-center text-sm space-y-1">
                      <p className="font-semibold">
                        [{game.home_team?.wins || 0}]-[{game.home_team?.losses || 0}]-[{game.home_team?.ties || 0}] vs{' '}
                        [{game.away_team?.wins || 0}]-[{game.away_team?.losses || 0}]-[{game.away_team?.ties || 0}]
                      </p>
                      <p className="text-xs text-gray-400">
                        {game.home_team?.name} vs {game.away_team?.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(game.scheduled_date).toLocaleDateString()}
                      </p>
                      {game.location && (
                        <p className="text-xs text-gray-400">{game.location}</p>
                      )}
                      <div className="flex justify-center gap-2 mt-2">
                        <span className={myReady ? 'text-green-400' : 'text-red-400'}>
                          {myReady ? '✓' : '✗'} You
                        </span>
                        <span className={oppReady ? 'text-green-400' : 'text-red-400'}>
                          {oppReady ? '✓' : '✗'} Opp
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pre-Game Wizard Overlay */}
      {showPreGame && nextGame && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-start justify-center overflow-y-auto py-8">
          <PreGameWizard
            gameId={nextGame.id}
            homeTeamId={nextGame.home_team_id}
            awayTeamId={nextGame.away_team_id}
            gameType={nextGame.match_type === 'friendly' ? 'friendly' : 'fixture'}
            onComplete={async () => {
              await updateMatchStatus(nextGame.id, 'in_progress');
              setShowPreGame(false);
              const updated = await getNextGame(currentTeam.id);
              setNextGame(updated);
            }}
            onCancel={() => setShowPreGame(false)}
          />
        </div>
      )}

      {/* Post-Game Wizard Overlay */}
      {showPostGame && nextGame && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-start justify-center overflow-y-auto py-8">
          <PostGameWizard
            gameId={nextGame.id}
            homeTeamId={nextGame.home_team_id}
            awayTeamId={nextGame.away_team_id}
            gameType={nextGame.match_type === 'friendly' ? 'friendly' : 'fixture'}
            onComplete={async () => {
              setShowPostGame(false);
              const updated = await getNextGame(currentTeam.id);
              setNextGame(updated);
            }}
            onCancel={() => setShowPostGame(false)}
          />
        </div>
      )}
    </CoachLayout>
  );
}
