import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLeague } from '../../hooks/useLeague';
import { getAllRosterTemplates, getRosterPositions } from '../../lib/roster-queries';
import { supabase } from '../../config/supabase';
import {
  RosterTemplate,
  RosterPosition,
  TeamCreationState,
  STAFF_COSTS,
  STAFF_LIMITS,
} from '../../types/roster';
import CoachLayout from '../../components/layouts/CoachLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function CreateTeamPage() {
  const { user, isCommissioner } = useAuth();
  const { league, isLoading: leagueLoading } = useLeague();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = (location.state as { returnPath?: string })?.returnPath;

  const [step, setStep] = useState(1);
  const [rosters, setRosters] = useState<RosterTemplate[]>([]);
  const [positions, setPositions] = useState<RosterPosition[]>([]);
  const [specialRulesLeagues, setSpecialRulesLeagues] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownershipOption, setOwnershipOption] = useState<'self' | 'none' | 'other'>('self');
  const [targetOwnerDiscordId, setTargetOwnerDiscordId] = useState('');

  const [state, setState] = useState<TeamCreationState>({
    selectedRoster: null,
    teamName: '',
    selectedPlayers: [],
    rerolls: 0,
    apothecary: false,
    assistantCoaches: 0,
    cheerleaders: 0,
    dedicatedFans: 0,
    startingTreasury: 1000000,
    spentOnPlayers: 0,
    spentOnRerolls: 0,
    spentOnStaff: 0,
    remainingTreasury: 1000000,
  });

  useEffect(() => {
    async function loadData() {
      try {
        // Load rosters
        const rosterData = await getAllRosterTemplates();
        setRosters(rosterData);

        // Load special rules leagues
        const { data: leaguesData, error: leaguesError } = await supabase
          .from('special_rules_leagues')
          .select('id, name')
          .order('name');

        if (leaguesError) throw leaguesError;
        setSpecialRulesLeagues(leaguesData || []);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load team rosters and leagues');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (league?.starting_treasury) {
      setState(prev => ({
        ...prev,
        startingTreasury: league.starting_treasury,
        remainingTreasury: league.starting_treasury,
      }));
    }
  }, [league]);

  useEffect(() => {
    // Recalculate treasury
    const playerCost = state.selectedPlayers.reduce((sum, sp) => {
      const position = positions.find(p => p.id === sp.positionId);
      return sum + (position ? position.cost * sp.quantity : 0);
    }, 0);

    const rerollCost = state.selectedRoster
      ? state.rerolls * state.selectedRoster.reroll_cost
      : 0;

    const apothecaryCost = state.apothecary ? STAFF_COSTS.APOTHECARY : 0;
    const coachCost = state.assistantCoaches * STAFF_COSTS.ASSISTANT_COACH;
    const cheerleaderCost = state.cheerleaders * STAFF_COSTS.CHEERLEADER;
    // First dedicated fan is free
    const fanCost = state.dedicatedFans > 0 ? (state.dedicatedFans - 1) * STAFF_COSTS.DEDICATED_FAN : 0;

    const staffCost = apothecaryCost + coachCost + cheerleaderCost + fanCost;

    setState(prev => ({
      ...prev,
      spentOnPlayers: playerCost,
      spentOnRerolls: rerollCost,
      spentOnStaff: staffCost,
      remainingTreasury: state.startingTreasury - playerCost - rerollCost - staffCost,
    }));
  }, [state.selectedPlayers, state.rerolls, state.apothecary, state.assistantCoaches, state.cheerleaders, state.dedicatedFans, state.selectedRoster, positions, state.startingTreasury]);

  const handleRosterSelect = async (roster: RosterTemplate) => {
    try {
      const rosterPositions = await getRosterPositions(roster.id);
      setPositions(rosterPositions);
      setState(prev => ({ ...prev, selectedRoster: roster, selectedPlayers: [] }));
      setStep(2);
    } catch (err) {
      console.error('Failed to load positions:', err);
      setError('Failed to load roster positions');
    }
  };

  const handlePlayerQuantityChange = (positionId: string, quantity: number) => {
    setState(prev => {
      const existing = prev.selectedPlayers.find(sp => sp.positionId === positionId);
      if (existing) {
        return {
          ...prev,
          selectedPlayers: prev.selectedPlayers.map(sp =>
            sp.positionId === positionId ? { ...sp, quantity } : sp
          ).filter(sp => sp.quantity > 0),
        };
      } else if (quantity > 0) {
        return {
          ...prev,
          selectedPlayers: [...prev.selectedPlayers, { positionId, quantity }],
        };
      }
      return prev;
    });
  };

  const getTotalPlayers = () => {
    return state.selectedPlayers.reduce((sum, sp) => sum + sp.quantity, 0);
  };

  const canProceedFromPlayers = () => {
    const total = getTotalPlayers();
    return total >= STAFF_LIMITS.MIN_PLAYERS && total <= STAFF_LIMITS.MAX_PLAYERS_STANDARD;
  };

  const handleCreateTeam = async () => {
    if (!state.selectedRoster || !user || !league) {
      setError('Missing required information');
      return;
    }

    // Validate ownership option
    if (ownershipOption === 'other' && !targetOwnerDiscordId.trim()) {
      setError('Please enter the target owner\'s Discord ID');
      return;
    }

    try {
      setIsLoading(true);

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          league_id: league.id,
          name: state.teamName,
          race: state.selectedRoster.team_name,
          tier: 1, // Tier not used for league play (only tournaments), set to 1 as placeholder
          season_created: league.season_number || 1,
          treasury: state.remainingTreasury,
          rerolls: state.rerolls,
          assistant_coaches: state.assistantCoaches,
          cheerleaders: state.cheerleaders,
          dedicated_fans: state.dedicatedFans + 1, // +1 for the free one
          apothecary_hired: state.apothecary,
          special_rules_league_id: selectedLeagueId || null,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Create team ownership based on commissioner's choice
      if (ownershipOption === 'self') {
        // Create ownership for self
        const { error: ownershipError } = await supabase
          .from('team_ownership')
          .insert({
            team_id: team.id,
            user_id: user.userId,
            role: 'owner',
            granted_by: user.userId,
          });

        if (ownershipError) throw ownershipError;
      } else if (ownershipOption === 'other') {
        // Find the target user and create ownership for them
        const { data: targetUser, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('discord_id', targetOwnerDiscordId.trim())
          .maybeSingle();

        if (userError || !targetUser) {
          throw new Error('User not found with that Discord ID. They must log in at least once first.');
        }

        const { error: ownershipError } = await supabase
          .from('team_ownership')
          .insert({
            team_id: team.id,
            user_id: targetUser.id,
            role: 'owner',
            granted_by: user.userId,
          });

        if (ownershipError) throw ownershipError;
      }
      // If ownershipOption is 'none', don't create any ownership record

      // Create players with jersey numbers
      let currentJerseyNumber = 1;
      const playerInserts = state.selectedPlayers.flatMap(sp => {
        const position = positions.find(p => p.id === sp.positionId);
        if (!position) return [];

        return Array.from({ length: sp.quantity }, (_, i) => ({
          team_id: team.id,
          name: `${position.position_name} ${i + 1}`,
          number: currentJerseyNumber++,
          position: position.position_name,
          movement: position.ma,
          strength: position.st,
          agility: position.ag,
          passing: position.pa,
          armor_value: position.av,
          skills: position.skills || [],
          player_value: position.cost,
          season_joined: league.season_number || 1,
        }));
      });

      if (playerInserts.length > 0) {
        const { error: playersError } = await supabase
          .from('players')
          .insert(playerInserts);

        if (playersError) throw playersError;
      }

      // Calculate and update team value
      const playersValue = state.spentOnPlayers;
      const rerollsValue = state.spentOnRerolls;
      const staffValue = state.spentOnStaff;
      const teamValue = playersValue + rerollsValue + staffValue;

      await supabase
        .from('teams')
        .update({ team_value: teamValue })
        .eq('id', team.id);

      // Navigate back to where we came from, or use default based on role
      if (returnPath) {
        navigate(returnPath);
      } else if (isCommissioner && ownershipOption !== 'self') {
        // Commissioner created a team for someone else - default to schedule
        navigate('/commissioner/schedule');
      } else {
        // User created a team for themselves - default to coach dashboard
        navigate('/coach');
      }
    } catch (err) {
      console.error('Failed to create team:', err);
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || leagueLoading) {
    return <LoadingSpinner />;
  }

  if (!league) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <p className="text-xl text-red-600 mb-4">League Not Set Up</p>
          <p className="text-gray-600">
            The league infrastructure hasn't been initialized yet. Contact the system administrator.
          </p>
        </div>
      </CoachLayout>
    );
  }

  if (league.season_status === 'completed' || !league.season_status) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <p className="text-xl text-gray-600 mb-4">No Active Season</p>
          <p className="text-gray-600">
            There is no active season right now. Wait for the commissioner to start a new season.
          </p>
        </div>
      </CoachLayout>
    );
  }

  if (error) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <p className="text-xl text-red-600">{error}</p>
          <button
            onClick={() => navigate('/coach')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </CoachLayout>
    );
  }

  return (
    <CoachLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Create Your Team</h1>

        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-between">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  s === step
                    ? 'bg-blue-600 text-white'
                    : s < step
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {s}
              </div>
              {s < 5 && (
                <div
                  className={`w-16 h-1 ${
                    s < step ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Choose Roster */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Step 1: Choose Your Race</h2>
            <p className="text-gray-600 mb-6">
              Select the race for your team. Each race has unique players and abilities.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rosters.map(roster => (
                <button
                  key={roster.id}
                  onClick={() => handleRosterSelect(roster)}
                  className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow text-left"
                >
                  <h3 className="text-xl font-bold mb-2">{roster.team_name}</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Reroll Cost: {(roster.reroll_cost / 1000).toFixed(0)}k</p>
                    <p>Min Rerolls: {roster.min_rerolls}</p>
                    {roster.tier_1 && <p className="text-xs">Tier: {roster.tier_1}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Name Team */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Step 2: Name Your Team & Choose League</h2>
            <p className="text-gray-600 mb-6">
              Choose a name for your {state.selectedRoster?.team_name} team and select which special rules league you'll play in.
            </p>

            <div className="bg-white p-6 rounded-lg shadow space-y-6">
              <div>
                <label className="block mb-2 font-semibold">Team Name</label>
                <input
                  type="text"
                  value={state.teamName}
                  onChange={e => setState(prev => ({ ...prev, teamName: e.target.value }))}
                  className="w-full px-4 py-2 border rounded"
                  placeholder="Enter your team name..."
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">Special Rules League</label>
                <p className="text-sm text-gray-600 mb-2">
                  This determines which star players and inducements are available to your team.
                </p>
                <select
                  value={selectedLeagueId}
                  onChange={e => setSelectedLeagueId(e.target.value)}
                  className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a league...</option>
                  {specialRulesLeagues
                    .filter(league => {
                      // Check if this league is in tier_1 or tier_2
                      const roster = state.selectedRoster;
                      if (!roster) return false;

                      // If no tiers specified, show all leagues
                      if (!roster.tier_1 && !roster.tier_2) return true;

                      return roster.tier_1 === league.name || roster.tier_2 === league.name;
                    })
                    .map(league => (
                      <option key={league.id} value={league.id}>
                        {league.name}
                      </option>
                    ))}
                </select>
              </div>

              {isCommissioner && (
                <div>
                  <label className="block mb-2 font-semibold">Team Ownership</label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="ownership"
                        value="self"
                        checked={ownershipOption === 'self'}
                        onChange={() => setOwnershipOption('self')}
                        className="w-4 h-4"
                      />
                      <span>Create team for myself</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="ownership"
                        value="none"
                        checked={ownershipOption === 'none'}
                        onChange={() => setOwnershipOption('none')}
                        className="w-4 h-4"
                      />
                      <span>Create unowned team (filler team)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="ownership"
                        value="other"
                        checked={ownershipOption === 'other'}
                        onChange={() => setOwnershipOption('other')}
                        className="w-4 h-4"
                      />
                      <span>Create team for another user</span>
                    </label>

                    {ownershipOption === 'other' && (
                      <div className="ml-6 mt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Owner's Discord ID
                        </label>
                        <input
                          type="text"
                          value={targetOwnerDiscordId}
                          onChange={e => setTargetOwnerDiscordId(e.target.value)}
                          placeholder="e.g., 1238122293931282547"
                          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The user must have logged in to the system at least once.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!state.teamName.trim() || !selectedLeagueId}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Buy Players */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Step 3: Buy Players</h2>
            <p className="text-gray-600 mb-4">
              Purchase players for your roster. You need at least {STAFF_LIMITS.MIN_PLAYERS} players.
            </p>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Players: {getTotalPlayers()}/{STAFF_LIMITS.MAX_PLAYERS_STANDARD}</span>
                <span>Treasury: {(state.remainingTreasury / 1000).toFixed(0)}k</span>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {positions.map(position => {
                const selected = state.selectedPlayers.find(sp => sp.positionId === position.id);
                const quantity = selected?.quantity || 0;

                return (
                  <div key={position.id} className="bg-white p-4 rounded-lg shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{position.position_name}</h3>
                        <p className="text-sm text-gray-600">
                          {position.ma} MA | {position.st} ST | {position.ag}+ AG
                          {position.pa && ` | ${position.pa}+ PA`} | {position.av}+ AV
                        </p>
                        <p className="text-sm text-gray-500">
                          Cost: {(position.cost / 1000).toFixed(0)}k | Max: {position.max_quantity}
                        </p>
                        {position.skills.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Skills: {position.skills.join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePlayerQuantityChange(position.id, Math.max(0, quantity - 1))}
                          className="w-8 h-8 bg-gray-300 rounded hover:bg-gray-400"
                          disabled={quantity === 0}
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-semibold">{quantity}</span>
                        <button
                          onClick={() => handlePlayerQuantityChange(position.id, quantity + 1)}
                          className="w-8 h-8 bg-blue-600 text-white rounded hover:bg-blue-700"
                          disabled={
                            quantity >= position.max_quantity ||
                            getTotalPlayers() >= STAFF_LIMITS.MAX_PLAYERS_STANDARD ||
                            state.remainingTreasury < position.cost
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!canProceedFromPlayers()}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>

            {!canProceedFromPlayers() && getTotalPlayers() > 0 && (
              <p className="mt-4 text-red-600">
                {getTotalPlayers() < STAFF_LIMITS.MIN_PLAYERS
                  ? `You need at least ${STAFF_LIMITS.MIN_PLAYERS} players`
                  : 'Too many players'}
              </p>
            )}
          </div>
        )}

        {/* Step 4: Buy Rerolls and Staff */}
        {step === 4 && state.selectedRoster && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Step 4: Buy Rerolls and Staff</h2>
            <p className="text-gray-600 mb-4">
              Purchase team rerolls and staff. Rerolls cost double after team creation!
            </p>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="text-lg font-semibold">
                Remaining Treasury: {(state.remainingTreasury / 1000).toFixed(0)}k
              </div>
            </div>

            <div className="space-y-6 bg-white p-6 rounded-lg shadow">
              {/* Rerolls */}
              <div>
                <label className="block font-semibold mb-2">
                  Team Rerolls (Cost: {(state.selectedRoster.reroll_cost / 1000).toFixed(0)}k each)
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setState(prev => ({ ...prev, rerolls: Math.max(state.selectedRoster!.min_rerolls, prev.rerolls - 1) }))}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    disabled={state.rerolls <= state.selectedRoster.min_rerolls}
                  >
                    -
                  </button>
                  <span className="text-xl font-semibold">{state.rerolls}</span>
                  <button
                    onClick={() => setState(prev => ({ ...prev, rerolls: prev.rerolls + 1 }))}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={
                      state.rerolls >= state.selectedRoster.max_rerolls ||
                      state.remainingTreasury < state.selectedRoster.reroll_cost
                    }
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-600">
                    (Min: {state.selectedRoster.min_rerolls}, Max: {state.selectedRoster.max_rerolls})
                  </span>
                </div>
              </div>

              {/* Apothecary */}
              {state.selectedRoster.apothecary_allowed && (
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={state.apothecary}
                      onChange={e => setState(prev => ({ ...prev, apothecary: e.target.checked }))}
                      disabled={state.remainingTreasury < STAFF_COSTS.APOTHECARY && !state.apothecary}
                      className="w-5 h-5"
                    />
                    <span className="font-semibold">
                      Apothecary ({(STAFF_COSTS.APOTHECARY / 1000).toFixed(0)}k)
                    </span>
                  </label>
                </div>
              )}

              {/* Assistant Coaches */}
              <div>
                <label className="block font-semibold mb-2">
                  Assistant Coaches ({(STAFF_COSTS.ASSISTANT_COACH / 1000).toFixed(0)}k each, Max: {STAFF_LIMITS.MAX_ASSISTANT_COACHES})
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setState(prev => ({ ...prev, assistantCoaches: Math.max(0, prev.assistantCoaches - 1) }))}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    disabled={state.assistantCoaches === 0}
                  >
                    -
                  </button>
                  <span className="text-xl font-semibold">{state.assistantCoaches}</span>
                  <button
                    onClick={() => setState(prev => ({ ...prev, assistantCoaches: prev.assistantCoaches + 1 }))}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={
                      state.assistantCoaches >= STAFF_LIMITS.MAX_ASSISTANT_COACHES ||
                      state.remainingTreasury < STAFF_COSTS.ASSISTANT_COACH
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Cheerleaders */}
              <div>
                <label className="block font-semibold mb-2">
                  Cheerleaders ({(STAFF_COSTS.CHEERLEADER / 1000).toFixed(0)}k each, Max: {STAFF_LIMITS.MAX_CHEERLEADERS})
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setState(prev => ({ ...prev, cheerleaders: Math.max(0, prev.cheerleaders - 1) }))}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    disabled={state.cheerleaders === 0}
                  >
                    -
                  </button>
                  <span className="text-xl font-semibold">{state.cheerleaders}</span>
                  <button
                    onClick={() => setState(prev => ({ ...prev, cheerleaders: prev.cheerleaders + 1 }))}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={
                      state.cheerleaders >= STAFF_LIMITS.MAX_CHEERLEADERS ||
                      state.remainingTreasury < STAFF_COSTS.CHEERLEADER
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Dedicated Fans */}
              <div>
                <label className="block font-semibold mb-2">
                  Dedicated Fans (First is free, then {(STAFF_COSTS.DEDICATED_FAN / 1000).toFixed(0)}k each, Max: {STAFF_LIMITS.MAX_DEDICATED_FANS})
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setState(prev => ({ ...prev, dedicatedFans: Math.max(0, prev.dedicatedFans - 1) }))}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    disabled={state.dedicatedFans === 0}
                  >
                    -
                  </button>
                  <span className="text-xl font-semibold">{state.dedicatedFans + 1}</span>
                  <button
                    onClick={() => setState(prev => ({ ...prev, dedicatedFans: prev.dedicatedFans + 1 }))}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={
                      state.dedicatedFans >= STAFF_LIMITS.MAX_DEDICATED_FANS ||
                      (state.dedicatedFans > 0 && state.remainingTreasury < STAFF_COSTS.DEDICATED_FAN)
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Back
              </button>
              <button
                onClick={() => setStep(5)}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Next: Review
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Review and Confirm */}
        {step === 5 && state.selectedRoster && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Step 5: Review and Confirm</h2>
            <p className="text-gray-600 mb-6">Review your team and confirm creation.</p>

            <div className="bg-white p-6 rounded-lg shadow space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-2">Team Details</h3>
                <p><strong>Name:</strong> {state.teamName}</p>
                <p><strong>Race:</strong> {state.selectedRoster.team_name}</p>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-2">Players ({getTotalPlayers()})</h3>
                <ul className="space-y-1">
                  {state.selectedPlayers.map(sp => {
                    const position = positions.find(p => p.id === sp.positionId);
                    return position ? (
                      <li key={sp.positionId}>
                        {sp.quantity}x {position.position_name} ({(position.cost / 1000).toFixed(0)}k each)
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-2">Team Resources</h3>
                <p>Rerolls: {state.rerolls}</p>
                {state.apothecary && <p>Apothecary: Yes</p>}
                {state.assistantCoaches > 0 && <p>Assistant Coaches: {state.assistantCoaches}</p>}
                {state.cheerleaders > 0 && <p>Cheerleaders: {state.cheerleaders}</p>}
                <p>Dedicated Fans: {state.dedicatedFans + 1}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded">
                <h3 className="font-bold text-lg mb-2">Treasury</h3>
                <p>Starting: {(state.startingTreasury / 1000).toFixed(0)}k</p>
                <p>Spent on Players: {(state.spentOnPlayers / 1000).toFixed(0)}k</p>
                <p>Spent on Rerolls: {(state.spentOnRerolls / 1000).toFixed(0)}k</p>
                <p>Spent on Staff: {(state.spentOnStaff / 1000).toFixed(0)}k</p>
                <p className="font-bold text-xl mt-2">
                  Remaining: {(state.remainingTreasury / 1000).toFixed(0)}k
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => setStep(4)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Back
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={isLoading}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating Team...' : 'Create Team'}
              </button>
            </div>
          </div>
        )}
      </div>
    </CoachLayout>
  );
}
