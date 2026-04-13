/**
 * ScheduleMakerMode Component
 *
 * The editing interface for schedule construction.
 * Displays rounds with game cards on the left, editing tools on the right.
 */

import { useState, useEffect } from 'react';
import TeamsPanel from './panels/TeamsPanel';
import VenuesPanel from './panels/VenuesPanel';
import DatesPanel from './panels/DatesPanel';
import AddGamePanel from './panels/AddGamePanel';
import ScheduleCheckerPanel from './panels/ScheduleCheckerPanel';
import ScheduleOptimizerPanel from './panels/ScheduleOptimizerPanel';
import type { OptimizationType } from './panels/ScheduleOptimizerPanel';
import { ScheduleOptimizer, OptimizationScope } from '../../utils/scheduleOptimizer';
import ApplyToAllModal from './modals/ApplyToAllModal';
import SettingsModal from './modals/SettingsModal';
import ManualDateModal from './modals/ManualDateModal';
import ManualTimeModal from './modals/ManualTimeModal';
import TeamScheduleModal from './modals/TeamScheduleModal';
import { supabase } from '../../config/supabase';
import { validateSchedule, getMatchValidation } from '../../utils/scheduleValidation';
import { calculateRoundDate, calculateGameStartTime } from '../../utils/dateCalculation';

interface Match {
  id: string;
  match_number: number;
  home_team_id?: string;
  away_team_id?: string;
  venue_id?: string;
  pitch_id?: string;
  match_type?: string;
  home_team?: {
    id: string;
    name: string;
    team_ownership?: Array<{
      user_id: string;
    }>;
  };
  away_team?: {
    id: string;
    name: string;
    team_ownership?: Array<{
      user_id: string;
    }>;
  };
  venue?: { name: string };
  pitch?: { name: string };
  scheduled_date?: string;
  week_number?: number;
  metadata?: {
    homeSlot?: string;
    awaySlot?: string;
    matchType?: string;
    roundLabel?: string;
  };
}

interface ScheduleMakerModeProps {
  matches: Match[];
  leagueName: string;
  seasonNumber: number;
  leagueId: string;
  onDataChanged?: () => void;
}

type SidebarPanel = 'settings' | 'venues' | 'dates' | 'teams' | 'add-game' | 'checker' | 'playoffs' | 'regenerate' | 'help' | null;

