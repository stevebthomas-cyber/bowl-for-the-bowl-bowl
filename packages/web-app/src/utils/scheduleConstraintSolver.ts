/**
 * Advanced Schedule Constraint Solver
 *
 * Detects conflicts and generates optimal solutions with lookahead to avoid cascading problems.
 *
 * Constraint Types:
 * 1. Temporal: Things happening at the same time that shouldn't
 * 2. Venue Availability: Games outside venue operating windows
 * 3. Coach Conflicts: Coach managing multiple teams at same time
 * 4. Team Conflicts: Team playing multiple games at same time
 * 5. Venue/Pitch Conflicts: Multiple games at same location/time
 *
 * Solution Weighting (least disruptive to most):
 * 1. Time changes within a match (weight: 1)
 * 2. Pitch changes at same venue (weight: 2)
 * 3. Coaching changes within a round (weight: 3)
 * 4. Venue changes (weight: 5)
 * 5. Combined changes (additive weights)
 * 6. Bye weeks (weight depends on schedule_preference)
 */

import { getHolidayDates, type Holiday } from './holidayApi';

export interface Match {
  id: string;
  match_number: number;
  home_team_id?: string | null;
  away_team_id?: string | null;
  venue_id?: string | null;
  pitch_id?: string | null;
  scheduled_date?: string | null;
  week_number?: number | null;
  match_type?: string | null;
  metadata?: any;
  home_team?: {
    name: string;
    id: string;
    coach_id?: string | null;
  } | null;
  away_team?: {
    name: string;
    id: string;
    coach_id?: string | null;
  } | null;
  venue?: {
    name: string;
    id: string;
    availability_start_datetime?: string | null;
    availability_end_datetime?: string | null;
  } | null;
  pitch?: {
    name: string;
    id: string;
  } | null;
}

export interface Venue {
  id: string;
  name: string;
  availability_start_datetime?: string | null;
  availability_end_datetime?: string | null;
  is_recurring?: boolean;
  recurrence_type?: string | null;
  recurrence_days?: string[] | null;  // Array of day names: ["Monday", "Wednesday", ...]
  use_specific_dates?: boolean;
  specific_dates?: any[] | null;
  pitches?: Pitch[];
}

export interface Pitch {
  id: string;
  venue_id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  coach_id?: string | null;
}

export interface Season {
  schedule_preference?: 'compact' | 'relaxed';
  game_duration_minutes?: number;
}

export interface BlackoutDate {
  id: string;
  name: string;
  applies_to: 'league' | 'venues' | 'pitches';
  venue_ids: string[] | null;
  pitch_ids: string[] | null;
  blackout_type: 'single_date' | 'date_range' | 'recurring' | 'holiday' | 'holiday_weekend';
  start_date: string | null;
  end_date: string | null;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_days: string[] | null;
  recurrence_interval: number | null;
  recurrence_period: string | null;
  holiday_type: string | null;
  include_weekend: boolean;
}

export type ConflictType =
  | 'team_double_booked'
  | 'coach_double_booked'
  | 'venue_double_booked'
  | 'venue_unavailable'
  | 'team_plays_itself'
  | 'blackout_date';

export interface Conflict {
  id: string; // Unique identifier for this conflict
  type: ConflictType;
  severity: 'error' | 'warning';
  matchIds: string[]; // All matches involved in the conflict
  description: string;
  context: string; // Detailed explanation (e.g., "Venue X only available until 9pm")
  solution?: Solution;
}

export interface Solution {
  id: string; // Unique identifier for this solution
  conflictId: string;
  description: string;
  weight: number; // Lower is better (less disruptive)
  changes: Change[];
  createsNewConflicts: boolean; // True if applying this creates new problems
  newConflictsCount: number;
}

export interface Change {
  matchId: string;
  field: 'scheduled_date' | 'venue_id' | 'pitch_id' | 'home_team_id' | 'away_team_id' | 'week_number';
  oldValue: any;
  newValue: any;
  reason: string;
}

/**
 * Main constraint solver
 */
export class ScheduleConstraintSolver {
  private matches: Match[];
  private venues: Venue[];
  private teams: Team[];
  private season: Season;
  private blackoutDates: BlackoutDate[];
  private gameDurationMinutes: number;

  constructor(
    matches: Match[],
    venues: Venue[],
    teams: Team[],
    season: Season,
    blackoutDates: BlackoutDate[] = []
  ) {
    this.matches = matches;
    this.venues = venues;
    this.teams = teams;
    this.season = season;
    this.blackoutDates = blackoutDates;
    this.gameDurationMinutes = season.game_duration_minutes || 75;
  }

