import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useLeague } from '../../hooks/useLeague';
import { useTeam } from '../../hooks/useTeam';
import CoachLayout from '../../components/layouts/CoachLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';

type ReUpChoice = 'reup' | 'expansion' | 'move' | 'suspend' | 'retire';

interface ReUpOption {
  id: ReUpChoice;
  title: string;
  description: string;
  icon: string;
  color: string;
  borderColor: string;
  action: string;
}

const reupOptions: ReUpOption[] = [
  {
    id: 'reup',
    title: 'Re-Up',
    description: 'Continue with your current team into the new season. Your roster, treasury, and all progress carries forward.',
    icon: '🔄',
    color: 'bg-green-50',
    borderColor: 'border-green-500',
    action: 'Continue with Current Team'
  },
  {
    id: 'expansion',
    title: 'Expansion Team',
    description: 'Start fresh with a brand new team while keeping your coaching record. Your old team becomes inactive.',
    icon: '🌟',
    color: 'bg-blue-50',
    borderColor: 'border-blue-500',
    action: 'Create New Team'
  },
  {
    id: 'move',
    title: 'Move Franchise',
    description: 'Keep your team and treasury but change your race. Retire all players and rebuild roster from scratch.',
    icon: '🚚',
    color: 'bg-purple-50',
    borderColor: 'border-purple-500',
    action: 'Change Race'
  },
  {
    id: 'suspend',
    title: 'Suspend Operations',
    description: 'Take a break this season. Your team remains but won\'t participate. You can return in a future season.',
    icon: '⏸️',
    color: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    action: 'Sit Out Season'
  },
  {
    id: 'retire',
    title: 'Retire',
    description: 'Permanently retire from coaching. Your team will be removed from the league.',
    icon: '👋',
    color: 'bg-red-50',
    borderColor: 'border-red-500',
    action: 'Leave League'
  }
];

export default function SeasonReUpPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { league, isLoading: leagueLoading } = useLeague();
  const { team, isLoading: teamLoading } = useTeam();

  const [selectedOption, setSelectedOption] = useState<ReUpChoice | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAlreadyReUpped, setHasAlreadyReUpped] = useState(false);

  useEffect(() => {
    // Check if coach has already re-upped for the new season
    // This would be tracked in a separate table in production
    // For now, we'll assume they haven't if league is in pre-season
    if (league && league.season_status !== 'pre-season') {
      setHasAlreadyReUpped(true);
    }
  }, [league]);

  const handleSubmitChoice = async () => {
    if (!selectedOption || !team || !user || !league) {
      setError('Missing required information');
      return;
    }

    // Validate confirmation for destructive actions
    if (['expansion', 'move', 'retire'].includes(selectedOption)) {
      if (confirmText.toLowerCase() !== 'confirm') {
        setError('Please type "CONFIRM" to proceed');
        return;
      }
    }

    setIsProcessing(true);
    setError(null);

    try {
      switch (selectedOption) {
        case 'reup':
          await handleReUp();
          break;
        case 'expansion':
          await handleExpansion();
          break;
        case 'move':
          await handleMove();
          break;
        case 'suspend':
          await handleSuspend();
          break;
        case 'retire':
          await handleRetire();
          break;
      }

      // Success - navigate back to dashboard
      navigate('/coach');
    } catch (err) {
      console.error('Error processing re-up choice:', err);
      setError(err instanceof Error ? err.message : 'Failed to process choice');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReUp = async () => {
    // Team continues as-is, just mark as active for new season
    const { error } = await supabase
      .from('teams')
      .update({ active: true })
      .eq('id', team!.id);

    if (error) throw error;
  };

  const handleExpansion = async () => {
    // Mark old team as inactive
    const { error: deactivateError } = await supabase
      .from('teams')
      .update({ active: false })
      .eq('id', team!.id);

    if (deactivateError) throw deactivateError;

    // Navigate to team creation
    // In a real implementation, this would go to a team creation wizard
    alert('Expansion team feature coming soon! You would now create a new team.');
  };

  const handleMove = async () => {
    // Retire all players
    const { error: retirePlayers } = await supabase
      .from('players')
      .update({ status: 'retired' })
      .eq('team_id', team!.id);

    if (retirePlayers) throw retirePlayers;

    // Navigate to roster selection (race change)
    alert('Move franchise feature coming soon! You would now select a new race and rebuild your roster.');
  };

  const handleSuspend = async () => {
    // Mark team as inactive
    const { error } = await supabase
      .from('teams')
      .update({ active: false })
      .eq('id', team!.id);

    if (error) throw error;
  };

  const handleRetire = async () => {
    // Remove team ownership
    const { error: ownershipError } = await supabase
      .from('team_ownership')
      .delete()
      .eq('team_id', team!.id)
      .eq('user_id', user!.userId);

    if (ownershipError) throw ownershipError;

    // Mark team as inactive
    const { error: deactivateError } = await supabase
      .from('teams')
      .update({ active: false })
      .eq('id', team!.id);

    if (deactivateError) throw deactivateError;

    // Navigate to dashboard
    navigate('/dashboard');
  };

  if (leagueLoading || teamLoading) {
    return (
      <CoachLayout>
        <LoadingSpinner message="Loading..." />
      </CoachLayout>
    );
  }

  if (!league || !team) {
    return (
      <CoachLayout>
        <ErrorMessage message="League or team not found" />
      </CoachLayout>
    );
  }

  if (hasAlreadyReUpped && league.season_status !== 'pre-season') {
    return (
      <CoachLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              Season Already in Progress
            </h2>
            <p className="text-blue-800 mb-4">
              The current season has already started. Re-up decisions are only available during the pre-season.
            </p>
            <button
              onClick={() => navigate('/coach')}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </CoachLayout>
    );
  }

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Season Re-Up</h1>
        <p className="text-gray-600 mb-8">
          A new season is beginning! Choose how you'd like to continue your coaching career.
        </p>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} />
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Current Team</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Team Name:</span>
              <span className="ml-2 font-semibold">{team.name}</span>
            </div>
            <div>
              <span className="text-gray-600">Race:</span>
              <span className="ml-2 font-semibold">{team.race}</span>
            </div>
            <div>
              <span className="text-gray-600">Treasury:</span>
              <span className="ml-2 font-semibold">{team.treasury?.toLocaleString()}g</span>
            </div>
            <div>
              <span className="text-gray-600">Record:</span>
              <span className="ml-2 font-semibold">
                {team.wins}-{team.losses}-{team.ties}
              </span>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Choose Your Path</h2>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {reupOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option.id)}
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                selectedOption === option.id
                  ? `${option.color} ${option.borderColor} shadow-lg scale-105`
                  : 'bg-white border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-4xl mb-3">{option.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{option.title}</h3>
              <p className="text-gray-700 text-sm mb-4">{option.description}</p>
              {selectedOption === option.id && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <span className="text-sm font-semibold text-gray-900">
                    Action: {option.action}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {selectedOption && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Your Choice</h3>

            {['expansion', 'move', 'retire'].includes(selectedOption) && (
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  This action will make permanent changes to your team. Type <strong>CONFIRM</strong> to proceed.
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type CONFIRM..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setSelectedOption(null);
                  setConfirmText('');
                  setError(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitChoice}
                disabled={
                  isProcessing ||
                  (['expansion', 'move', 'retire'].includes(selectedOption) &&
                    confirmText.toLowerCase() !== 'confirm')
                }
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Submit Choice'}
              </button>
            </div>
          </div>
        )}

        {!selectedOption && (
          <div className="text-center text-gray-500">
            Select an option above to continue
          </div>
        )}
      </div>
    </CoachLayout>
  );
}
