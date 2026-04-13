import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../config/supabase';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

type PlayoffFormat = 'none' | 'championship' | 'top_4_bracket' | 'play_in' | 'top_8_bracket' | 'division_winners';

interface LeagueFormData {
  // Step 1: Basic Info
  name: string;
  season_number: number;

  // Step 2: Structure
  max_teams: number;
  min_teams: number;
  divisions: number;
  games_per_season: number;

  // Step 3: Scoring
  win_points: number;
  tie_points: number;
  loss_points: number;
  attendance_threshold: number;

  // Step 4: Playoffs
  playoff_format: PlayoffFormat;
  playoff_seeding: 'by_points' | 'by_division';
  home_advantage: boolean;
}

const INITIAL_FORM_DATA: LeagueFormData = {
  name: '',
  season_number: 1,
  max_teams: 8,
  min_teams: 4,
  divisions: 2,
  games_per_season: 10,
  win_points: 3,
  tie_points: 1,
  loss_points: 0,
  attendance_threshold: 3,
  playoff_format: 'top_4_bracket',
  playoff_seeding: 'by_points',
  home_advantage: false,
};

export default function InitialSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<LeagueFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if league already exists, redirect if it does
  useEffect(() => {
    const checkLeagueExists = async () => {
      const { data: league } = await supabase
        .from('leagues')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (league) {
        // League already exists, redirect to dashboard
        navigate('/dashboard', { replace: true });
      } else {
        setIsChecking(false);
      }
    };

    checkLeagueExists();
  }, [navigate]);

  const updateFormData = (updates: Partial<LeagueFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Get available playoff formats based on league structure
  const getAvailablePlayoffFormats = () => {
    const formats: Array<{ value: PlayoffFormat; label: string; description: string }> = [
      { value: 'none', label: 'No Playoffs', description: 'Regular season winner takes all' },
    ];

    if (formData.max_teams >= 2) {
      formats.push({ value: 'championship', label: 'Championship Game', description: 'Top 2 teams face off' });
    }

    if (formData.max_teams >= 4) {
      formats.push({ value: 'top_4_bracket', label: 'Top 4 Bracket', description: 'Semifinals + Final' });
    }

    if (formData.max_teams >= 8) {
      formats.push({ value: 'play_in', label: 'Play-In Tournament', description: 'NBA style: 7-10 play-in, top 6 advance' });
      formats.push({ value: 'top_8_bracket', label: 'Top 8 Bracket', description: 'Full 8-team bracket' });
    }

    if (formData.divisions >= 2 && formData.max_teams >= 4) {
      formats.push({ value: 'division_winners', label: 'Division Winners', description: 'Top 2 per division compete' });
    }

    return formats;
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Calculate playoff teams count
      const playoffTeamsMap: Record<PlayoffFormat, number> = {
        none: 0,
        championship: 2,
        top_4_bracket: 4,
        play_in: 10,
        top_8_bracket: 8,
        division_winners: formData.divisions * 2,
      };

      // Create league
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert({
          name: formData.name,
          commissioner_id: user.userId,
          season_number: formData.season_number,
          season_status: 'setup',
          // Top-level columns for easy querying
          max_teams: formData.max_teams,
          min_teams: formData.min_teams,
          divisions: formData.divisions,
          games_per_season: formData.games_per_season,
          win_points: formData.win_points,
          tie_points: formData.tie_points,
          loss_points: formData.loss_points,
          attendance_threshold: formData.attendance_threshold,
          playoff_format: formData.playoff_format,
          playoff_seeding: formData.playoff_seeding,
          home_advantage: formData.home_advantage,
          // Also store in rules_config for historical compatibility
          rules_config: {
            max_teams: formData.max_teams,
            min_teams: formData.min_teams,
            divisions: formData.divisions,
            games_per_season: formData.games_per_season,
            attendance_threshold: formData.attendance_threshold,
            scoring: {
              win: formData.win_points,
              tie: formData.tie_points,
              loss: formData.loss_points,
            },
            playoff_format: {
              type: formData.playoff_format,
              teams_count: playoffTeamsMap[formData.playoff_format],
              seeding: formData.playoff_seeding,
              home_advantage: formData.home_advantage,
            },
          },
        })
        .select('id')
        .single();

      if (leagueError || !league) {
        throw new Error('Failed to create league');
      }

      // Grant both commissioner and coach roles (commissioner is always also a coach)
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([
          {
            league_id: league.id,
            user_id: user.userId,
            role: 'commissioner',
            granted_by: user.userId,
          },
          {
            league_id: league.id,
            user_id: user.userId,
            role: 'coach',
            granted_by: user.userId,
          }
        ]);

      if (roleError) {
        console.error('Error granting roles:', roleError);
      }

      // Create default visitor team
      const { error: visitorError } = await supabase
        .from('visitor_teams')
        .insert({
          league_id: league.id,
          roster_config: {
            race: 'Human',
            tier: 2,
            players: [],
            rerolls: 3,
            treasury: 0,
          },
        });

      if (visitorError) {
        console.error('Error creating visitor team:', visitorError);
      }

      // Success! Redirect to commissioner dashboard
      navigate('/commissioner');
    } catch (err) {
      console.error('Error creating league:', err);
      setError(err instanceof Error ? err.message : 'Failed to create league');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Basic League Information</h2>
        <p className="text-gray-600">Set up your league infrastructure and first season</p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          League Name *
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., Saturday Morning Blood Bowl"
          required
        />
      </div>

      <div>
        <label htmlFor="season_number" className="block text-sm font-medium text-gray-700 mb-2">
          Starting Season Number
        </label>
        <input
          type="number"
          id="season_number"
          min="1"
          value={formData.season_number}
          onChange={(e) => updateFormData({ season_number: parseInt(e.target.value) })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-sm text-gray-500 mt-1">Usually 1 for a new league</p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">League Structure</h2>
        <p className="text-gray-600">Configure teams and divisions</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="max_teams" className="block text-sm font-medium text-gray-700 mb-2">
            Maximum Teams
          </label>
          <input
            type="number"
            id="max_teams"
            min="2"
            max="16"
            value={formData.max_teams}
            onChange={(e) => updateFormData({ max_teams: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="min_teams" className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Teams
          </label>
          <input
            type="number"
            id="min_teams"
            min="2"
            max={formData.max_teams}
            value={formData.min_teams}
            onChange={(e) => updateFormData({ min_teams: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="divisions" className="block text-sm font-medium text-gray-700 mb-2">
            Number of Divisions
          </label>
          <input
            type="number"
            id="divisions"
            min="1"
            max="4"
            value={formData.divisions}
            onChange={(e) => updateFormData({ divisions: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">1 = No divisions</p>
        </div>

        <div>
          <label htmlFor="games_per_season" className="block text-sm font-medium text-gray-700 mb-2">
            Games per Season
          </label>
          <input
            type="number"
            id="games_per_season"
            min="1"
            max="20"
            value={formData.games_per_season}
            onChange={(e) => updateFormData({ games_per_season: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Scoring & Rules</h2>
        <p className="text-gray-600">Configure how points are awarded</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <label htmlFor="win_points" className="block text-sm font-medium text-gray-700 mb-2">
            Win Points
          </label>
          <input
            type="number"
            id="win_points"
            min="0"
            value={formData.win_points}
            onChange={(e) => updateFormData({ win_points: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="tie_points" className="block text-sm font-medium text-gray-700 mb-2">
            Tie Points
          </label>
          <input
            type="number"
            id="tie_points"
            min="0"
            value={formData.tie_points}
            onChange={(e) => updateFormData({ tie_points: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="loss_points" className="block text-sm font-medium text-gray-700 mb-2">
            Loss Points
          </label>
          <input
            type="number"
            id="loss_points"
            min="0"
            value={formData.loss_points}
            onChange={(e) => updateFormData({ loss_points: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label htmlFor="attendance_threshold" className="block text-sm font-medium text-gray-700 mb-2">
          Minimum Dedicated Fans for Attendance Roll
        </label>
        <input
          type="number"
          id="attendance_threshold"
          min="0"
          max="10"
          step="1"
          value={formData.attendance_threshold}
          onChange={(e) => updateFormData({ attendance_threshold: parseInt(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-sm text-gray-500 mt-1">
          Minimum number of dedicated fans required to roll for attendance (typically 3)
        </p>
      </div>
    </div>
  );

  const renderStep4 = () => {
    const availableFormats = getAvailablePlayoffFormats();

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Playoff Configuration</h2>
          <p className="text-gray-600">Choose your playoff format</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Playoff Format
          </label>
          <div className="space-y-3">
            {availableFormats.map((format) => (
              <div
                key={format.value}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  formData.playoff_format === format.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => updateFormData({ playoff_format: format.value })}
              >
                <div className="flex items-start">
                  <input
                    type="radio"
                    name="playoff_format"
                    value={format.value}
                    checked={formData.playoff_format === format.value}
                    onChange={() => updateFormData({ playoff_format: format.value })}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">{format.label}</div>
                    <div className="text-sm text-gray-600">{format.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {formData.playoff_format !== 'none' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Playoff Seeding
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="seeding"
                    value="by_points"
                    checked={formData.playoff_seeding === 'by_points'}
                    onChange={() => updateFormData({ playoff_seeding: 'by_points' })}
                    className="mr-2"
                  />
                  <span>By League Points (standard)</span>
                </label>
                {formData.divisions > 1 && (
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="seeding"
                      value="by_division"
                      checked={formData.playoff_seeding === 'by_division'}
                      onChange={() => updateFormData({ playoff_seeding: 'by_division' })}
                      className="mr-2"
                    />
                    <span>By Division Standings</span>
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.home_advantage}
                  onChange={(e) => updateFormData({ home_advantage: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  Home Field Advantage (higher seed plays at home)
                </span>
              </label>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderReview = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Review League Setup</h2>
        <p className="text-gray-600">Review the league infrastructure and first season settings</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Basic Information</h3>
          <p><span className="text-gray-600">Name:</span> {formData.name}</p>
          <p><span className="text-gray-600">Starting Season:</span> {formData.season_number}</p>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Structure</h3>
          <p><span className="text-gray-600">Teams:</span> {formData.min_teams}-{formData.max_teams}</p>
          <p><span className="text-gray-600">Divisions:</span> {formData.divisions}</p>
          <p><span className="text-gray-600">Games per Season:</span> {formData.games_per_season}</p>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Scoring</h3>
          <p><span className="text-gray-600">Win/Tie/Loss:</span> {formData.win_points}/{formData.tie_points}/{formData.loss_points}</p>
          <p><span className="text-gray-600">Min Dedicated Fans:</span> {formData.attendance_threshold}</p>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Playoffs</h3>
          <p><span className="text-gray-600">Format:</span> {getAvailablePlayoffFormats().find(f => f.value === formData.playoff_format)?.label}</p>
          {formData.playoff_format !== 'none' && (
            <>
              <p><span className="text-gray-600">Seeding:</span> {formData.playoff_seeding === 'by_points' ? 'By Points' : 'By Division'}</p>
              <p><span className="text-gray-600">Home Advantage:</span> {formData.home_advantage ? 'Yes' : 'No'}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const canProceed = () => {
    if (currentStep === 1) return formData.name.trim().length > 0;
    if (currentStep === 2) return formData.min_teams <= formData.max_teams;
    return true;
  };

  if (isChecking || isSubmitting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message={isChecking ? "Checking league status..." : "Setting up your league..."} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                {step < 5 && (
                  <div
                    className={`w-12 h-1 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Basic</span>
            <span>Structure</span>
            <span>Scoring</span>
            <span>Playoffs</span>
            <span>Review</span>
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {error && (
            <div className="mb-6">
              <ErrorMessage message={error} />
            </div>
          )}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderReview()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/dashboard')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </button>

            {currentStep < 5 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceed()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!formData.name.trim()}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create League
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