  /**
   * Detect all conflicts in the schedule
   */
  public detectConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];

    // 1. Team double-booking (team playing multiple games at same time)
    conflicts.push(...this.detectTeamConflicts());

    // 2. Coach double-booking (coach managing multiple teams at same time)
    conflicts.push(...this.detectCoachConflicts());

    // 3. Venue/Pitch double-booking (multiple games at same location/time)
    conflicts.push(...this.detectVenueConflicts());

    // 4. Venue availability violations (games outside venue hours)
    conflicts.push(...this.detectVenueAvailabilityConflicts());

    // 5. Team playing itself
    conflicts.push(...this.detectSelfPlayConflicts());

    // 6. Blackout date violations (games scheduled on blackout dates)
    conflicts.push(...this.detectBlackoutConflicts());

    return conflicts;
  }

  /**
   * Generate the best solution for a conflict
   */
  public generateSolution(conflict: Conflict): Solution | null {
    const allSolutions = this.generateAllSolutions(conflict);

    if (allSolutions.length === 0) {
      return null;
    }

    // Filter out solutions that create new conflicts
    const validSolutions = allSolutions.filter(s => !s.createsNewConflicts);

    if (validSolutions.length > 0) {
      // Return the solution with the lowest weight
      return validSolutions.reduce((best, current) =>
        current.weight < best.weight ? current : best
      );
    }

    // If all solutions create conflicts, return the one with fewest new conflicts
    return allSolutions.reduce((best, current) =>
      current.newConflictsCount < best.newConflictsCount ? current : best
    );
  }

  /**
   * Apply a solution to the schedule
   */
  public applySolution(solution: Solution): Match[] {
    const updatedMatches = [...this.matches];

    solution.changes.forEach(change => {
      const matchIndex = updatedMatches.findIndex(m => m.id === change.matchId);
      if (matchIndex !== -1) {
        updatedMatches[matchIndex] = {
          ...updatedMatches[matchIndex],
          [change.field]: change.newValue,
        };
      }
    });

    return updatedMatches;
  }

  // ========== Private Conflict Detection Methods ==========

  private detectTeamConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];
    const dateTeamMap = new Map<string, Match[]>();

    this.matches.forEach(match => {
      if (!match.scheduled_date) return;

      const gameStart = new Date(match.scheduled_date);
      const gameEnd = new Date(gameStart.getTime() + this.gameDurationMinutes * 60000);

      // Check all matches for time overlaps
      this.matches.forEach(otherMatch => {
        if (match.id === otherMatch.id || !otherMatch.scheduled_date) return;

        const otherStart = new Date(otherMatch.scheduled_date);
        const otherEnd = new Date(otherStart.getTime() + this.gameDurationMinutes * 60000);

        // Check if times overlap
        if (gameStart < otherEnd && gameEnd > otherStart) {
          // Check if same team is in both matches
          const teamsInMatch = [match.home_team_id, match.away_team_id].filter(Boolean);
          const teamsInOther = [otherMatch.home_team_id, otherMatch.away_team_id].filter(Boolean);

          const commonTeams = teamsInMatch.filter(t => teamsInOther.includes(t));

          if (commonTeams.length > 0) {
            const teamName = this.teams.find(t => t.id === commonTeams[0])?.name || 'Unknown Team';

            conflicts.push({
              id: `team-conflict-${match.id}-${otherMatch.id}`,
              type: 'team_double_booked',
              severity: 'error',
              matchIds: [match.id, otherMatch.id],
              description: `${teamName} scheduled for multiple games at overlapping times`,
              context: `Matches ${match.match_number} and ${otherMatch.match_number} overlap`,
            });
          }
        }
      });
    });

    return this.deduplicateConflicts(conflicts);
  }

  private detectCoachConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];

    this.matches.forEach(match => {
      if (!match.scheduled_date) return;

      const gameStart = new Date(match.scheduled_date);
      const gameEnd = new Date(gameStart.getTime() + this.gameDurationMinutes * 60000);

      const coachIds = [
        match.home_team?.coach_id,
        match.away_team?.coach_id,
      ].filter(Boolean);

      this.matches.forEach(otherMatch => {
        if (match.id === otherMatch.id || !otherMatch.scheduled_date) return;

        const otherStart = new Date(otherMatch.scheduled_date);
        const otherEnd = new Date(otherStart.getTime() + this.gameDurationMinutes * 60000);

        // Check if times overlap
        if (gameStart < otherEnd && gameEnd > otherStart) {
          const otherCoachIds = [
            otherMatch.home_team?.coach_id,
            otherMatch.away_team?.coach_id,
          ].filter(Boolean);

          const commonCoaches = coachIds.filter(c => otherCoachIds.includes(c));

          if (commonCoaches.length > 0) {
            conflicts.push({
              id: `coach-conflict-${match.id}-${otherMatch.id}`,
              type: 'coach_double_booked',
              severity: 'error',
              matchIds: [match.id, otherMatch.id],
              description: `Coach managing multiple teams at overlapping times`,
              context: `Matches ${match.match_number} and ${otherMatch.match_number} overlap`,
            });
          }
        }
      });
    });

    return this.deduplicateConflicts(conflicts);
  }

  private detectVenueConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];

    this.matches.forEach(match => {
      if (!match.scheduled_date || !match.venue_id) return;

      const gameStart = new Date(match.scheduled_date);
      const gameEnd = new Date(gameStart.getTime() + this.gameDurationMinutes * 60000);

      this.matches.forEach(otherMatch => {
        if (match.id === otherMatch.id || !otherMatch.scheduled_date || !otherMatch.venue_id) return;

        const otherStart = new Date(otherMatch.scheduled_date);
        const otherEnd = new Date(otherStart.getTime() + this.gameDurationMinutes * 60000);

        // Check if times overlap and same venue/pitch
        if (gameStart < otherEnd && gameEnd > otherStart) {
          if (match.venue_id === otherMatch.venue_id) {
            // Same venue - check if same pitch
            if (match.pitch_id && otherMatch.pitch_id && match.pitch_id === otherMatch.pitch_id) {
              const venueName = match.venue?.name || 'Unknown Venue';
              const pitchName = match.pitch?.name || 'Unknown Pitch';

              conflicts.push({
                id: `venue-conflict-${match.id}-${otherMatch.id}`,
                type: 'venue_double_booked',
                severity: 'error',
                matchIds: [match.id, otherMatch.id],
                description: `${venueName} - ${pitchName} double-booked`,
                context: `Matches ${match.match_number} and ${otherMatch.match_number} overlap at the same pitch`,
              });
            } else if (!match.pitch_id || !otherMatch.pitch_id) {
              // One or both don't have pitch assigned - potential conflict
              const venueName = match.venue?.name || 'Unknown Venue';

              conflicts.push({
                id: `venue-conflict-${match.id}-${otherMatch.id}`,
                type: 'venue_double_booked',
                severity: 'warning',
                matchIds: [match.id, otherMatch.id],
                description: `${venueName} potentially double-booked`,
                context: `Matches ${match.match_number} and ${otherMatch.match_number} at same venue without pitch assignments`,
              });
            }
          }
        }
      });
    });

    return this.deduplicateConflicts(conflicts);
  }

  private detectVenueAvailabilityConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];

    this.matches.forEach(match => {
      if (!match.scheduled_date || !match.venue_id || !match.venue) return;

      const venue = this.venues.find(v => v.id === match.venue_id);
      if (!venue) return;

      const gameStart = new Date(match.scheduled_date);
      const gameEnd = new Date(gameStart.getTime() + this.gameDurationMinutes * 60000);

      // Check if venue has availability constraints
      if (venue.availability_start_datetime && venue.availability_end_datetime) {
        const venueStart = new Date(venue.availability_start_datetime);
        const venueEnd = new Date(venue.availability_end_datetime);

        // Extract time-of-day (hours and minutes) for comparison
        const gameStartTime = gameStart.getHours() * 60 + gameStart.getMinutes();
        const gameEndTime = gameEnd.getHours() * 60 + gameEnd.getMinutes();
        const venueStartTime = venueStart.getHours() * 60 + venueStart.getMinutes();
        const venueEndTime = venueEnd.getHours() * 60 + venueEnd.getMinutes();

        // Check if game time falls outside venue hours
        const timeOutsideHours = gameStartTime < venueStartTime || gameEndTime > venueEndTime;

        // Check if recurring schedule matches day-of-week
        let wrongDayOfWeek = false;
        let recurrenceDescription = '';

        if (venue.is_recurring) {
          const matchDayOfWeek = gameStart.getDay(); // 0=Sunday, 6=Saturday
          const venueDayOfWeek = venueStart.getDay();

          if (venue.recurrence_type === 'weekly') {
            // Weekly recurrence: match day must equal the venue's start day
            wrongDayOfWeek = matchDayOfWeek !== venueDayOfWeek;
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            recurrenceDescription = `on ${dayNames[venueDayOfWeek]}s`;
          } else if (venue.recurrence_type === 'on_certain_days' && venue.recurrence_days) {
            // On certain days: check if match day is in the allowed days array
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const matchDayName = dayNames[matchDayOfWeek];
            wrongDayOfWeek = !venue.recurrence_days.includes(matchDayName);
            recurrenceDescription = `on ${venue.recurrence_days.join(', ')}`;
          }
          // TODO: Add support for other recurrence types (biweekly, monthly, etc.) if needed
        }

        // Create conflict if either time is wrong OR day is wrong
        if (timeOutsideHours || wrongDayOfWeek) {
          const venueStartStr = venueStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const venueEndStr = venueEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          let contextMessage = `${venue.name} only available `;
          if (venue.is_recurring && recurrenceDescription) {
            contextMessage += `${recurrenceDescription} from ${venueStartStr} - ${venueEndStr}`;
          } else {
            contextMessage += `${venueStartStr} - ${venueEndStr}`;
          }

          conflicts.push({
            id: `venue-availability-${match.id}`,
            type: 'venue_unavailable',
            severity: 'error',
            matchIds: [match.id],
            description: `Match ${match.match_number} outside venue hours`,
            context: contextMessage,
          });
        }
      }
    });

    return conflicts;
  }

  private detectSelfPlayConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];

    this.matches.forEach(match => {
      if (match.home_team_id && match.away_team_id && match.home_team_id === match.away_team_id) {
        const teamName = match.home_team?.name || 'Unknown Team';

        conflicts.push({
          id: `self-play-${match.id}`,
          type: 'team_plays_itself',
          severity: 'error',
          matchIds: [match.id],
          description: `${teamName} cannot play itself`,
          context: `Match ${match.match_number}`,
        });
      }
    });

    return conflicts;
  }

  private detectBlackoutConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];

    if (this.blackoutDates.length === 0) return conflicts;

    // Generate set of blackout date strings for efficient lookup
    const blackoutDateStrings = this.generateBlackoutDateStringsForSolver();

    this.matches.forEach(match => {
      if (!match.scheduled_date) return;

      const matchDate = new Date(match.scheduled_date);
      const matchDateStr = matchDate.toDateString();

      // Check if match is on a blackout date
      this.blackoutDates.forEach(blackout => {
        const isBlackoutDate = this.isDateBlackedOut(matchDateStr, blackout);

        if (isBlackoutDate) {
          // Check if blackout applies to this match
          const appliesToMatch = this.blackoutAppliesToMatch(blackout, match);

          if (appliesToMatch) {
            const venueName = match.venue?.name || 'Unknown Venue';
            const pitchName = match.pitch?.name;
            const location = pitchName ? `${venueName} - ${pitchName}` : venueName;

            let context = '';
            if (blackout.applies_to === 'league') {
              context = `League-wide blackout: ${blackout.name}`;
            } else if (blackout.applies_to === 'venues') {
              context = `Venue blackout: ${blackout.name} at ${location}`;
            } else if (blackout.applies_to === 'pitches') {
              context = `Pitch blackout: ${blackout.name} at ${location}`;
            }

            conflicts.push({
              id: `blackout-${match.id}-${blackout.id}`,
              type: 'blackout_date',
              severity: 'error',
              matchIds: [match.id],
              description: `Match scheduled on blackout date`,
              context: context,
            });
          }
        }
      });
    });

    return conflicts;
  }

  private isDateBlackedOut(dateStr: string, blackout: BlackoutDate): boolean {
    if (blackout.blackout_type === 'single_date' && blackout.start_date) {
      const blackoutDate = new Date(blackout.start_date);
      return dateStr === blackoutDate.toDateString();
    } else if (blackout.blackout_type === 'date_range' && blackout.start_date && blackout.end_date) {
      const checkDate = new Date(dateStr);
      const start = new Date(blackout.start_date);
      const end = new Date(blackout.end_date);
      return checkDate >= start && checkDate <= end;
    } else if (blackout.blackout_type === 'holiday' && blackout.start_date) {
      // Holiday is just the specific date
      const holidayDate = new Date(blackout.start_date);
      return dateStr === holidayDate.toDateString();
    } else if (blackout.blackout_type === 'holiday_weekend' && blackout.start_date) {
      // Holiday weekend uses the extended weekend logic
      const mockHoliday: Holiday = {
        date: blackout.start_date,
        localName: '',
        name: '',
        countryCode: '',
        fixed: false,
        global: false,
        counties: null,
        launchYear: null,
        types: [],
      };
      const extendedDates = getHolidayDates(mockHoliday, true);

      // Check if the dateStr matches any of the extended dates
      const checkDate = new Date(dateStr);
      return extendedDates.some(dateString => {
        const blackoutDate = new Date(dateString);
        return checkDate.toDateString() === blackoutDate.toDateString();
      });
    } else if (blackout.blackout_type === 'recurring' && blackout.is_recurring) {
      // For recurring, would need to implement full recurrence logic
      // For now, just check if it matches a simple pattern
      if (blackout.recurrence_type === 'weekly' && blackout.recurrence_days) {
        const checkDate = new Date(dateStr);
        const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' });
        return blackout.recurrence_days.includes(dayName);
      }
    }
    return false;
  }

  private blackoutAppliesToMatch(blackout: BlackoutDate, match: Match): boolean {
    if (blackout.applies_to === 'league') {
      return true; // Applies to all matches
    } else if (blackout.applies_to === 'venues' && blackout.venue_ids) {
      return match.venue_id ? blackout.venue_ids.includes(match.venue_id) : false;
    } else if (blackout.applies_to === 'pitches' && blackout.pitch_ids) {
      return match.pitch_id ? blackout.pitch_ids.includes(match.pitch_id) : false;
    }
    return false;
  }

  private generateBlackoutDateStringsForSolver(): Set<string> {
    const blackoutSet = new Set<string>();

    this.blackoutDates.forEach((blackout) => {
      if (blackout.blackout_type === 'single_date' && blackout.start_date) {
        const date = new Date(blackout.start_date);
        blackoutSet.add(date.toDateString());
      } else if (blackout.blackout_type === 'date_range' && blackout.start_date && blackout.end_date) {
        const start = new Date(blackout.start_date);
        const end = new Date(blackout.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          blackoutSet.add(new Date(d).toDateString());
        }
      } else if (blackout.blackout_type === 'holiday' && blackout.start_date) {
        const date = new Date(blackout.start_date);
        blackoutSet.add(date.toDateString());
      } else if (blackout.blackout_type === 'holiday_weekend' && blackout.start_date) {
        // Use the extended weekend logic from holidayApi
        const mockHoliday: Holiday = {
          date: blackout.start_date,
          localName: '',
          name: '',
          countryCode: '',
          fixed: false,
          global: false,
          counties: null,
          launchYear: null,
          types: [],
        };
        const extendedDates = getHolidayDates(mockHoliday, true);
        extendedDates.forEach(dateString => {
          const date = new Date(dateString);
          blackoutSet.add(date.toDateString());
        });
      }
    });

    return blackoutSet;
  }

  // ========== Private Solution Generation Methods ==========

  private generateAllSolutions(conflict: Conflict): Solution[] {
    switch (conflict.type) {
      case 'team_double_booked':
        return this.generateTeamConflictSolutions(conflict);
      case 'coach_double_booked':
        return this.generateCoachConflictSolutions(conflict);
      case 'venue_double_booked':
        return this.generateVenueConflictSolutions(conflict);
      case 'venue_unavailable':
        return this.generateVenueAvailabilitySolutions(conflict);
      case 'team_plays_itself':
        return this.generateSelfPlaySolutions(conflict);
      case 'blackout_date':
        return this.generateBlackoutConflictSolutions(conflict);
      default:
        return [];
    }
  }

  private generateTeamConflictSolutions(conflict: Conflict): Solution[] {
    const solutions: Solution[] = [];

    // For team conflicts, we can:
    // 1. Change the time of one match (weight: 1)
    // 2. Swap teams between matches (weight: 3 per team swap)
    // 3. Change venue (weight: 5)

    conflict.matchIds.forEach(matchId => {
      const match = this.matches.find(m => m.id === matchId);
      if (!match) return;

      // 1. Generate time change solutions
      const timeChangeSolutions = this.generateTimeChangeSolutions(match, conflict.id);
      solutions.push(...timeChangeSolutions);

      // 2. Generate venue change solutions (might allow same time at different location)
      const venueChangeSolutions = this.generateVenueChangeSolutions(match, conflict.id);
      solutions.push(...venueChangeSolutions);
    });

    // 3. Generate team swap solutions
    const swapSolutions = this.generateTeamSwapSolutions(conflict);
    solutions.push(...swapSolutions);

    // Evaluate each solution to check if it creates new conflicts
    return solutions.map(solution => {
      const evaluation = this.evaluateSolution(solution);
      return {
        ...solution,
        createsNewConflicts: evaluation.createsNewConflicts,
        newConflictsCount: evaluation.newConflictsCount,
        weight: solution.weight + (evaluation.newConflictsCount * 100), // Heavy penalty for new conflicts
      };
    });
  }

  private generateCoachConflictSolutions(conflict: Conflict): Solution[] {
    const solutions: Solution[] = [];

    // For coach conflicts, we can:
    // 1. Change the time of one match (weight: 1)
    // 2. Reassign team ownership/coaching changes (weight: 3)

    conflict.matchIds.forEach(matchId => {
      const match = this.matches.find(m => m.id === matchId);
      if (!match) return;

      // 1. Generate time change solutions
      const timeChangeSolutions = this.generateTimeChangeSolutions(match, conflict.id);
      solutions.push(...timeChangeSolutions);

      // 2. Generate coaching change solutions
      // Note: This is complex and might not be desirable - skip for now
    });

    // Evaluate each solution
    return solutions.map(solution => {
      const evaluation = this.evaluateSolution(solution);
      return {
        ...solution,
        createsNewConflicts: evaluation.createsNewConflicts,
        newConflictsCount: evaluation.newConflictsCount,
        weight: solution.weight + (evaluation.newConflictsCount * 100),
      };
    });
  }

  private generateVenueConflictSolutions(conflict: Conflict): Solution[] {
    const solutions: Solution[] = [];

    // For venue conflicts, we can:
    // 1. Change to a different pitch at same venue (weight: 2)
    // 2. Change the time of one match (weight: 1)
    // 3. Change to a different venue (weight: 5)

    conflict.matchIds.forEach(matchId => {
      const match = this.matches.find(m => m.id === matchId);
      if (!match) return;

      // 1. Generate pitch change solutions (same venue, different pitch)
      const pitchChangeSolutions = this.generatePitchChangeSolutions(match, conflict.id);
      solutions.push(...pitchChangeSolutions);

      // 2. Generate time change solutions
      const timeChangeSolutions = this.generateTimeChangeSolutions(match, conflict.id);
      solutions.push(...timeChangeSolutions);

      // 3. Generate venue change solutions
      const venueChangeSolutions = this.generateVenueChangeSolutions(match, conflict.id);
      solutions.push(...venueChangeSolutions);
    });

    // Evaluate each solution
    return solutions.map(solution => {
      const evaluation = this.evaluateSolution(solution);
      return {
        ...solution,
        createsNewConflicts: evaluation.createsNewConflicts,
        newConflictsCount: evaluation.newConflictsCount,
        weight: solution.weight + (evaluation.newConflictsCount * 100),
      };
    });
  }

  private generateVenueAvailabilitySolutions(conflict: Conflict): Solution[] {
    const solutions: Solution[] = [];

    // For venue availability, we can:
    // 1. Change the time to fit within venue hours (weight: 1)
    // 2. Change to a different venue (weight: 5)

    conflict.matchIds.forEach(matchId => {
      const match = this.matches.find(m => m.id === matchId);
      if (!match || !match.venue_id) return;

      const venue = this.venues.find(v => v.id === match.venue_id);
      if (!venue) return;

      // 1. Generate time change solutions within venue hours
      const timeChangeSolutions = this.generateTimeChangeSolutionsWithinVenueHours(match, venue, conflict.id);
      solutions.push(...timeChangeSolutions);

      // 2. Generate venue change solutions
      const venueChangeSolutions = this.generateVenueChangeSolutions(match, conflict.id);
      solutions.push(...venueChangeSolutions);
    });

    // Evaluate each solution
    return solutions.map(solution => {
      const evaluation = this.evaluateSolution(solution);
      return {
        ...solution,
        createsNewConflicts: evaluation.createsNewConflicts,
        newConflictsCount: evaluation.newConflictsCount,
        weight: solution.weight + (evaluation.newConflictsCount * 100),
      };
    });
  }

  private generateSelfPlaySolutions(conflict: Conflict): Solution[] {
    const solutions: Solution[] = [];

    // For self-play, we can:
    // 1. Swap one team with another team from a different match (weight: 3)

    conflict.matchIds.forEach(matchId => {
      const match = this.matches.find(m => m.id === matchId);
      if (!match) return;

      // Generate team swap solutions
      this.matches.forEach(otherMatch => {
        if (otherMatch.id === match.id) return;

        // Try swapping home team
        if (otherMatch.home_team_id && otherMatch.home_team_id !== match.away_team_id) {
          solutions.push({
            id: `swap-home-${match.id}-${otherMatch.id}`,
            conflictId: conflict.id,
            description: `Swap ${match.home_team?.name} with ${otherMatch.home_team?.name}`,
            weight: 3,
            changes: [
              {
                matchId: match.id,
                field: 'home_team_id',
                oldValue: match.home_team_id,
                newValue: otherMatch.home_team_id,
                reason: 'Swap to resolve self-play conflict',
              },
              {
                matchId: otherMatch.id,
                field: 'home_team_id',
                oldValue: otherMatch.home_team_id,
                newValue: match.home_team_id,
                reason: 'Swap to resolve self-play conflict',
              },
            ],
            createsNewConflicts: false,
            newConflictsCount: 0,
          });
        }

        // Try swapping away team
        if (otherMatch.away_team_id && otherMatch.away_team_id !== match.home_team_id) {
          solutions.push({
            id: `swap-away-${match.id}-${otherMatch.id}`,
            conflictId: conflict.id,
            description: `Swap ${match.away_team?.name} with ${otherMatch.away_team?.name}`,
            weight: 3,
            changes: [
              {
                matchId: match.id,
                field: 'away_team_id',
                oldValue: match.away_team_id,
                newValue: otherMatch.away_team_id,
                reason: 'Swap to resolve self-play conflict',
              },
              {
                matchId: otherMatch.id,
                field: 'away_team_id',
                oldValue: otherMatch.away_team_id,
                newValue: match.away_team_id,
                reason: 'Swap to resolve self-play conflict',
              },
            ],
            createsNewConflicts: false,
            newConflictsCount: 0,
          });
        }
      });
    });

    // Evaluate each solution
    return solutions.map(solution => {
      const evaluation = this.evaluateSolution(solution);
      return {
        ...solution,
        createsNewConflicts: evaluation.createsNewConflicts,
        newConflictsCount: evaluation.newConflictsCount,
        weight: solution.weight + (evaluation.newConflictsCount * 100),
      };
    });
  }

  private generateBlackoutConflictSolutions(conflict: Conflict): Solution[] {
    const solutions: Solution[] = [];

    // For blackout conflicts, we can:
    // 1. Reschedule to a nearby non-blackout date (weight: 1)

    conflict.matchIds.forEach(matchId => {
      const match = this.matches.find(m => m.id === matchId);
      if (!match || !match.scheduled_date) return;

      const currentDate = new Date(match.scheduled_date);

      // Try dates within +/- 7 days
      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        // Try future dates
        const futureDate = new Date(currentDate);
        futureDate.setDate(currentDate.getDate() + dayOffset);

        if (!this.isAnyBlackoutDate(futureDate.toDateString())) {
          solutions.push({
            id: `reschedule-blackout-${match.id}-plus-${dayOffset}`,
            conflictId: conflict.id,
            description: `Reschedule to ${futureDate.toLocaleDateString()} (+${dayOffset} days)`,
            weight: 1 + (dayOffset * 0.1), // Prefer closer dates
            changes: [
              {
                matchId: match.id,
                field: 'scheduled_date',
                oldValue: match.scheduled_date,
                newValue: futureDate.toISOString(),
                reason: 'Avoid blackout date',
              },
            ],
            createsNewConflicts: false,
            newConflictsCount: 0,
          });
        }

        // Try past dates
        const pastDate = new Date(currentDate);
        pastDate.setDate(currentDate.getDate() - dayOffset);

        if (!this.isAnyBlackoutDate(pastDate.toDateString())) {
          solutions.push({
            id: `reschedule-blackout-${match.id}-minus-${dayOffset}`,
            conflictId: conflict.id,
            description: `Reschedule to ${pastDate.toLocaleDateString()} (-${dayOffset} days)`,
            weight: 1 + (dayOffset * 0.1), // Prefer closer dates
            changes: [
              {
                matchId: match.id,
                field: 'scheduled_date',
                oldValue: match.scheduled_date,
                newValue: pastDate.toISOString(),
                reason: 'Avoid blackout date',
              },
            ],
            createsNewConflicts: false,
            newConflictsCount: 0,
          });
        }
      }
    });

    // Evaluate each solution
    return solutions.map(solution => {
      const evaluation = this.evaluateSolution(solution);
      return {
        ...solution,
        createsNewConflicts: evaluation.createsNewConflicts,
        newConflictsCount: evaluation.newConflictsCount,
        weight: solution.weight + (evaluation.newConflictsCount * 100),
      };
    });
  }

  private isAnyBlackoutDate(dateStr: string): boolean {
    return this.blackoutDates.some(blackout => this.isDateBlackedOut(dateStr, blackout));
  }

  /**
   * Simulate applying a solution and check if it creates new conflicts
   */
  private evaluateSolution(solution: Solution): { createsNewConflicts: boolean; newConflictsCount: number } {
    // Create a temporary solver with the updated matches
    const updatedMatches = this.applySolution(solution);
    const tempSolver = new ScheduleConstraintSolver(updatedMatches, this.venues, this.teams, this.season, this.blackoutDates);

    const newConflicts = tempSolver.detectConflicts();

    // Filter out the original conflict we're trying to solve
    const actualNewConflicts = newConflicts.filter(c => c.id !== solution.conflictId);

    return {
      createsNewConflicts: actualNewConflicts.length > 0,
      newConflictsCount: actualNewConflicts.length,
    };
  }

  /**
   * Remove duplicate conflicts (same matches involved)
   */
  private deduplicateConflicts(conflicts: Conflict[]): Conflict[] {
    const seen = new Set<string>();
    return conflicts.filter(conflict => {
      const key = conflict.matchIds.sort().join('-');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculate bye week weight based on schedule preference
   */
  private getByeWeekWeight(): number {
    return this.season.schedule_preference === 'compact' ? 10 : 3;
  }

  // ========== Helper Methods for Solution Generation ==========

  /**
   * Generate time change solutions for a match
   */
  private generateTimeChangeSolutions(match: Match, conflictId: string): Solution[] {
    const solutions: Solution[] = [];

    if (!match.scheduled_date || !match.venue_id) return solutions;

    const venue = this.venues.find(v => v.id === match.venue_id);
    if (!venue) return solutions;

    // Generate alternative time slots based on venue availability
    const currentDate = new Date(match.scheduled_date);
    const alternativeTimes = this.generateAlternativeTimeSlots(currentDate, venue);

    alternativeTimes.forEach(newTime => {
      solutions.push({
        id: `time-change-${match.id}-${newTime.getTime()}`,
        conflictId,
        description: `Change match ${match.match_number} to ${newTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        weight: 1,
        changes: [
          {
            matchId: match.id,
            field: 'scheduled_date',
            oldValue: match.scheduled_date,
            newValue: newTime.toISOString(),
            reason: 'Time change to resolve conflict',
          },
        ],
        createsNewConflicts: false,
        newConflictsCount: 0,
      });
    });

    return solutions;
  }

  /**
   * Generate time change solutions within venue operating hours
   */
  private generateTimeChangeSolutionsWithinVenueHours(match: Match, venue: Venue, conflictId: string): Solution[] {
    const solutions: Solution[] = [];

    if (!match.scheduled_date) return solutions;
    if (!venue.availability_start_datetime || !venue.availability_end_datetime) return solutions;

    const currentDate = new Date(match.scheduled_date);
    const venueStart = new Date(venue.availability_start_datetime);
    const venueEnd = new Date(venue.availability_end_datetime);

    // Determine which days to generate solutions for
    const daysToCheck: Date[] = [];

    if (venue.is_recurring) {
      const currentDayOfWeek = currentDate.getDay();
      const venueDayOfWeek = venueStart.getDay();

      if (venue.recurrence_type === 'weekly') {
        // Find the next occurrence of the venue's day
        // If already on correct day, include same day + next week
        if (currentDayOfWeek === venueDayOfWeek) {
          daysToCheck.push(new Date(currentDate)); // Same day
          const nextWeek = new Date(currentDate);
          nextWeek.setDate(nextWeek.getDate() + 7);
          daysToCheck.push(nextWeek);
        } else {
          // Find next occurrence of the venue's day
          const daysUntilVenueDay = (venueDayOfWeek - currentDayOfWeek + 7) % 7;
          const nextVenueDay = new Date(currentDate);
          nextVenueDay.setDate(nextVenueDay.getDate() + daysUntilVenueDay);
          daysToCheck.push(nextVenueDay);
        }
      } else if (venue.recurrence_type === 'on_certain_days' && venue.recurrence_days) {
        // Find next 2 occurrences of any allowed day
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayName = dayNames[currentDayOfWeek];

        // If current day is allowed, include it
        if (venue.recurrence_days.includes(currentDayName)) {
          daysToCheck.push(new Date(currentDate));
        }

        // Find next allowed day
        for (let i = 1; i <= 7 && daysToCheck.length < 2; i++) {
          const checkDate = new Date(currentDate);
          checkDate.setDate(checkDate.getDate() + i);
          const checkDayName = dayNames[checkDate.getDay()];
          if (venue.recurrence_days.includes(checkDayName)) {
            daysToCheck.push(checkDate);
          }
        }
      } else {
        // For other recurrence types, just use same day for now
        daysToCheck.push(new Date(currentDate));
      }
    } else {
      // Non-recurring: only check same day
      daysToCheck.push(new Date(currentDate));
    }

    // Generate time slots for each valid day
    const alternativeTimes: Date[] = [];
    const slotInterval = 60; // 60 minute intervals

    // Extract time-of-day from venue hours (handles timezone properly)
    const venueStartHour = venueStart.getHours();
    const venueStartMinute = venueStart.getMinutes();
    const venueEndHour = venueEnd.getHours();
    const venueEndMinute = venueEnd.getMinutes();

    daysToCheck.forEach(dayDate => {
      const slotTime = new Date(dayDate);
      slotTime.setHours(venueStartHour, venueStartMinute, 0, 0);

      const endTime = new Date(dayDate);
      endTime.setHours(venueEndHour, venueEndMinute, 0, 0);

      while (slotTime.getTime() + this.gameDurationMinutes * 60000 <= endTime.getTime()) {
        if (slotTime.getTime() !== currentDate.getTime()) {
          alternativeTimes.push(new Date(slotTime));
        }
        slotTime.setMinutes(slotTime.getMinutes() + slotInterval);
      }
    });

    alternativeTimes.forEach(newTime => {
      const isSameDay = newTime.toDateString() === currentDate.toDateString();
      const dayLabel = isSameDay ? '' : ` on ${newTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;

      solutions.push({
        id: `time-venue-${match.id}-${newTime.getTime()}`,
        conflictId,
        description: `Change to ${newTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${dayLabel}`,
        weight: 1,
        changes: [
          {
            matchId: match.id,
            field: 'scheduled_date',
            oldValue: match.scheduled_date,
            newValue: newTime.toISOString(),
            reason: 'Time change to fit within venue availability',
          },
        ],
        createsNewConflicts: false,
        newConflictsCount: 0,
      });
    });

    return solutions;
  }

  /**
   * Generate venue change solutions
   */
  private generateVenueChangeSolutions(match: Match, conflictId: string): Solution[] {
    const solutions: Solution[] = [];

    if (!match.scheduled_date) return solutions;

    const currentDate = new Date(match.scheduled_date);

    // Try all other venues
    this.venues.forEach(venue => {
      if (venue.id === match.venue_id) return;

      // Check if venue is available at this time
      if (this.isVenueAvailableAtTime(venue, currentDate)) {
        // Pick first available pitch at the venue
        const firstPitch = venue.pitches?.[0];

        solutions.push({
          id: `venue-change-${match.id}-${venue.id}`,
          conflictId,
          description: `Change to ${venue.name}`,
          weight: 5,
          changes: [
            {
              matchId: match.id,
              field: 'venue_id',
              oldValue: match.venue_id,
              newValue: venue.id,
              reason: 'Venue change to resolve conflict',
            },
            ...(firstPitch
              ? [
                  {
                    matchId: match.id,
                    field: 'pitch_id' as const,
                    oldValue: match.pitch_id,
                    newValue: firstPitch.id,
                    reason: 'Pitch assignment at new venue',
                  },
                ]
              : []),
          ],
          createsNewConflicts: false,
          newConflictsCount: 0,
        });
      }
    });

    return solutions;
  }

  /**
   * Generate pitch change solutions (same venue, different pitch)
   */
  private generatePitchChangeSolutions(match: Match, conflictId: string): Solution[] {
    const solutions: Solution[] = [];

    if (!match.venue_id) return solutions;

    const venue = this.venues.find(v => v.id === match.venue_id);
    if (!venue || !venue.pitches) return solutions;

    // Try all other pitches at the same venue
    venue.pitches.forEach(pitch => {
      if (pitch.id === match.pitch_id) return;

      solutions.push({
        id: `pitch-change-${match.id}-${pitch.id}`,
        conflictId,
        description: `Change to ${venue.name} - ${pitch.name}`,
        weight: 2,
        changes: [
          {
            matchId: match.id,
            field: 'pitch_id',
            oldValue: match.pitch_id,
            newValue: pitch.id,
            reason: 'Pitch change to resolve conflict',
          },
        ],
        createsNewConflicts: false,
        newConflictsCount: 0,
      });
    });

    return solutions;
  }

  /**
   * Generate team swap solutions
   */
  private generateTeamSwapSolutions(conflict: Conflict): Solution[] {
    const solutions: Solution[] = [];

    if (conflict.matchIds.length !== 2) return solutions;

    const match1 = this.matches.find(m => m.id === conflict.matchIds[0]);
    const match2 = this.matches.find(m => m.id === conflict.matchIds[1]);

    if (!match1 || !match2) return solutions;

    // Try swapping home teams
    if (match1.home_team_id && match2.home_team_id) {
      solutions.push({
        id: `team-swap-home-${match1.id}-${match2.id}`,
        conflictId: conflict.id,
        description: `Swap ${match1.home_team?.name} and ${match2.home_team?.name}`,
        weight: 3,
        changes: [
          {
            matchId: match1.id,
            field: 'home_team_id',
            oldValue: match1.home_team_id,
            newValue: match2.home_team_id,
            reason: 'Team swap to resolve conflict',
          },
          {
            matchId: match2.id,
            field: 'home_team_id',
            oldValue: match2.home_team_id,
            newValue: match1.home_team_id,
            reason: 'Team swap to resolve conflict',
          },
        ],
        createsNewConflicts: false,
        newConflictsCount: 0,
      });
    }

    // Try swapping away teams
    if (match1.away_team_id && match2.away_team_id) {
      solutions.push({
        id: `team-swap-away-${match1.id}-${match2.id}`,
        conflictId: conflict.id,
        description: `Swap ${match1.away_team?.name} and ${match2.away_team?.name}`,
        weight: 3,
        changes: [
          {
            matchId: match1.id,
            field: 'away_team_id',
            oldValue: match1.away_team_id,
            newValue: match2.away_team_id,
            reason: 'Team swap to resolve conflict',
          },
          {
            matchId: match2.id,
            field: 'away_team_id',
            oldValue: match2.away_team_id,
            newValue: match1.away_team_id,
            reason: 'Team swap to resolve conflict',
          },
        ],
        createsNewConflicts: false,
        newConflictsCount: 0,
      });
    }

    return solutions;
  }

  /**
   * Generate alternative time slots for a given date and venue
   */
  private generateAlternativeTimeSlots(currentDate: Date, venue: Venue): Date[] {
    const slots: Date[] = [];

    if (!venue.availability_start_datetime || !venue.availability_end_datetime) {
      // No venue constraints - generate reasonable time slots
      const dayStart = new Date(currentDate);
      dayStart.setHours(18, 0, 0, 0); // Default start at 6 PM

      for (let i = 0; i < 6; i++) {
        const slot = new Date(dayStart);
        slot.setHours(dayStart.getHours() + i);
        if (slot.getTime() !== currentDate.getTime()) {
          slots.push(slot);
        }
      }
    } else {
      // Generate slots within venue hours
      const venueStart = new Date(venue.availability_start_datetime);
      const venueEnd = new Date(venue.availability_end_datetime);

      const slotTime = new Date(currentDate);
      slotTime.setHours(venueStart.getHours(), venueStart.getMinutes(), 0, 0);

      while (slotTime.getTime() + this.gameDurationMinutes * 60000 <= venueEnd.getTime()) {
        if (slotTime.getTime() !== currentDate.getTime()) {
          slots.push(new Date(slotTime));
        }
        slotTime.setMinutes(slotTime.getMinutes() + 60); // 60 minute intervals
      }
    }

    return slots;
  }

  /**
   * Check if a venue is available at a specific time
   */
  private isVenueAvailableAtTime(venue: Venue, time: Date): boolean {
    if (!venue.availability_start_datetime || !venue.availability_end_datetime) {
      return true; // No constraints
    }

    const venueStart = new Date(venue.availability_start_datetime);
    const venueEnd = new Date(venue.availability_end_datetime);
    const gameEnd = new Date(time.getTime() + this.gameDurationMinutes * 60000);

    // Extract time-of-day (hours and minutes) for comparison
    const gameStartTime = time.getHours() * 60 + time.getMinutes();
    const gameEndTime = gameEnd.getHours() * 60 + gameEnd.getMinutes();
    const venueStartTime = venueStart.getHours() * 60 + venueStart.getMinutes();
    const venueEndTime = venueEnd.getHours() * 60 + venueEnd.getMinutes();

    // Check time-of-day
    const timeIsValid = gameStartTime >= venueStartTime && gameEndTime <= venueEndTime;
    if (!timeIsValid) return false;

    // Check day-of-week for recurring schedules
    if (venue.is_recurring) {
      const matchDayOfWeek = time.getDay(); // 0=Sunday, 6=Saturday
      const venueDayOfWeek = venueStart.getDay();

      if (venue.recurrence_type === 'weekly') {
        // Weekly recurrence: match day must equal the venue's start day
        return matchDayOfWeek === venueDayOfWeek;
      } else if (venue.recurrence_type === 'on_certain_days' && venue.recurrence_days) {
        // On certain days: check if match day is in the allowed days array
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const matchDayName = dayNames[matchDayOfWeek];
        return venue.recurrence_days.includes(matchDayName);
      }
      // TODO: Add support for other recurrence types (biweekly, monthly, etc.) if needed
    }

    return true;
  }
}