export default function ScheduleMakerMode({ matches, leagueName, seasonNumber, leagueId, onDataChanged }: ScheduleMakerModeProps) {
  const [activePanel, setActivePanel] = useState<SidebarPanel>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ matchId: string; slot: 'home' | 'away' } | null>(null);
  const [dragOverRound, setDragOverRound] = useState<number | null>(null);
  const [dragOverBetweenRounds, setDragOverBetweenRounds] = useState<number | null>(null);
  const [draggedMatch, setDraggedMatch] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [manualDateModal, setManualDateModal] = useState<{ roundNumber: number; currentDate?: string } | null>(null);
  const [manualTimeModal, setManualTimeModal] = useState<{ matchId: string; matchNumber: number; currentDate?: string } | null>(null);
  const [teamScheduleModal, setTeamScheduleModal] = useState<{ teamId: string } | null>(null);
  const [highlightedMatches, setHighlightedMatches] = useState<string[]>([]);

  // Data for constraint solver and optimizer
  const [venues, setVenues] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [season, setSeason] = useState<any>(null);
  const [dateSchedules, setDateSchedules] = useState<any[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<any[]>([]);

  // Preview mode for optimization
  const [previewMode, setPreviewMode] = useState(false);
  const [previewChanges, setPreviewChanges] = useState<any[]>([]);
  const [previewMatches, setPreviewMatches] = useState<Match[]>([]);
  const [originalMatches, setOriginalMatches] = useState<Match[]>([]);
  const [currentOptimization, setCurrentOptimization] = useState<OptimizationType | null>(null);
  const [pendingOptimization, setPendingOptimization] = useState<OptimizationType | null>(null);

  // Helper function to enrich preview matches with nested objects
  const enrichPreviewMatches = (optimizedMatches: Match[], freshVenues: any[], freshTeams: any[]): Match[] => {
    return optimizedMatches.map(match => {
      const enrichedMatch = { ...match };

      // Populate home_team object
      if (match.home_team_id) {
        const homeTeam = freshTeams.find(t => t.id === match.home_team_id);
        if (homeTeam) {
          enrichedMatch.home_team = homeTeam;
        }
      }

      // Populate away_team object
      if (match.away_team_id) {
        const awayTeam = freshTeams.find(t => t.id === match.away_team_id);
        if (awayTeam) {
          enrichedMatch.away_team = awayTeam;
        }
      }

      // Populate venue object
      if (match.venue_id) {
        const venue = freshVenues.find(v => v.id === match.venue_id);
        if (venue) {
          enrichedMatch.venue = { name: venue.name };
        }
      }

      // Populate pitch object
      if (match.pitch_id && match.venue_id) {
        const venue = freshVenues.find(v => v.id === match.venue_id);
        if (venue?.pitches) {
          const pitch = venue.pitches.find((p: any) => p.id === match.pitch_id);
          if (pitch) {
            enrichedMatch.pitch = { name: pitch.name };
          }
        }
      }

      return enrichedMatch;
    });
  };

  // Load venues, teams, and season data for constraint solver
  const loadConstraintSolverData = async () => {
    console.log('[loadConstraintSolverData] Loading constraint solver data...');
    try {
      // Load venues with pitches
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select(`
          id,
          name,
          availability_start_datetime,
          availability_end_datetime,
          is_recurring,
          recurrence_type,
          recurrence_days,
          use_specific_dates,
          specific_dates,
          pitches (
            id,
            name,
            venue_id
          )
        `)
        .eq('league_id', leagueId)
        .eq('include_in_season', true);

      if (venuesError) throw venuesError;
      console.log('[loadConstraintSolverData] Loaded venues:', venuesData?.length, venuesData);
      const loadedVenues = venuesData || [];
      setVenues(loadedVenues);

      // Load teams with coach information
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          team_ownership!team_ownership_team_id_fkey (
            user_id
          )
        `)
        .eq('league_id', leagueId);

      if (teamsError) throw teamsError;
      // Transform teams to include coach_id
      const teamsWithCoaches = (teamsData || []).map((team: any) => ({
        id: team.id,
        name: team.name,
        coach_id: team.team_ownership?.[0]?.user_id || null,
      }));
      setTeams(teamsWithCoaches);

      // Load season settings
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('id, season_number, start_date, end_date, games_per_team, single_round_robin, double_round_robin, schedule_preference, game_duration_minutes')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .single();

      if (seasonError) throw seasonError;

      // Transform season data to match expected interface
      const transformedSeasonData = {
        ...seasonData,
        matches_per_team: seasonData.games_per_team,
        season_type: (seasonData.double_round_robin ? 'double_round_robin' :
                     seasonData.single_round_robin ? 'round_robin' : 'custom') as 'custom' | 'round_robin' | 'double_round_robin'
      };
      setSeason(transformedSeasonData);

      // Load date schedules
      const { data: dateSchedulesData, error: dateSchedulesError } = await supabase
        .from('date_schedules')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber);

      if (dateSchedulesError) throw dateSchedulesError;
      const loadedDateSchedules = dateSchedulesData || [];
      setDateSchedules(loadedDateSchedules);

      // Load blackout dates
      const { data: blackoutDatesData, error: blackoutDatesError } = await supabase
        .from('blackout_dates')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber);

      if (blackoutDatesError) throw blackoutDatesError;
      const loadedBlackoutDates = blackoutDatesData || [];
      setBlackoutDates(loadedBlackoutDates);

      // Return the loaded data so callers can use it immediately
      return {
        venues: loadedVenues,
        teams: teamsWithCoaches,
        season: transformedSeasonData,
        dateSchedules: loadedDateSchedules,
        blackoutDates: loadedBlackoutDates
      };
    } catch (err) {
      console.error('Error loading constraint solver data:', err);
      return null;
    }
  };

  // Load data on mount and when league/season changes
  useEffect(() => {
    loadConstraintSolverData();
  }, [leagueId, seasonNumber]);

  // Also reload when parent data changes (venues/dates modified)
  useEffect(() => {
    if (matches.length > 0) {
      loadConstraintSolverData();
    }
  }, [matches]);

  // Validate schedule
  const validation = validateSchedule(matches);
  const [modalData, setModalData] = useState<{
    matchId: string;
    slot: 'home' | 'away';
    teamId: string;
    teamName: string;
    oldTeamName: string | null;
    isEmptySlot: boolean;
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Group matches by week/round
  // Use previewMatches when in preview mode, otherwise use actual matches
  const displayMatches = previewMode && previewMatches.length > 0 ? previewMatches : matches;
  const rounds = new Map<number, Match[]>();
  displayMatches.forEach(match => {
    const week = match.week_number || 1;
    if (!rounds.has(week)) {
      rounds.set(week, []);
    }
    rounds.get(week)!.push(match);
  });

  const sortedRounds = Array.from(rounds.entries()).sort(([a], [b]) => a - b);

  const handleTeamDrop = async (matchId: string, slot: 'home' | 'away', e: React.DragEvent) => {
    e.preventDefault();
    const teamId = e.dataTransfer.getData('teamId');
    const teamName = e.dataTransfer.getData('teamName');

    if (!teamId) return;

    // Find the match to get the old team name
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const oldTeam = slot === 'home' ? match.home_team : match.away_team;
    const oldTeamName = oldTeam?.name || null;
    const isEmptySlot = slot === 'home' ? !match.home_team_id : !match.away_team_id;

    setDragOverSlot(null);

    // Show modal for user to choose apply to one or all
    setModalData({
      matchId,
      slot,
      teamId,
      teamName,
      oldTeamName,
      isEmptySlot,
    });
  };

  const applyTeamToOneGame = async () => {
    if (!modalData) return;

    setIsUpdating(true);
    try {
      const updateField = modalData.slot === 'home' ? 'home_team_id' : 'away_team_id';

      const { error } = await supabase
        .from('matches')
        .update({ [updateField]: modalData.teamId })
        .eq('id', modalData.matchId);

      if (error) throw error;

      // Reload data to show changes
      setModalData(null);
      onDataChanged?.();
    } catch (err) {
      console.error('Error updating match:', err);
      alert('Failed to update match');
    } finally {
      setIsUpdating(false);
    }
  };

  const applyTeamToAllGames = async () => {
    if (!modalData) return;

    setIsUpdating(true);
    try {
      const updateField = modalData.slot === 'home' ? 'home_team_id' : 'away_team_id';
      const metadataField = modalData.slot === 'home' ? 'homeSlot' : 'awaySlot';

      // Find the current match to get the slot pattern
      const match = matches.find(m => m.id === modalData.matchId);
      if (!match) return;

      const slotPattern = match.metadata?.[metadataField];

      if (!slotPattern) {
        // Fallback to old behavior if no metadata
        const searchField = modalData.slot === 'home' ? 'home_team_id' : 'away_team_id';
        const oldTeamId = modalData.slot === 'home' ? match.home_team_id : match.away_team_id;

        let query = supabase
          .from('matches')
          .update({ [updateField]: modalData.teamId })
          .eq('league_id', leagueId)
          .eq('season_number', seasonNumber);

        if (oldTeamId) {
          query = query.eq(searchField, oldTeamId);
        } else {
          query = query.is(searchField, null);
        }

        const { error } = await query;
        if (error) throw error;
      } else {
        // Find ALL matches where this team slot appears (could be home OR away)
        // This ensures we populate both home and away games for the team
        const matchesToUpdate = matches.filter(m =>
          m.metadata?.homeSlot === slotPattern || m.metadata?.awaySlot === slotPattern
        );

        const warnings: string[] = [];

        for (const matchToUpdate of matchesToUpdate) {
          // Determine which field to update based on where the slot pattern appears in THIS match
          let fieldToUpdate: 'home_team_id' | 'away_team_id';
          let oppositeField: 'home_team_id' | 'away_team_id';

          if (matchToUpdate.metadata?.homeSlot === slotPattern) {
            fieldToUpdate = 'home_team_id';
            oppositeField = 'away_team_id';
          } else {
            fieldToUpdate = 'away_team_id';
            oppositeField = 'home_team_id';
          }

          // Check if this would create a team playing itself
          const oppositeTeamId = matchToUpdate[oppositeField];

          if (oppositeTeamId === modalData.teamId) {
            warnings.push(`Skipped Round ${matchToUpdate.week_number} - would create ${modalData.teamName} vs ${modalData.teamName}`);
            continue; // Skip this match
          }

          const { error } = await supabase
            .from('matches')
            .update({ [fieldToUpdate]: modalData.teamId })
            .eq('id', matchToUpdate.id);

          if (error) throw error;
        }

        if (warnings.length > 0) {
          alert('Some matches were skipped:\n\n' + warnings.join('\n') + '\n\nA team cannot play against itself.');
        }
      }

      // Reload data to show changes
      setModalData(null);
      onDataChanged?.();
    } catch (err) {
      console.error('Error updating matches:', err);
      alert('Failed to update matches');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVenueDrop = async (matchId: string, e: React.DragEvent) => {
    e.preventDefault();
    const venueId = e.dataTransfer.getData('venueId');
    const venueName = e.dataTransfer.getData('venueName');
    const pitchId = e.dataTransfer.getData('pitchId');
    const pitchName = e.dataTransfer.getData('pitchName');

    if (!venueId) return;

    setIsUpdating(true);
    try {
      // Get the match to check its current date and round
      const match = matches.find(m => m.id === matchId);
      if (!match) {
        console.error('Match not found');
        return;
      }

      // If a specific pitch was dragged, assign both venue and pitch
      // If just a venue was dragged, assign only the venue (pitch can be chosen later or randomly)
      const updateData: any = {
        venue_id: venueId,
      };

      if (pitchId) {
        updateData.pitch_id = pitchId;

        // Get venue availability for this pitch
        const venue = await getVenueAvailability(pitchId);

        // Determine the target date to use as starting point
        // We want just the DATE, not the time, so we can find the earliest available time on that date
        let targetDate: Date;
        if (match.scheduled_date) {
          // Match already has a date - extract just the date part, reset time to midnight
          targetDate = new Date(match.scheduled_date);
          targetDate.setHours(0, 0, 0, 0);
        } else {
          // Match doesn't have a date - check if other matches in the same round have dates
          const roundMatches = matches.filter(m =>
            m.week_number === match.week_number &&
            m.scheduled_date
          );

          if (roundMatches.length > 0) {
            // Use the date from another match in this round (just the date, not the time)
            const roundDate = new Date(roundMatches[0].scheduled_date!);
            targetDate = new Date(roundDate);
            targetDate.setHours(0, 0, 0, 0); // Reset to midnight to find earliest time for this date
          } else {
            // No matches in this round have dates - use today at midnight
            targetDate = new Date(new Date().setHours(0, 0, 0, 0));
          }
        }

        // Find the earliest time the venue is available on/after the target date
        const venueAvailableTime = findEarliestVenueTime(targetDate, venue);

        // Get all OTHER matches already assigned to this pitch (excluding current match)
        const pitchMatches = matches.filter(m =>
          m.id !== matchId &&
          m.pitch_id === pitchId &&
          m.scheduled_date
        );

        // Sort by scheduled time
        pitchMatches.sort((a, b) => {
          const dateA = new Date(a.scheduled_date!).getTime();
          const dateB = new Date(b.scheduled_date!).getTime();
          return dateA - dateB;
        });

        // Find the next available time slot after all existing matches at this pitch
        const gameDurationMinutes = 75; // Default game duration
        let proposedStartTime = venueAvailableTime;

        // Check if proposed time conflicts with any existing match
        for (const existingMatch of pitchMatches) {
          const existingStart = new Date(existingMatch.scheduled_date!);
          const existingEnd = new Date(existingStart.getTime() + gameDurationMinutes * 60000);

          // If our proposed time overlaps with this match, move it to after this match
          if (proposedStartTime < existingEnd && proposedStartTime >= existingStart) {
            proposedStartTime = new Date(existingEnd.getTime());
          }
        }

        // Update scheduled_date to the next available slot
        updateData.scheduled_date = proposedStartTime.toISOString();
      }

      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);

      if (error) throw error;

      // Reload data to show changes
      onDataChanged?.();
    } catch (err) {
      console.error('Error updating match venue:', err);
      alert('Failed to update match venue');
    } finally {
      setIsUpdating(false);
    }
  };

  const removeTeamFromSchedule = async (teamId: string) => {
    setIsUpdating(true);
    try {
      // Remove team from all home slots
      await supabase
        .from('matches')
        .update({ home_team_id: null })
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .eq('home_team_id', teamId);

      // Remove team from all away slots
      await supabase
        .from('matches')
        .update({ away_team_id: null })
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .eq('away_team_id', teamId);

      // Reload data to show changes
      onDataChanged?.();
    } catch (err) {
      console.error('Error removing team from schedule:', err);
      alert('Failed to remove team from schedule');
    } finally {
      setIsUpdating(false);
    }
  };

  const reorderRoundsByDate = async () => {
    try {
      // Get all matches for this season
      const { data: allMatches, error: fetchError } = await supabase
        .from('matches')
        .select('id, week_number, scheduled_date')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .order('scheduled_date');

      if (fetchError) throw fetchError;
      if (!allMatches || allMatches.length === 0) return;

      // Group by current week_number to get the earliest date per round
      const roundDates = new Map<number, Date>();
      allMatches.forEach(match => {
        if (match.scheduled_date && match.week_number) {
          const matchDate = new Date(match.scheduled_date);
          if (!roundDates.has(match.week_number) || matchDate < roundDates.get(match.week_number)!) {
            roundDates.set(match.week_number, matchDate);
          }
        }
      });

      // Sort rounds by their dates to create new week number mapping
      const sortedRounds = Array.from(roundDates.entries())
        .sort(([, dateA], [, dateB]) => dateA.getTime() - dateB.getTime());

      // Create mapping from old week number to new week number
      const weekMapping = new Map<number, number>();
      sortedRounds.forEach(([oldWeek], index) => {
        weekMapping.set(oldWeek, index + 1);
      });

      // Update all matches with new week numbers
      for (const match of allMatches) {
        if (match.week_number && weekMapping.has(match.week_number)) {
          const newWeekNumber = weekMapping.get(match.week_number)!;
          if (newWeekNumber !== match.week_number) {
            const { error } = await supabase
              .from('matches')
              .update({ week_number: newWeekNumber })
              .eq('id', match.id);

            if (error) throw error;
          }
        }
      }
    } catch (err) {
      console.error('Error reordering rounds:', err);
      // Don't throw - this is a nice-to-have feature
    }
  };

  // Helper function to get venue availability for a specific pitch
  const getVenueAvailability = async (pitchId: string) => {
    const { data: pitch, error: pitchError } = await supabase
      .from('pitches')
      .select(`
        id,
        venue_id,
        venues!pitches_venue_id_fkey(
          id,
          use_specific_dates,
          availability_start_datetime,
          availability_end_datetime,
          is_recurring,
          recurrence_type,
          recurrence_days,
          specific_dates
        )
      `)
      .eq('id', pitchId)
      .single();

    if (pitchError || !pitch) return null;
    return pitch.venues;
  };

  // Helper function to find earliest available time for a venue on/after a target date
  const findEarliestVenueTime = (targetDate: Date, venue: any): Date => {
    console.log('[findEarliestVenueTime] Input:', {
      targetDate: targetDate.toISOString(),
      venueUseSpecificDates: venue?.use_specific_dates,
      venueIsRecurring: venue?.is_recurring,
      venueRecurrenceType: venue?.recurrence_type,
      venueAvailabilityStart: venue?.availability_start_datetime
    });

    if (!venue) {
      console.log('[findEarliestVenueTime] No venue, returning targetDate');
      return new Date(targetDate);
    }

    if (venue.use_specific_dates && venue.specific_dates) {
      // Check specific dates
      const specificDates = venue.specific_dates as Array<{ date: string; start_time?: string }>;
      for (const dateEntry of specificDates) {
        const venueDate = new Date(dateEntry.date);
        if (dateEntry.start_time) {
          const [hours, minutes] = dateEntry.start_time.split(':');
          venueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }
        if (venueDate >= targetDate) {
          console.log('[findEarliestVenueTime] Using specific date:', venueDate.toISOString());
          return venueDate;
        }
      }
    } else if (venue.is_recurring && venue.recurrence_type === 'weekly' && venue.recurrence_days) {
      // Check recurring weekly availability
      const recurrenceDays = venue.recurrence_days as number[];
      const startTime = venue.availability_start_datetime ? new Date(venue.availability_start_datetime) : null;

      // Find the next occurrence of a valid day of week
      for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
        const checkDate = new Date(targetDate);
        checkDate.setDate(checkDate.getDate() + daysAhead);
        const dayOfWeek = checkDate.getDay();

        if (recurrenceDays.includes(dayOfWeek)) {
          if (startTime) {
            checkDate.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
          }
          if (checkDate >= targetDate) {
            console.log('[findEarliestVenueTime] Using recurring weekly:', checkDate.toISOString());
            return checkDate;
          }
        }
      }
    } else if (venue.availability_start_datetime) {
      // Simple date range availability
      const venueStart = new Date(venue.availability_start_datetime);
      const targetOnSameDay = new Date(targetDate);
      targetOnSameDay.setHours(venueStart.getHours(), venueStart.getMinutes(), 0, 0);

      console.log('[findEarliestVenueTime] Simple date range check:', {
        venueStartTime: venueStart.toISOString(),
        targetOnSameDay: targetOnSameDay.toISOString(),
        isValid: targetOnSameDay >= targetDate
      });

      if (targetOnSameDay >= targetDate) {
        console.log('[findEarliestVenueTime] Using simple date range:', targetOnSameDay.toISOString());
        return targetOnSameDay;
      }
    }

    console.log('[findEarliestVenueTime] Fallback to targetDate:', targetDate.toISOString());
    return new Date(targetDate);
  };

  const handleManualDateSave = async (date: Date) => {
    if (!manualDateModal) return;

    const roundNumber = manualDateModal.roundNumber;

    setIsUpdating(true);
    try {
      // Get all matches in this round
      const roundMatches = rounds.get(roundNumber) || [];
      if (roundMatches.length === 0) return;

      // Load season settings to get game duration
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('game_duration_minutes')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .single();

      if (seasonError) throw seasonError;

      const gameDurationMinutes = seasonData?.game_duration_minutes || 75;

      // Check if manual date is in the past
      const now = new Date();
      if (date < now) {
        const shouldContinue = confirm(
          `Warning: The selected date (${date.toLocaleString()}) is in the past.\n\nDo you want to continue anyway?`
        );
        if (!shouldContinue) {
          setIsUpdating(false);
          return;
        }
      }

      // Group matches by pitch to calculate staggered start times
      const matchesByPitch = new Map<string, Match[]>();
      const matchesWithoutPitch: Match[] = [];

      roundMatches.forEach((match) => {
        if (match.pitch_id) {
          if (!matchesByPitch.has(match.pitch_id)) {
            matchesByPitch.set(match.pitch_id, []);
          }
          matchesByPitch.get(match.pitch_id)!.push(match);
        } else {
          matchesWithoutPitch.push(match);
        }
      });

      // Calculate start times for each match
      const updates: Array<{ matchId: string; startTime: Date }> = [];

      // Matches without assigned pitches all get the base time
      matchesWithoutPitch.forEach((match) => {
        updates.push({
          matchId: match.id,
          startTime: new Date(date),
        });
      });

      // Matches on same pitch get staggered times, considering venue availability
      for (const [pitchId, pitchMatches] of matchesByPitch.entries()) {
        // Get venue availability for this pitch
        const venue = await getVenueAvailability(pitchId);

        // Find the earliest time the venue is available on/after the target date
        const venueAvailableTime = findEarliestVenueTime(date, venue);

        for (let i = 0; i < pitchMatches.length; i++) {
          const match = pitchMatches[i];
          const startTime = calculateGameStartTime(venueAvailableTime, i, gameDurationMinutes);

          updates.push({
            matchId: match.id,
            startTime,
          });
        }
      }

      // Update all matches with calculated times
      for (const update of updates) {
        const { error } = await supabase
          .from('matches')
          .update({ scheduled_date: update.startTime.toISOString() })
          .eq('id', update.matchId);

        if (error) throw error;
      }

      // Reorder rounds by date to keep them sequential
      await reorderRoundsByDate();

      // Reload data to show changes
      onDataChanged?.();
    } catch (err) {
      console.error('Error updating match dates:', err);
      alert('Failed to update match dates');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApplyDateToAllRounds = async (baseDate: Date) => {
    if (!manualDateModal) return;

    setIsUpdating(true);
    try {
      // Load season settings to get spacing between rounds
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('game_duration_minutes')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .single();

      if (seasonError) throw seasonError;

      const gameDurationMinutes = seasonData?.game_duration_minutes || 75;

      // Default to weekly spacing (7 days)
      const daysBetweenRounds = 7;

      // Apply the date to all rounds, incrementing by the spacing and checking venue availability
      for (const [roundNumber, roundMatches] of rounds.entries()) {
        if (roundMatches.length === 0) continue;

        // Calculate the target date for this round (base + (roundNumber - 1) * spacing)
        const roundDate = new Date(baseDate);
        roundDate.setDate(roundDate.getDate() + (roundNumber - 1) * daysBetweenRounds);

        // Group matches by pitch to calculate staggered start times
        const matchesByPitch = new Map<string, Match[]>();
        const matchesWithoutPitch: Match[] = [];

        roundMatches.forEach((match) => {
          if (match.pitch_id) {
            if (!matchesByPitch.has(match.pitch_id)) {
              matchesByPitch.set(match.pitch_id, []);
            }
            matchesByPitch.get(match.pitch_id)!.push(match);
          } else {
            matchesWithoutPitch.push(match);
          }
        });

        // Calculate start times for each match
        const updates: Array<{ matchId: string; startTime: Date }> = [];

        // Matches without assigned pitches all get the base time
        matchesWithoutPitch.forEach((match) => {
          updates.push({
            matchId: match.id,
            startTime: new Date(roundDate),
          });
        });

        // Matches on same pitch get staggered times, considering venue availability
        for (const [pitchId, pitchMatches] of matchesByPitch.entries()) {
          // Get venue availability for this specific pitch
          const venue = await getVenueAvailability(pitchId);

          // Find the earliest time this venue is available on/after the target date
          const venueAvailableTime = findEarliestVenueTime(roundDate, venue);

          for (let i = 0; i < pitchMatches.length; i++) {
            const match = pitchMatches[i];
            const startTime = calculateGameStartTime(venueAvailableTime, i, gameDurationMinutes);

            updates.push({
              matchId: match.id,
              startTime,
            });
          }
        }

        // Update all matches in this round with calculated times
        for (const update of updates) {
          const { error } = await supabase
            .from('matches')
            .update({ scheduled_date: update.startTime.toISOString() })
            .eq('id', update.matchId);

          if (error) throw error;
        }
      }

      // Reorder rounds by date to keep them sequential
      await reorderRoundsByDate();

      // Close modal and reload data
      setManualDateModal(null);
      onDataChanged?.();
    } catch (err) {
      console.error('Error applying date to all rounds:', err);
      alert('Failed to apply date to all rounds');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleManualTimeSave = async (date: Date) => {
    if (!manualTimeModal) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('matches')
        .update({ scheduled_date: date.toISOString() })
        .eq('id', manualTimeModal.matchId);

      if (error) throw error;

      setManualTimeModal(null);
      onDataChanged?.();
    } catch (err) {
      console.error('Error updating match time:', err);
      alert('Failed to update match time');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMatchDrop = async (targetRoundNumber: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRound(null);

    const matchId = e.dataTransfer.getData('matchId');
    if (!matchId) return;

    const match = matches.find(m => m.id === matchId);
    if (!match || match.week_number === targetRoundNumber) return;

    setIsUpdating(true);
    try {
      // Get the date from another match in the target round (if any)
      const targetRoundMatches = rounds.get(targetRoundNumber) || [];
      let targetDate: string | null = null;

      if (targetRoundMatches.length > 0 && targetRoundMatches[0]?.scheduled_date) {
        // Use the date from an existing match in the target round
        const existingDate = new Date(targetRoundMatches[0].scheduled_date);
        existingDate.setHours(0, 0, 0, 0);
        targetDate = existingDate.toISOString();
      }

      // Update the match's week_number (and optionally the date)
      const updateData: any = { week_number: targetRoundNumber };
      if (targetDate) {
        updateData.scheduled_date = targetDate;
      }

      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);

      if (error) throw error;

      // Reload data to show changes
      onDataChanged?.();
    } catch (err) {
      console.error('Error moving match:', err);
      alert('Failed to move match');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNewGameDrop = async (roundNumber: number, gameType: 'fixture' | 'friendly', isNewRound: boolean = false) => {
    setIsUpdating(true);
    try {
      // Get the highest match number to determine the next one
      const { data: existingMatches, error: fetchError } = await supabase
        .from('matches')
        .select('match_number')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .order('match_number', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const nextMatchNumber = existingMatches && existingMatches.length > 0
        ? existingMatches[0].match_number + 1
        : 1;

      // Get the date from the target round if adding to existing round
      let targetDate: string | null = null;
      if (!isNewRound) {
        const targetRoundMatches = rounds.get(roundNumber) || [];
        if (targetRoundMatches.length > 0 && targetRoundMatches[0]?.scheduled_date) {
          const existingDate = new Date(targetRoundMatches[0].scheduled_date);
          existingDate.setHours(0, 0, 0, 0);
          targetDate = existingDate.toISOString();
        }
      }

      if (!isNewRound) {
        // Adding to an existing round - just add the game to that round
        const newMatch: any = {
          league_id: leagueId,
          season_number: seasonNumber,
          match_number: nextMatchNumber,
          week_number: roundNumber,
          match_type: gameType === 'fixture' ? 'regular' : 'friendly',
          metadata: {
            homeSlot: `Home Team`,
            awaySlot: `Away Team`,
            matchType: gameType === 'fixture' ? 'regular' : 'friendly',
            roundLabel: gameType === 'friendly' ? 'Friendly' : undefined,
          },
        };

        if (targetDate) {
          newMatch.scheduled_date = targetDate;
        }

        const { error: insertError } = await supabase
          .from('matches')
          .insert(newMatch);

        if (insertError) throw insertError;
      } else {
        // Creating a new round between existing rounds
        if (gameType === 'fixture') {
          // Fixture: Increment week_number for all matches at or after the target round
          const { data: allMatches, error: allMatchesError } = await supabase
            .from('matches')
            .select('id, week_number')
            .eq('league_id', leagueId)
            .eq('season_number', seasonNumber)
            .gte('week_number', roundNumber)
            .order('week_number', { ascending: true });

          if (allMatchesError) throw allMatchesError;

          // Update all affected matches to increment their week_number
          for (const match of allMatches || []) {
            const { error: updateError } = await supabase
              .from('matches')
              .update({ week_number: match.week_number + 1 })
              .eq('id', match.id);

            if (updateError) throw updateError;
          }

          // Create the new fixture in the new round
          const newMatch: any = {
            league_id: leagueId,
            season_number: seasonNumber,
            match_number: nextMatchNumber,
            week_number: roundNumber,
            match_type: 'regular',
            metadata: {
              homeSlot: `Home Team`,
              awaySlot: `Away Team`,
              matchType: 'regular',
            },
          };

          const { error: insertError } = await supabase
            .from('matches')
            .insert(newMatch);

          if (insertError) throw insertError;
        } else {
          // Friendly: Create a new round but don't renumber other rounds
          // Get the highest week_number to create a new round after all existing rounds
          const { data: allMatches, error: allMatchesError } = await supabase
            .from('matches')
            .select('week_number')
            .eq('league_id', leagueId)
            .eq('season_number', seasonNumber)
            .order('week_number', { ascending: false })
            .limit(1);

          if (allMatchesError) throw allMatchesError;

          const newWeekNumber = allMatches && allMatches.length > 0
            ? allMatches[0].week_number + 1
            : 1;

          const newMatch: any = {
            league_id: leagueId,
            season_number: seasonNumber,
            match_number: nextMatchNumber,
            week_number: newWeekNumber,
            match_type: 'friendly',
            metadata: {
              homeSlot: `Home Team`,
              awaySlot: `Away Team`,
              matchType: 'friendly',
              roundLabel: 'Friendly',
            },
          };

          const { error: insertError } = await supabase
            .from('matches')
            .insert(newMatch);

          if (insertError) throw insertError;
        }
      }

      // Reload data to show changes
      onDataChanged?.();
    } catch (err) {
      console.error('Error adding new game:', err);
      alert('Failed to add new game');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBetweenRoundsDrop = async (beforeRoundNumber: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverBetweenRounds(null);

    const newGameType = e.dataTransfer.getData('newGameType');
    if (newGameType) {
      // Creating a new round between existing rounds
      await handleNewGameDrop(beforeRoundNumber, newGameType as 'fixture' | 'friendly', true);
      return;
    }
  };

  const handleDateScheduleDrop = async (roundNumber: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRound(null);

    // Check if it's a new game type being added
    const newGameType = e.dataTransfer.getData('newGameType');
    if (newGameType) {
      await handleNewGameDrop(roundNumber, newGameType as 'fixture' | 'friendly', false);
      return;
    }

    const dateScheduleData = e.dataTransfer.getData('dateScheduleData');
    if (!dateScheduleData) {
      // If no date schedule data, check if it's a match being dragged
      handleMatchDrop(roundNumber, e);
      return;
    }

    const schedule = JSON.parse(dateScheduleData);

    setIsUpdating(true);
    try {
      // Get all matches in this round
      const roundMatches = rounds.get(roundNumber) || [];
      if (roundMatches.length === 0) return;

      // Load season settings to get game duration
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('game_duration_minutes')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .single();

      if (seasonError) throw seasonError;

      const gameDurationMinutes = seasonData?.game_duration_minutes || 75;

      // Calculate the base date for this round
      // For round 1, use the schedule directly
      // For round 2+, we need to get the previous round's date
      let calculatedDate: Date | null = null;

      if (roundNumber === 1) {
        calculatedDate = calculateRoundDate(schedule, roundNumber);
      } else {
        // Get the previous round's first match date
        const previousRoundMatches = rounds.get(roundNumber - 1) || [];
        const previousRoundDate = previousRoundMatches[0]?.scheduled_date
          ? new Date(previousRoundMatches[0].scheduled_date)
          : null;

        if (previousRoundDate) {
          calculatedDate = calculateRoundDate(schedule, roundNumber, previousRoundDate);
        } else {
          // If no previous round date, calculate as if it's the first round
          calculatedDate = calculateRoundDate(schedule, roundNumber);
        }
      }

      if (!calculatedDate) {
        alert('Could not calculate date from schedule rules. Check the browser console for details.');
        return;
      }

      // Check if calculated date is in the past
      const now = new Date();
      if (calculatedDate < now) {
        const shouldContinue = confirm(
          `Warning: The calculated date (${calculatedDate.toLocaleString()}) is in the past.\n\nDo you want to continue anyway?`
        );
        if (!shouldContinue) {
          setIsUpdating(false);
          return;
        }
      }

      // Load all venues with availability data for validation
      const uniqueVenueIds = [...new Set(roundMatches.filter(m => m.venue_id).map(m => m.venue_id))];
      const venueAvailability = new Map<string, any>();

      if (uniqueVenueIds.length > 0) {
        const { data: venues, error: venueError } = await supabase
          .from('venues')
          .select('*')
          .in('id', uniqueVenueIds);

        if (!venueError && venues) {
          venues.forEach(venue => {
            venueAvailability.set(venue.id, venue);
          });
        }
      }

      // Group matches by pitch to calculate staggered start times
      const matchesByPitch = new Map<string, Match[]>();
      const matchesWithoutPitch: Match[] = [];

      roundMatches.forEach((match) => {
        if (match.pitch_id) {
          if (!matchesByPitch.has(match.pitch_id)) {
            matchesByPitch.set(match.pitch_id, []);
          }
          matchesByPitch.get(match.pitch_id)!.push(match);
        } else {
          matchesWithoutPitch.push(match);
        }
      });

      // Calculate start times for each match
      const updates: Array<{ matchId: string; startTime: Date }> = [];
      const warnings: string[] = [];

      // Matches without assigned pitches all get the base time
      matchesWithoutPitch.forEach((match) => {
        updates.push({
          matchId: match.id,
          startTime: new Date(calculatedDate),
        });
      });

      // Matches on same pitch get staggered times
      for (const [pitchId, pitchMatches] of matchesByPitch.entries()) {
        // Get venue availability for this pitch's venue
        const firstMatch = pitchMatches[0];
        const venue = firstMatch.venue_id ? venueAvailability.get(firstMatch.venue_id) : null;

        for (let i = 0; i < pitchMatches.length; i++) {
          const match = pitchMatches[i];
          const startTime = calculateGameStartTime(calculatedDate, i, gameDurationMinutes);
          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + gameDurationMinutes);

          updates.push({
            matchId: match.id,
            startTime,
          });

          // Check if this exceeds venue availability
          if (venue && venue.availability_start_datetime && venue.availability_end_datetime) {
            const venueStart = new Date(venue.availability_start_datetime);
            const venueEnd = new Date(venue.availability_end_datetime);

            // Check if game is outside venue availability window
            if (startTime < venueStart || endTime > venueEnd) {
              const venueName = match.venue?.name || 'Unknown Venue';
              const pitchName = match.pitch?.name || 'Unknown Pitch';
              warnings.push(
                `⚠️ Game ${i + 1} on ${venueName} - ${pitchName} exceeds venue availability!\n` +
                `   Game: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}\n` +
                `   Venue: ${venueStart.toLocaleTimeString()} - ${venueEnd.toLocaleTimeString()}`
              );
            }
          }
        }

        // Additional warning if games span a long time
        if (pitchMatches.length > 1) {
          const lastGameIndex = pitchMatches.length - 1;
          const lastGameStart = calculateGameStartTime(calculatedDate, lastGameIndex, gameDurationMinutes);
          const lastGameEnd = new Date(lastGameStart);
          lastGameEnd.setMinutes(lastGameEnd.getMinutes() + gameDurationMinutes);

          const hoursDiff = (lastGameEnd.getTime() - calculatedDate.getTime()) / (1000 * 60 * 60);
          if (hoursDiff > 12) {
            const venueName = firstMatch.venue?.name || 'Unknown Venue';
            const pitchName = firstMatch.pitch?.name || 'Unknown Pitch';
            warnings.push(`⏰ ${pitchMatches.length} games on ${venueName} - ${pitchName} span ${hoursDiff.toFixed(1)} hours`);
          }
        }
      }

      // Update all matches with calculated times
      for (const update of updates) {
        const { error } = await supabase
          .from('matches')
          .update({ scheduled_date: update.startTime.toISOString() })
          .eq('id', update.matchId);

        if (error) throw error;
      }

      // Now reorder rounds by date to keep them sequential
      await reorderRoundsByDate();

      // Show warnings if any, then reload data
      if (warnings.length > 0) {
        alert('Dates updated with warnings:\n\n' + warnings.join('\n'));
      }

      // Reload data to show changes
      onDataChanged?.();
    } catch (err) {
      console.error('Error updating match dates:', err);
      alert('Failed to update match dates');
    } finally {
      setIsUpdating(false);
    }
  };

  const [pendingSolution, setPendingSolution] = useState<any>(null);

  const handleSolutionDrop = async (matchId: string, solutionId: string) => {
    if (!pendingSolution) {
      console.error('No pending solution found');
      return;
    }

    setIsUpdating(true);
    try {
      // Apply each change in the solution
      for (const change of pendingSolution.changes) {
        const { error } = await supabase
          .from('matches')
          .update({ [change.field]: change.newValue })
          .eq('id', change.matchId);

        if (error) throw error;
      }

      // Clear highlighted matches and reload data
      setHighlightedMatches([]);
      setPendingSolution(null);
      onDataChanged?.();

      alert(`Solution applied successfully: ${pendingSolution.description}`);
    } catch (err) {
      console.error('Error applying solution:', err);
      alert('Failed to apply solution');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBlackoutDrop = async (matchId: string, blackoutId: string) => {
    setIsUpdating(true);
    try {
      // Find the blackout date
      const blackout = blackoutDates.find(b => b.id === blackoutId);
      if (!blackout) {
        alert('Blackout date not found');
        return;
      }

      // Find the match
      const match = matches.find(m => m.id === matchId);
      if (!match || !match.scheduled_date) {
        alert('Match or scheduled date not found');
        return;
      }

      // Check if match is actually affected by this blackout
      const matchDate = new Date(match.scheduled_date);
      const matchDateStr = matchDate.toDateString();

      // Determine if blackout applies to this match
      let appliesToMatch = false;
      if (blackout.applies_to === 'league') {
        appliesToMatch = true;
      } else if (blackout.applies_to === 'venues' && blackout.venue_ids) {
        appliesToMatch = match.venue_id ? blackout.venue_ids.includes(match.venue_id) : false;
      } else if (blackout.applies_to === 'pitches' && blackout.pitch_ids) {
        appliesToMatch = match.pitch_id ? blackout.pitch_ids.includes(match.pitch_id) : false;
      }

      if (!appliesToMatch) {
        alert('This blackout does not apply to this match');
        return;
      }

      // Find the next available date (within +/- 7 days)
      let newDate: Date | null = null;
      for (let dayOffset = 1; dayOffset <= 7 && !newDate; dayOffset++) {
        // Try future dates first
        const futureDate = new Date(matchDate);
        futureDate.setDate(matchDate.getDate() + dayOffset);

        // Check if future date is not blacked out
        const isBlackedOut = blackoutDates.some(b => {
          if (b.blackout_type === 'single_date' && b.start_date) {
            return futureDate.toDateString() === new Date(b.start_date).toDateString();
          } else if (b.blackout_type === 'date_range' && b.start_date && b.end_date) {
            const start = new Date(b.start_date);
            const end = new Date(b.end_date);
            return futureDate >= start && futureDate <= end;
          }
          return false;
        });

        if (!isBlackedOut) {
          newDate = futureDate;
          break;
        }

        // Try past dates
        const pastDate = new Date(matchDate);
        pastDate.setDate(matchDate.getDate() - dayOffset);

        const isPastBlackedOut = blackoutDates.some(b => {
          if (b.blackout_type === 'single_date' && b.start_date) {
            return pastDate.toDateString() === new Date(b.start_date).toDateString();
          } else if (b.blackout_type === 'date_range' && b.start_date && b.end_date) {
            const start = new Date(b.start_date);
            const end = new Date(b.end_date);
            return pastDate >= start && pastDate <= end;
          }
          return false;
        });

        if (!isPastBlackedOut) {
          newDate = pastDate;
          break;
        }
      }

      if (!newDate) {
        alert('Could not find a suitable alternative date within 7 days');
        return;
      }

      // Update the match with the new date
      const { error } = await supabase
        .from('matches')
        .update({ scheduled_date: newDate.toISOString() })
        .eq('id', matchId);

      if (error) throw error;

      // Reload data
      onDataChanged?.();

      alert(`Match rescheduled to ${newDate.toLocaleDateString()} to avoid blackout: ${blackout.name}`);
    } catch (err) {
      console.error('Error applying blackout:', err);
      alert('Failed to reschedule match');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOptimizationDrop = async (
    scope: OptimizationScope,
    e: React.DragEvent
  ) => {
    e.preventDefault();
    const optimizationType = e.dataTransfer.getData('optimizationType') as OptimizationType;

    if (!optimizationType || !pendingOptimization) {
      console.error('No optimization type found');
      return;
    }

    // IMPORTANT: Reload constraint solver data to pick up any venue/date/team changes
    console.log('[handleOptimizationDrop] Reloading constraint solver data before optimization...');
    const freshData = await loadConstraintSolverData();

    if (!freshData) {
      console.error('[handleOptimizationDrop] Failed to load constraint solver data');
      alert('Failed to load venue/team data. Please try again.');
      return;
    }

    // Store original matches for revert functionality
    setOriginalMatches([...matches]);

    // Run optimization with FRESH data (not stale state)
    const optimizer = new ScheduleOptimizer(
      matches,
      freshData.venues,
      freshData.teams,
      freshData.season,
      freshData.dateSchedules,
      freshData.blackoutDates
    );

    try {
      console.log('[handleOptimizationDrop] Running optimization:', {
        optimizationType,
        scope,
        matchCount: matches.length,
        venueCount: freshData.venues.length,
        venues: freshData.venues.map(v => ({
          id: v.id,
          name: v.name,
          availability_start: v.availability_start_datetime,
          availability_end: v.availability_end_datetime,
          pitches: v.pitches?.length || 0
        })),
        dateSchedules: freshData.dateSchedules.length,
        season: {
          game_duration: freshData.season?.game_duration_minutes,
          start_date: freshData.season?.start_date,
          end_date: freshData.season?.end_date
        }
      });
      const result = optimizer.optimize(optimizationType, scope);
      console.log('[handleOptimizationDrop] Optimization result:', { changes: result.changes.length, firstFewChanges: result.changes.slice(0, 3) });

      // Enrich optimized matches with nested objects for proper display
      const enrichedMatches = enrichPreviewMatches(result.matches as any[], freshData.venues, freshData.teams);

      // Enter preview mode - show optimized matches in UI
      setPreviewMode(true);
      setPreviewChanges(result.changes);
      setPreviewMatches(enrichedMatches);
      setCurrentOptimization(optimizationType);

      // Show preview - we'll apply to local state first
      alert(
        `Preview: ${result.changes.length} changes will be made.\n\n` +
        `Click "Accept" to save, "Regenerate" to try again, or "Revert" to cancel.`
      );
    } catch (err) {
      console.error('Error running optimization:', err);
      alert(`Failed to run optimization: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAcceptOptimization = async () => {
    console.log('[handleAcceptOptimization] Called with changes:', previewChanges.length);
    if (previewChanges.length === 0) {
      console.log('[handleAcceptOptimization] No changes to apply, returning');
      return;
    }

    setIsUpdating(true);
    try {
      console.log('[handleAcceptOptimization] Applying changes to database...');

      // Group changes by match ID to batch updates
      const changesByMatch = new Map<string, Record<string, any>>();
      for (const change of previewChanges) {
        if (!changesByMatch.has(change.matchId)) {
          changesByMatch.set(change.matchId, {});
        }
        changesByMatch.get(change.matchId)![change.field] = change.newValue;
      }

      // Apply all changes for each match in a single update
      // NOTE: We only update the specific fields that changed, Supabase should preserve other fields
      for (const [matchId, updates] of changesByMatch.entries()) {
        console.log('[handleAcceptOptimization] Updating match:', matchId, 'fields:', Object.keys(updates));
        const { error } = await supabase
          .from('matches')
          .update(updates)
          .eq('id', matchId);

        if (error) {
          console.error('[handleAcceptOptimization] Update failed for match:', matchId, error);
          throw error;
        }
      }

      console.log('[handleAcceptOptimization] All changes applied successfully');
      // Exit preview mode and reload data
      setPreviewMode(false);
      setPreviewChanges([]);
      setPreviewMatches([]);
      setOriginalMatches([]);
      setCurrentOptimization(null);
      onDataChanged?.();

      alert('Optimization applied successfully!');
    } catch (err) {
      console.error('Error applying optimization:', err);
      alert('Failed to apply optimization');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRegenerateOptimization = async () => {
    if (!currentOptimization) return;

    // Reload constraint solver data to pick up any changes
    console.log('[handleRegenerateOptimization] Reloading constraint solver data...');
    const freshData = await loadConstraintSolverData();

    if (!freshData) {
      console.error('[handleRegenerateOptimization] Failed to load constraint solver data');
      alert('Failed to load venue/team data. Please try again.');
      return;
    }

    // Re-run the same optimization from original matches
    // This allows shuffle to generate a new random result
    console.log('[handleRegenerateOptimization] Optimizing from original matches:', matches.length);

    const optimizer = new ScheduleOptimizer(
      matches,
      freshData.venues,
      freshData.teams,
      freshData.season,
      freshData.dateSchedules,
      freshData.blackoutDates
    );

    try {
      const scope: OptimizationScope = { type: 'season' }; // Default to season for regenerate
      const result = optimizer.optimize(currentOptimization, scope);

      console.log('[handleRegenerateOptimization] Generated', result.changes.length, 'changes');
      console.log('[handleRegenerateOptimization] First few changes:', result.changes.slice(0, 3));

      // Enrich optimized matches with nested objects for proper display
      const enrichedMatches = enrichPreviewMatches(result.matches as any[], freshData.venues, freshData.teams);

      // Clear preview first to force re-render, then set new preview
      setPreviewMatches([]);
      setPreviewChanges([]);

      // Use setTimeout to ensure state updates trigger re-render
      setTimeout(() => {
        setPreviewChanges(result.changes);
        setPreviewMatches(enrichedMatches);
        console.log('[handleRegenerateOptimization] Preview updated with', enrichedMatches.length, 'matches');
      }, 0);

      alert(
        `Regenerated: ${result.changes.length} changes will be made.\n\n` +
        `Click "Accept" to save, "Regenerate" to try again, or "Revert" to cancel.`
      );
    } catch (err) {
      console.error('Error regenerating optimization:', err);
      alert(`Failed to regenerate: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleRevertOptimization = () => {
    // Exit preview mode without saving
    setPreviewMode(false);
    setPreviewChanges([]);
    setPreviewMatches([]);
    setOriginalMatches([]);
    setCurrentOptimization(null);
  };

  return (
    <>
      <ApplyToAllModal
        isOpen={!!modalData}
        onClose={() => setModalData(null)}
        teamName={modalData?.teamName || ''}
        oldTeamName={modalData?.oldTeamName || null}
        onApplyToOne={applyTeamToOneGame}
        onApplyToAll={applyTeamToAllGames}
        isEmptySlot={modalData?.isEmptySlot || false}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        leagueId={leagueId}
        seasonNumber={seasonNumber}
      />

      <ManualDateModal
        isOpen={!!manualDateModal}
        onClose={() => setManualDateModal(null)}
        onSave={handleManualDateSave}
        onSaveToAll={handleApplyDateToAllRounds}
        roundNumber={manualDateModal?.roundNumber || 0}
        currentDate={manualDateModal?.currentDate}
      />

      <ManualTimeModal
        isOpen={!!manualTimeModal}
        onClose={() => setManualTimeModal(null)}
        onSave={handleManualTimeSave}
        matchNumber={manualTimeModal?.matchNumber || 0}
        currentDate={manualTimeModal?.currentDate}
      />

      <TeamScheduleModal
        isOpen={!!teamScheduleModal}
        onClose={() => setTeamScheduleModal(null)}
        teamId={teamScheduleModal?.teamId || ''}
        leagueId={leagueId}
        seasonNumber={seasonNumber}
        onRemoveFromSchedule={() => {
          if (teamScheduleModal?.teamId) {
            removeTeamFromSchedule(teamScheduleModal.teamId);
          }
        }}
      />

      <div className="flex gap-6 max-w-[1800px] mx-auto">
        {/* Left side: Schedule display */}
        <div className="flex-1 space-y-6">
        {/* Preview Mode Banner */}
        {previewMode && (
          <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-lg">👁️</span>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">
                  Preview Mode: {currentOptimization?.replace(/_/g, ' ').toUpperCase()}
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  {previewChanges.length} changes will be made. Review the changes below.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAcceptOptimization}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={handleRegenerateOptimization}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors disabled:opacity-50"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={handleRevertOptimization}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold transition-colors disabled:opacity-50"
                  >
                    Revert
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error/Warning Banner */}
        {validation.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-600 text-lg">⚠</span>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">
                  Cannot publish schedule - {validation.errors.length} error{validation.errors.length > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Fix all errors before sharing the schedule with players. Check the Schedule Checker for details.
                </p>
              </div>
            </div>
          </div>
        )}
        {validation.errors.length === 0 && validation.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 text-lg">⚡</span>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900">
                  {validation.warnings.length} warning{validation.warnings.length > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Schedule can be published, but some matches need attention. Check Schedule Checker for details.
                </p>
              </div>
            </div>
          </div>
        )}
        {validation.isValid && validation.warnings.length === 0 && matches.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-lg">✓</span>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900">Schedule is ready to publish</h3>
                <p className="text-sm text-green-700 mt-1">
                  No errors or warnings found. You can share this schedule with players.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Season-wide drop zone (visible when dragging optimization) */}
        {pendingOptimization && (
          <div
            className="h-20 flex items-center justify-center bg-purple-50 border-2 border-dashed border-purple-500 rounded-lg transition-colors hover:bg-purple-100"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('optimizationtype')) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              handleOptimizationDrop({ type: 'season' }, e);
            }}
          >
            <span className="text-sm text-purple-700 font-semibold">
              Drop here to regenerate ENTIRE SEASON
            </span>
          </div>
        )}

        {/* Rounds */}
        {sortedRounds.map(([roundNumber, roundMatches], index) => {
          const roundDate = roundMatches[0]?.scheduled_date
            ? new Date(roundMatches[0].scheduled_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : 'No date';

          return (
            <div key={roundNumber}>
              {/* Drop zone BEFORE this round (for creating new rounds) */}
              <div
                className={`h-12 flex items-center justify-center transition-colors ${
                  dragOverBetweenRounds === roundNumber
                    ? 'bg-blue-100 border-2 border-dashed border-blue-500 rounded-lg mb-3'
                    : 'h-0 overflow-hidden'
                }`}
                onDragOver={(e) => {
                  const newGameType = e.dataTransfer.types.includes('newgametype');
                  if (newGameType) {
                    e.preventDefault();
                    setDragOverBetweenRounds(roundNumber);
                  }
                }}
                onDragLeave={() => setDragOverBetweenRounds(null)}
                onDrop={(e) => handleBetweenRoundsDrop(roundNumber, e)}
              >
                {dragOverBetweenRounds === roundNumber && (
                  <span className="text-sm text-blue-600 font-semibold">Drop here to create new round</span>
                )}
              </div>

              <div className="space-y-3">
              {/* Round Header - Drop Zone for Date Schedules, Matches, and Optimizations */}
              <div
                className={`flex justify-between items-center p-3 rounded transition-colors border-2 ${
                  dragOverRound === roundNumber
                    ? 'bg-blue-100 border-blue-500'
                    : draggedMatch
                      ? 'border-dashed border-gray-300'
                      : 'border-transparent'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverRound(roundNumber);
                }}
                onDragLeave={() => setDragOverRound(null)}
                onDrop={(e) => {
                  // Check if it's an optimization being dropped
                  const optimizationType = e.dataTransfer.getData('optimizationType');
                  if (optimizationType) {
                    const roundMatchIds = roundMatches.map(m => m.id);
                    handleOptimizationDrop({ type: 'round', weekNumber: roundNumber, matchIds: roundMatchIds }, e);
                    return;
                  }

                  // Otherwise handle as date schedule or match drop
                  handleDateScheduleDrop(roundNumber, e);
                }}
              >
                <h3 className="text-lg font-bold text-gray-900">
                  {roundMatches[0]?.metadata?.roundLabel === 'Friendly' ? 'FRIENDLY' : `ROUND ${roundNumber}`}
                </h3>
                <button
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                  onClick={() => {
                    setManualDateModal({
                      roundNumber,
                      currentDate: roundMatches[0]?.scheduled_date,
                    });
                  }}
                >
                  {roundDate}
                </button>
              </div>

              {/* Game Cards */}
              <div className="space-y-2">
                {roundMatches.map((match, idx) => {
                  const homeTeamName = match.home_team?.name || match.metadata?.homeSlot || '[Empty]';
                  const awayTeamName = match.away_team?.name || match.metadata?.awaySlot || '[Empty]';

                  // Extract coach information from team_ownership
                  const homeTeamOwnership = Array.isArray(match.home_team?.team_ownership)
                    ? match.home_team?.team_ownership[0]
                    : match.home_team?.team_ownership;
                  const homeCoachName = (homeTeamOwnership as any)?.owner?.display_name || '[No Coach]';

                  const awayTeamOwnership = Array.isArray(match.away_team?.team_ownership)
                    ? match.away_team?.team_ownership[0]
                    : match.away_team?.team_ownership;
                  const awayCoachName = (awayTeamOwnership as any)?.owner?.display_name || '[No Coach]';

                  const isUnassigned = !match.home_team_id || !match.away_team_id;
                  const venueName = match.venue?.name || '[No Venue]';
                  const pitchName = match.pitch?.name;
                  const venueDisplay = pitchName ? `${venueName} - ${pitchName}` : venueName;

                  // Format start time
                  const startTime = match.scheduled_date
                    ? new Date(match.scheduled_date).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })
                    : '[No Time]';

                  // Get validation for this match
                  const matchIssues = getMatchValidation(match, matches);
                  const hasErrors = matchIssues.some(issue => issue.type === 'error');
                  const hasWarnings = matchIssues.some(issue => issue.type === 'warning');

                  return (
                    <div
                      key={match.id}
                      id={`match-${match.id}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('matchId', match.id);
                        setDraggedMatch(match.id);
                      }}
                      onDragEnd={() => {
                        setDraggedMatch(null);
                      }}
                      onDragOver={(e) => {
                        // Check if dragging a solution, optimization, or blackout
                        if (e.dataTransfer.types.includes('solutionid') || e.dataTransfer.types.includes('optimizationtype') || e.dataTransfer.types.includes('blackoutid')) {
                          e.preventDefault();
                        }
                      }}
                      onDrop={(e) => {
                        const solutionId = e.dataTransfer.getData('solutionId');
                        if (solutionId) {
                          handleSolutionDrop(match.id, solutionId);
                          return;
                        }

                        const blackoutId = e.dataTransfer.getData('blackoutId');
                        if (blackoutId) {
                          handleBlackoutDrop(match.id, blackoutId);
                          return;
                        }

                        const optimizationType = e.dataTransfer.getData('optimizationType');
                        if (optimizationType) {
                          handleOptimizationDrop({ type: 'match', matchIds: [match.id] }, e);
                        }
                      }}
                      className={`border rounded-lg p-4 relative cursor-move transition-all ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } ${
                        hasErrors ? 'border-red-300 border-2' : hasWarnings ? 'border-yellow-300' : ''
                      } ${
                        draggedMatch === match.id ? 'opacity-50' : ''
                      } ${
                        highlightedMatches.includes(match.id) ? 'ring-4 ring-blue-500 bg-blue-50' : ''
                      }`}
                    >
                      {/* Validation indicator badge */}
                      {hasErrors && (
                        <div className="absolute top-2 right-2 bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded">
                          ERROR
                        </div>
                      )}
                      {!hasErrors && hasWarnings && (
                        <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">
                          WARNING
                        </div>
                      )}
                      {/* Teams Row - Away @ Home */}
                      <div className="flex items-center gap-3 mb-3">
                        {/* Away Team (Left side) - Drop Zone */}
                        <div
                          className={`flex items-center gap-2 flex-1 p-2 rounded transition-colors ${
                            dragOverSlot?.matchId === match.id && dragOverSlot?.slot === 'away'
                              ? 'bg-blue-100 ring-2 ring-blue-500'
                              : ''
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverSlot({ matchId: match.id, slot: 'away' });
                          }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => handleTeamDrop(match.id, 'away', e)}
                        >
                          <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0">
                            ?
                          </div>
                          <div
                            className={`flex-1 min-w-0 ${match.away_team_id ? 'cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1' : ''}`}
                            onClick={(e) => {
                              if (match.away_team_id) {
                                e.stopPropagation();
                                setTeamScheduleModal({ teamId: match.away_team_id });
                              }
                            }}
                          >
                            <div className={`truncate ${isUnassigned ? 'italic text-gray-500' : 'font-semibold text-gray-900'}`}>
                              {awayTeamName}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{awayCoachName}</div>
                          </div>
                        </div>

                        {/* @ Symbol - Centered */}
                        <div className="text-2xl font-bold text-gray-400 flex-shrink-0 px-2">
                          @
                        </div>

                        {/* Home Team (Right side) - Drop Zone */}
                        <div
                          className={`flex items-center gap-2 flex-1 p-2 rounded transition-colors ${
                            dragOverSlot?.matchId === match.id && dragOverSlot?.slot === 'home'
                              ? 'bg-blue-100 ring-2 ring-blue-500'
                              : ''
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverSlot({ matchId: match.id, slot: 'home' });
                          }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => handleTeamDrop(match.id, 'home', e)}
                        >
                          <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0">
                            ?
                          </div>
                          <div
                            className={`flex-1 min-w-0 ${match.home_team_id ? 'cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1' : ''}`}
                            onClick={(e) => {
                              if (match.home_team_id) {
                                e.stopPropagation();
                                setTeamScheduleModal({ teamId: match.home_team_id });
                              }
                            }}
                          >
                            <div className={`truncate ${isUnassigned ? 'italic text-gray-500' : 'font-semibold text-gray-900'}`}>
                              {homeTeamName}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{homeCoachName}</div>
                          </div>
                        </div>
                      </div>

                      {/* Venue and Time - Drop Zone */}
                      <div
                        className="pt-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600 p-2 rounded transition-colors"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('bg-blue-100', 'ring-2', 'ring-blue-500');
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('bg-blue-100', 'ring-2', 'ring-blue-500');
                        }}
                        onDrop={(e) => {
                          e.currentTarget.classList.remove('bg-blue-100', 'ring-2', 'ring-blue-500');
                          handleVenueDrop(match.id, e);
                        }}
                      >
                        <span className={match.venue_id ? 'text-gray-900' : 'italic text-gray-500'}>
                          {venueDisplay}
                        </span>
                        <span
                          className={`${match.scheduled_date ? 'text-gray-900 font-medium cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : 'italic text-gray-500'}`}
                          onClick={(e) => {
                            if (match.scheduled_date) {
                              e.stopPropagation();
                              setManualTimeModal({
                                matchId: match.id,
                                matchNumber: match.match_number,
                                currentDate: match.scheduled_date
                              });
                            }
                          }}
                          title={match.scheduled_date ? 'Click to edit time' : undefined}
                        >
                          {startTime}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          );
        })}

        {/* Drop zone AFTER all rounds (for adding new round at the end) */}
        {sortedRounds.length > 0 && (
          <div
            className={`h-12 flex items-center justify-center transition-colors ${
              dragOverBetweenRounds === -1
                ? 'bg-blue-100 border-2 border-dashed border-blue-500 rounded-lg mt-3'
                : 'h-0 overflow-hidden'
            }`}
            onDragOver={(e) => {
              const newGameType = e.dataTransfer.types.includes('newgametype');
              if (newGameType) {
                e.preventDefault();
                setDragOverBetweenRounds(-1);
              }
            }}
            onDragLeave={() => setDragOverBetweenRounds(null)}
            onDrop={(e) => {
              const newGameType = e.dataTransfer.getData('newGameType');
              if (newGameType) {
                // Get the next round number (after all existing rounds)
                const maxRound = Math.max(...sortedRounds.map(([r]) => r));
                handleBetweenRoundsDrop(maxRound + 1, e);
              }
            }}
          >
            {dragOverBetweenRounds === -1 && (
              <span className="text-sm text-blue-600 font-semibold">Drop here to create new round</span>
            )}
          </div>
        )}

        {sortedRounds.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            No matches in schedule
          </div>
        )}
      </div>

      {/* Right Sidebar: Editing Tools */}
      <div className="w-80 bg-white rounded-lg shadow p-4 space-y-2 sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-4">EDIT THE SCHEDULE</h2>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors"
        >
          Settings
        </button>

        <button
          onClick={() => setActivePanel(activePanel === 'venues' ? null : 'venues')}
          className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors"
        >
          Venues
        </button>
        {activePanel === 'venues' && (
          <div className="pl-3 pb-2">
            <VenuesPanel leagueId={leagueId} />
          </div>
        )}

        <button
          onClick={() => setActivePanel(activePanel === 'dates' ? null : 'dates')}
          className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors"
        >
          Dates
        </button>
        {activePanel === 'dates' && (
          <div className="pl-3 pb-2">
            <DatesPanel leagueId={leagueId} seasonNumber={seasonNumber} />
          </div>
        )}

        <button
          onClick={() => setActivePanel(activePanel === 'teams' ? null : 'teams')}
          className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors"
        >
          Teams
        </button>
        {activePanel === 'teams' && (
          <div className="pl-3 pb-2">
            <TeamsPanel leagueId={leagueId} />
          </div>
        )}

        <button
          onClick={() => setActivePanel(activePanel === 'add-game' ? null : 'add-game')}
          className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors"
        >
          Add A Game
        </button>
        {activePanel === 'add-game' && (
          <AddGamePanel
            leagueId={leagueId}
            seasonNumber={seasonNumber}
            onGameAdded={onDataChanged}
          />
        )}

        <button
          onClick={() => setActivePanel(activePanel === 'checker' ? null : 'checker')}
          className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors"
        >
          Schedule Checker
          {validation.errors.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
              {validation.errors.length}
            </span>
          )}
          {validation.errors.length === 0 && validation.warnings.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
              {validation.warnings.length}
            </span>
          )}
        </button>
        {activePanel === 'checker' && (
          <div className="pl-3 pb-2">
            <ScheduleCheckerPanel
              matches={matches.map(m => {
                // Find full venue data from venues array
                const fullVenue = m.venue_id ? venues.find(v => v.id === m.venue_id) : null;
                return {
                  ...m,
                  home_team: m.home_team ? {
                    ...m.home_team,
                    coach_id: m.home_team.team_ownership?.[0]?.user_id || null,
                  } : null,
                  away_team: m.away_team ? {
                    ...m.away_team,
                    coach_id: m.away_team.team_ownership?.[0]?.user_id || null,
                  } : null,
                  venue: fullVenue ? {
                    name: fullVenue.name,
                    id: fullVenue.id,
                    availability_start_datetime: fullVenue.availability_start_datetime,
                    availability_end_datetime: fullVenue.availability_end_datetime,
                  } : null,
                  pitch: m.pitch ? {
                    ...m.pitch,
                    id: m.pitch_id || '',
                  } : null,
                };
              })}
              venues={venues}
              teams={teams}
              season={season || { schedule_preference: 'compact', game_duration_minutes: 75 }}
              blackoutDates={blackoutDates}
              onNavigateToMatch={(matchId) => {
                setHighlightedMatches([matchId]);
                // Scroll to the match
                const element = document.getElementById(`match-${matchId}`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              onSolutionDragStart={(solution) => {
                setPendingSolution(solution);
              }}
            />
          </div>
        )}

        <button
          onClick={() => setActivePanel(activePanel === 'playoffs' ? null : 'playoffs')}
          className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors"
        >
          Playoff Configurator
        </button>
        {activePanel === 'playoffs' && (
          <div className="pl-3 pb-2">
            <div className="text-sm text-gray-500 py-2">Playoff Configurator panel coming soon...</div>
          </div>
        )}

        <button
          onClick={() => setActivePanel(activePanel === 'regenerate' ? null : 'regenerate')}
          className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors"
        >
          Optimizer
        </button>
        {activePanel === 'regenerate' && (
          <div className="pl-3 pb-2">
            <ScheduleOptimizerPanel
              onOptimizationDragStart={(optimizationType) => {
                setPendingOptimization(optimizationType);
              }}
              disabled={previewMode}
            />
          </div>
        )}

        <button
          onClick={() => setActivePanel(activePanel === 'help' ? null : 'help')}
          className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium transition-colors"
        >
          How To
        </button>
        {activePanel === 'help' && (
          <div className="pl-3 pb-2">
            <div className="text-sm text-gray-500 py-2">How To panel coming soon...</div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
