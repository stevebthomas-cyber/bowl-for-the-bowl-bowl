/**
 * Schedule Optimizer Algorithms
 *
 * Provides algorithms to regenerate schedules based on different optimization strategies.
 * Each algorithm respects season rules and constraints while optimizing for specific goals.
 */

import type { OptimizationType } from '../components/schedule/panels/ScheduleOptimizerPanel';
import { getHolidayDates, type Holiday } from './holidayApi';

interface Match {
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
}

interface Venue {
  id: string;
  name: string;
  availability_start_datetime?: string | null;
  availability_end_datetime?: string | null;
  is_recurring?: boolean;
  recurrence_type?: string | null;
  recurrence_days?: string[] | null;
  use_specific_dates?: boolean;
  specific_dates?: any[] | null;
  pitches?: Pitch[];
}

interface Pitch {
  id: string;
  name: string;
  venue_id: string;
}

interface Team {
  id: string;
  name: string;
}

interface Season {
  id: string;
  season_number: number;
  start_date?: string | null;
  end_date?: string | null;
  matches_per_team?: number;
  season_type?: 'round_robin' | 'double_round_robin' | 'custom';
  game_duration_minutes?: number;
}

interface DateSchedule {
  id: string;
  name: string;
  use_specific_dates: boolean;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_days: string[] | null; // ["Monday", "Wednesday", ...]
  recurrence_interval: number | null;
  recurrence_period: string | null; // 'days', 'weeks', 'months'
  availability_start_datetime: string | null;
  availability_end_datetime: string | null;
  specific_dates: string[] | null; // Array of ISO date strings
}

interface BlackoutDate {
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

export interface OptimizationResult {
  matches: Match[];
  changes: {
    matchId: string;
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface OptimizationScope {
  type: 'match' | 'round' | 'season';
  matchIds?: string[];
  weekNumber?: number;
}

export class ScheduleOptimizer {
  private matches: Match[];
  private venues: Venue[];
  private teams: Team[];
  private season: Season;
  private dateSchedules: DateSchedule[];
  private blackoutDates: BlackoutDate[];
  private gameDurationMinutes = 150; // 2.5 hours

  constructor(
    matches: Match[],
    venues: Venue[],
    teams: Team[],
    season: Season,
    dateSchedules: DateSchedule[] = [],
    blackoutDates: BlackoutDate[] = []
  ) {
    this.matches = matches;
    this.venues = venues;
    this.teams = teams;
    this.season = season;
    this.dateSchedules = dateSchedules;
    this.blackoutDates = blackoutDates;
    this.gameDurationMinutes = season.game_duration_minutes || 150;
  }

  /**
   * Main entry point: optimize schedule based on type and scope
   */
  optimize(
    optimizationType: OptimizationType,
    scope: OptimizationScope
  ): OptimizationResult {
    const matchesToOptimize = this.getMatchesInScope(scope);

    switch (optimizationType) {
      case 'shuffle_matchups':
        return this.shuffleMatchups(matchesToOptimize);
      case 'minimize_venues':
        return this.minimizeVenues(matchesToOptimize);
      case 'maximize_venues':
        return this.maximizeVenues(matchesToOptimize);
      case 'compact_schedule':
        return this.compactSchedule(matchesToOptimize);
      case 'expand_schedule':
        return this.expandSchedule(matchesToOptimize);
      default:
        throw new Error(`Unknown optimization type: ${optimizationType}`);
    }
  }

  /**
   * Get matches within the specified scope
   */
  private getMatchesInScope(scope: OptimizationScope): Match[] {
    if (scope.type === 'match' && scope.matchIds) {
      return this.matches.filter(m => scope.matchIds!.includes(m.id));
    }
    if (scope.type === 'round' && scope.weekNumber !== undefined) {
      return this.matches.filter(m => m.week_number === scope.weekNumber);
    }
    // season scope: all matches
    return [...this.matches];
  }

  /**
   * Shuffle Matchups: Randomize team pairings while respecting season rules
   */
  private shuffleMatchups(matches: Match[]): OptimizationResult {
    const changes: OptimizationResult['changes'] = [];
    const updatedMatches = matches.map(m => ({ ...m }));

    // Extract all teams involved in these matches
    const homeTeams = matches.map(m => m.home_team_id).filter(Boolean) as string[];
    const awayTeams = matches.map(m => m.away_team_id).filter(Boolean) as string[];
    const allTeamIds = Array.from(new Set([...homeTeams, ...awayTeams]));

    // If we're regenerating the entire season, respect season_type rules
    if (matches.length === this.matches.length) {
      return this.generateSeasonMatchups(allTeamIds, updatedMatches, changes);
    }

    // For partial regeneration (single match or round), shuffle teams randomly
    const shuffledHomeTeams = this.shuffleArray([...homeTeams]);
    const shuffledAwayTeams = this.shuffleArray([...awayTeams]);

    updatedMatches.forEach((match, idx) => {
      if (match.home_team_id !== shuffledHomeTeams[idx]) {
        changes.push({
          matchId: match.id,
          field: 'home_team_id',
          oldValue: match.home_team_id,
          newValue: shuffledHomeTeams[idx],
        });
        match.home_team_id = shuffledHomeTeams[idx];
      }

      if (match.away_team_id !== shuffledAwayTeams[idx]) {
        changes.push({
          matchId: match.id,
          field: 'away_team_id',
          oldValue: match.away_team_id,
          newValue: shuffledAwayTeams[idx],
        });
        match.away_team_id = shuffledAwayTeams[idx];
      }
    });

    return { matches: updatedMatches, changes };
  }

  /**
   * Generate season matchups respecting round-robin rules
   */
  private generateSeasonMatchups(
    teamIds: string[],
    matches: Match[],
    changes: OptimizationResult['changes']
  ): OptimizationResult {
    const { season_type } = this.season;

    // Generate round-robin pairings
    const pairings: Array<[string, string]> = [];

    if (season_type === 'round_robin' || season_type === 'double_round_robin') {
      // Standard round-robin algorithm
      const teams = [...teamIds];
      const n = teams.length;
      const rounds = n % 2 === 0 ? n - 1 : n;

      for (let round = 0; round < rounds; round++) {
        for (let i = 0; i < Math.floor(n / 2); i++) {
          const home = teams[i];
          const away = teams[n - 1 - i];
          pairings.push([home, away]);
        }

        // Rotate teams (keep first team fixed)
        teams.splice(1, 0, teams.pop()!);
      }

      // Double round-robin: add reverse fixtures
      if (season_type === 'double_round_robin') {
        const reversePairings = pairings.map(([h, a]) => [a, h] as [string, string]);
        pairings.push(...reversePairings);
      }
    } else {
      // Custom: just pair teams randomly
      const shuffled = this.shuffleArray([...teamIds]);
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        pairings.push([shuffled[i], shuffled[i + 1]]);
      }
    }

    // Apply pairings to matches
    matches.forEach((match, idx) => {
      if (idx < pairings.length) {
        const [home, away] = pairings[idx];

        if (match.home_team_id !== home) {
          changes.push({
            matchId: match.id,
            field: 'home_team_id',
            oldValue: match.home_team_id,
            newValue: home,
          });
          match.home_team_id = home;
        }

        if (match.away_team_id !== away) {
          changes.push({
            matchId: match.id,
            field: 'away_team_id',
            oldValue: match.away_team_id,
            newValue: away,
          });
          match.away_team_id = away;
        }
      }
    });

    return { matches, changes };
  }

  /**
   * Minimize Venues: Use the fewest venues possible
   */
  private minimizeVenues(matches: Match[]): OptimizationResult {
    const changes: OptimizationResult['changes'] = [];
    const updatedMatches = matches.map(m => ({ ...m }));

    // Find the venue with the most availability
    const bestVenue = this.findMostAvailableVenue();
    if (!bestVenue) return { matches: updatedMatches, changes };

    // Assign all matches to this venue
    updatedMatches.forEach(match => {
      if (match.venue_id !== bestVenue.id) {
        changes.push({
          matchId: match.id,
          field: 'venue_id',
          oldValue: match.venue_id,
          newValue: bestVenue.id,
        });
        match.venue_id = bestVenue.id;

        // Clear pitch if it doesn't belong to new venue
        if (match.pitch_id) {
          const pitchBelongsToVenue = bestVenue.pitches?.some(p => p.id === match.pitch_id);
          if (!pitchBelongsToVenue) {
            changes.push({
              matchId: match.id,
              field: 'pitch_id',
              oldValue: match.pitch_id,
              newValue: null,
            });
            match.pitch_id = null;
          }
        }
      }
    });

    return { matches: updatedMatches, changes };
  }

  /**
   * Maximize Venues: Spread matches across many venues for variety, weighted by pitch capacity
   */
  private maximizeVenues(matches: Match[]): OptimizationResult {
    const changes: OptimizationResult['changes'] = [];
    const updatedMatches = matches.map(m => ({ ...m }));

    // Get all available venues with their capacities
    const availableVenues = this.venues.filter(v => this.isVenueGenerallyAvailable(v));
    if (availableVenues.length === 0) return { matches: updatedMatches, changes };

    // Build weighted distribution: venue with 3 pitches gets 3 entries (one per pitch)
    const pitchPool: Array<{ venue: Venue; pitch: Pitch | null }> = [];
    availableVenues.forEach(venue => {
      if (venue.pitches && venue.pitches.length > 0) {
        venue.pitches.forEach(pitch => {
          pitchPool.push({ venue, pitch });
        });
      } else {
        pitchPool.push({ venue, pitch: null });
      }
    });

    // Distribute matches across pitch pool
    updatedMatches.forEach((match, idx) => {
      const { venue, pitch } = pitchPool[idx % pitchPool.length];

      if (match.venue_id !== venue.id) {
        changes.push({
          matchId: match.id,
          field: 'venue_id',
          oldValue: match.venue_id,
          newValue: venue.id,
        });
        match.venue_id = venue.id;
      }

      const newPitchId = pitch?.id || null;
      if (match.pitch_id !== newPitchId) {
        changes.push({
          matchId: match.id,
          field: 'pitch_id',
          oldValue: match.pitch_id,
          newValue: newPitchId,
        });
        match.pitch_id = newPitchId;
      }
    });

    return { matches: updatedMatches, changes };
  }

  /**
   * Helper: Calculate how many games can fit in a venue's operating hours
   */
  private calculateGamesPerPitch(venue: Venue): number {
    if (!venue.availability_start_datetime || !venue.availability_end_datetime) {
      console.log(`[calculateGamesPerPitch] Venue ${venue.name} has no availability times, using default 4`);
      return 4; // Default fallback
    }

    const startTime = new Date(venue.availability_start_datetime);
    const endTime = new Date(venue.availability_end_datetime);

    // Calculate minutes between start and end time
    const availableMinutes = (endTime.getHours() * 60 + endTime.getMinutes()) -
                            (startTime.getHours() * 60 + startTime.getMinutes());

    // How many games fit in that window?
    const gamesPerPitch = Math.floor(availableMinutes / this.gameDurationMinutes);
    console.log(`[calculateGamesPerPitch] Venue ${venue.name}: ${availableMinutes} min / ${this.gameDurationMinutes} min/game = ${gamesPerPitch} games per pitch, pitches: ${venue.pitches?.length || 0}`);
    return gamesPerPitch;
  }

  /**
   * Compact Schedule: Minimize total weeks used by packing matches using venue capacity
   */
  private compactSchedule(matches: Match[]): OptimizationResult {
    const changes: OptimizationResult['changes'] = [];
    const updatedMatches = matches.map(m => ({ ...m }));

    // Get allowed dates
    const allowedDates = this.getAllowedDates();
    console.log('[compactSchedule] Allowed dates:', allowedDates.length);
    if (allowedDates.length === 0) {
      console.log('[compactSchedule] No allowed dates, returning');
      return { matches: updatedMatches, changes };
    }

    // Get all venues with their pitches
    const availableVenues = this.venues.filter(v => this.isVenueGenerallyAvailable(v));
    console.log('[compactSchedule] Available venues:', availableVenues.length);
    if (availableVenues.length === 0) {
      console.log('[compactSchedule] No available venues, returning');
      return { matches: updatedMatches, changes };
    }

    // Build pitch pool with time slot capacity for each pitch
    const pitchSlots: Array<{ venue: Venue; pitch: Pitch | null; slotsPerDay: number }> = [];
    availableVenues.forEach(venue => {
      const slotsPerDay = this.calculateGamesPerPitch(venue);
      if (venue.pitches && venue.pitches.length > 0) {
        venue.pitches.forEach(pitch => {
          pitchSlots.push({ venue, pitch, slotsPerDay });
        });
      } else {
        pitchSlots.push({ venue, pitch: null, slotsPerDay });
      }
    });

    // Sort matches by current week number to preserve round order
    const sortedMatches = [...updatedMatches].sort((a, b) => {
      const weekA = a.week_number ?? 999;
      const weekB = b.week_number ?? 999;
      return weekA - weekB;
    });

    // Pack matches into fewest days with staggered start times
    let dateIndex = 0;
    let currentDate = allowedDates[dateIndex];
    let currentWeek = 1;
    let matchIndexOnDate = 0;

    // Calculate total capacity per day
    const totalCapacityPerDay = pitchSlots.reduce((sum, ps) => sum + ps.slotsPerDay, 0);

    sortedMatches.forEach((match) => {
      // Calculate which pitch and time slot to use
      const pitchIndex = matchIndexOnDate % pitchSlots.length;
      const timeSlotOnPitch = Math.floor(matchIndexOnDate / pitchSlots.length);

      const { venue, pitch } = pitchSlots[pitchIndex];

      // Assign venue and pitch
      if (match.venue_id !== venue.id) {
        changes.push({
          matchId: match.id,
          field: 'venue_id',
          oldValue: match.venue_id,
          newValue: venue.id,
        });
        match.venue_id = venue.id;
      }

      const newPitchId = pitch?.id || null;
      if (match.pitch_id !== newPitchId) {
        changes.push({
          matchId: match.id,
          field: 'pitch_id',
          oldValue: match.pitch_id,
          newValue: newPitchId,
        });
        match.pitch_id = newPitchId;
      }

      // Calculate start time using venue's actual availability window
      const venueStartTime = venue.availability_start_datetime
        ? new Date(venue.availability_start_datetime)
        : new Date(currentDate);

      // Set to current date but preserve venue's time of day
      const startDateTime = new Date(currentDate);
      startDateTime.setHours(venueStartTime.getHours());
      startDateTime.setMinutes(venueStartTime.getMinutes());
      startDateTime.setSeconds(0);
      startDateTime.setMilliseconds(0);

      // Add offset for time slot (stagger games on same pitch)
      startDateTime.setMinutes(startDateTime.getMinutes() + (timeSlotOnPitch * this.gameDurationMinutes));

      const newDateISO = startDateTime.toISOString();
      if (match.scheduled_date !== newDateISO) {
        changes.push({
          matchId: match.id,
          field: 'scheduled_date',
          oldValue: match.scheduled_date,
          newValue: newDateISO,
        });
        match.scheduled_date = newDateISO;
      }

      if (match.week_number !== currentWeek) {
        changes.push({
          matchId: match.id,
          field: 'week_number',
          oldValue: match.week_number,
          newValue: currentWeek,
        });
        match.week_number = currentWeek;
      }

      matchIndexOnDate++;

      // Move to next date when we've filled today's capacity
      if (matchIndexOnDate >= totalCapacityPerDay) {
        dateIndex++;
        if (dateIndex >= allowedDates.length) {
          dateIndex = 0; // Wrap around if needed
        }
        currentDate = allowedDates[dateIndex];
        matchIndexOnDate = 0;
        currentWeek++;
      }
    });

    return { matches: updatedMatches, changes };
  }

  /**
   * Expand Schedule: Maximize schedule length using all available dates, spread evenly
   */
  private expandSchedule(matches: Match[]): OptimizationResult {
    const changes: OptimizationResult['changes'] = [];
    const updatedMatches = matches.map(m => ({ ...m }));

    // Get allowed dates
    const allowedDates = this.getAllowedDates();
    if (allowedDates.length === 0) return { matches: updatedMatches, changes };

    // Get all venues with their pitches
    const availableVenues = this.venues.filter(v => this.isVenueGenerallyAvailable(v));
    if (availableVenues.length === 0) return { matches: updatedMatches, changes };

    // Build pitch pool with venues
    const pitchPool: Array<{ venue: Venue; pitch: Pitch | null }> = [];
    availableVenues.forEach(venue => {
      if (venue.pitches && venue.pitches.length > 0) {
        venue.pitches.forEach(pitch => {
          pitchPool.push({ venue, pitch });
        });
      } else {
        pitchPool.push({ venue, pitch: null });
      }
    });

    const matchesCount = updatedMatches.length;

    // Sort matches by current week number to preserve round order
    const sortedMatches = [...updatedMatches].sort((a, b) => {
      const weekA = a.week_number ?? 999;
      const weekB = b.week_number ?? 999;
      return weekA - weekB;
    });

    // Distribute matches evenly across all available dates
    // If we have more dates than matches, each match gets its own date
    // If we have more matches than dates, distribute them evenly
    const matchesPerDate = Math.ceil(matchesCount / allowedDates.length);
    console.log('[expandSchedule] Distributing', matchesCount, 'matches across', allowedDates.length, 'dates =', matchesPerDate, 'matches per date');

    // Track which week we're on based on date changes
    let currentWeek = 1;
    let lastDateStr = '';

    sortedMatches.forEach((match, idx) => {
      // Assign matches evenly across dates
      const dateIndex = Math.floor(idx / matchesPerDate);
      const newDate = allowedDates[Math.min(dateIndex, allowedDates.length - 1)];

      // Increment week when date changes
      const newDateStr = newDate.toDateString();
      if (newDateStr !== lastDateStr && idx > 0) {
        currentWeek++;
      }
      lastDateStr = newDateStr;

      // Rotate through pitch pool for variety
      const { venue, pitch } = pitchPool[idx % pitchPool.length];

      // Assign venue and pitch
      if (match.venue_id !== venue.id) {
        changes.push({
          matchId: match.id,
          field: 'venue_id',
          oldValue: match.venue_id,
          newValue: venue.id,
        });
        match.venue_id = venue.id;
      }

      const newPitchId = pitch?.id || null;
      if (match.pitch_id !== newPitchId) {
        changes.push({
          matchId: match.id,
          field: 'pitch_id',
          oldValue: match.pitch_id,
          newValue: newPitchId,
        });
        match.pitch_id = newPitchId;
      }

      // Calculate start time based on venue availability
      const venueStartTime = venue.availability_start_datetime
        ? new Date(venue.availability_start_datetime)
        : new Date(newDate);

      // Set to selected date but preserve venue's time of day
      const startDateTime = new Date(newDate);
      startDateTime.setHours(venueStartTime.getHours());
      startDateTime.setMinutes(venueStartTime.getMinutes());

      const newDateISO = startDateTime.toISOString();
      if (match.scheduled_date !== newDateISO) {
        changes.push({
          matchId: match.id,
          field: 'scheduled_date',
          oldValue: match.scheduled_date,
          newValue: newDateISO,
        });
        match.scheduled_date = newDateISO;
      }

      if (match.week_number !== currentWeek) {
        changes.push({
          matchId: match.id,
          field: 'week_number',
          oldValue: match.week_number,
          newValue: currentWeek,
        });
        match.week_number = currentWeek;
      }
    });

    return { matches: updatedMatches, changes };
  }

  /**
   * Helper: Find venue with most availability
   */
  private findMostAvailableVenue(): Venue | null {
    let bestVenue: Venue | null = null;
    let maxAvailability = 0;

    this.venues.forEach(venue => {
      const availability = this.calculateVenueAvailability(venue);
      if (availability > maxAvailability) {
        maxAvailability = availability;
        bestVenue = venue;
      }
    });

    return bestVenue;
  }

  /**
   * Helper: Calculate total availability hours for a venue
   */
  private calculateVenueAvailability(venue: Venue): number {
    if (!venue.availability_start_datetime || !venue.availability_end_datetime) {
      return 0;
    }

    const start = new Date(venue.availability_start_datetime);
    const end = new Date(venue.availability_end_datetime);

    const hoursPerDay = (end.getHours() * 60 + end.getMinutes() - start.getHours() * 60 - start.getMinutes()) / 60;

    if (venue.is_recurring) {
      if (venue.recurrence_type === 'daily') {
        return hoursPerDay * 7; // 7 days per week
      } else if (venue.recurrence_type === 'weekly') {
        return hoursPerDay; // 1 day per week
      } else if (venue.recurrence_type === 'on_certain_days' && venue.recurrence_days) {
        return hoursPerDay * venue.recurrence_days.length;
      }
    }

    return hoursPerDay;
  }

  /**
   * Helper: Check if venue is generally available
   */
  private isVenueGenerallyAvailable(venue: Venue): boolean {
    return !!(venue.availability_start_datetime && venue.availability_end_datetime);
  }

  /**
   * Helper: Get earliest start date for schedule
   */
  private getEarliestStartDate(): Date | null {
    if (this.season.start_date) {
      return new Date(this.season.start_date);
    }

    // Find earliest match date
    const datesWithMatches = this.matches
      .map(m => m.scheduled_date)
      .filter(Boolean) as string[];

    if (datesWithMatches.length > 0) {
      const earliestDate = datesWithMatches.reduce((earliest, current) => {
        return new Date(current) < new Date(earliest) ? current : earliest;
      });
      return new Date(earliestDate);
    }

    return new Date();
  }

  /**
   * Helper: Find next available date for a match (considering venue availability)
   */
  private findNextAvailableDate(fromDate: Date, match: Match): Date {
    let candidate = new Date(fromDate);

    // If match has a venue, find a date that works for that venue
    if (match.venue_id) {
      const venue = this.venues.find(v => v.id === match.venue_id);
      if (venue && venue.is_recurring && venue.recurrence_days && venue.recurrence_type === 'on_certain_days') {
        // Find next occurrence of an allowed day
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        for (let i = 0; i < 14; i++) {
          const checkDate = new Date(candidate.getTime() + i * 24 * 60 * 60 * 1000);
          const dayName = dayNames[checkDate.getDay()];
          if (venue.recurrence_days.includes(dayName)) {
            return checkDate;
          }
        }
      }
    }

    return candidate;
  }

  /**
   * Helper: Shuffle array (Fisher-Yates algorithm)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate dates from a single schedule (date schedule or venue schedule)
   */
  private generateDatesFromSchedule(schedule: DateSchedule, label: string): Set<string> {
    const dates = new Set<string>();

    if (schedule.use_specific_dates && schedule.specific_dates) {
      console.log(`[${label}] Using specific dates`);
      schedule.specific_dates.forEach(dateStr => {
        dates.add(new Date(dateStr).toDateString());
      });
      return dates;
    }

    if (!schedule.is_recurring || !schedule.recurrence_type || !schedule.availability_start_datetime || !schedule.availability_end_datetime) {
      console.log(`[${label}] Invalid schedule configuration`);
      return dates;
    }

    const startDate = new Date(schedule.availability_start_datetime);
    const endDate = new Date(schedule.availability_end_datetime);

    // For date schedules, if start and end are same day, extend to season end
    let actualEndDate = endDate;
    if (startDate.toDateString() === endDate.toDateString()) {
      if (this.season.end_date) {
        actualEndDate = new Date(this.season.end_date);
      } else {
        actualEndDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      }
      console.log(`[${label}] Extended end date to:`, actualEndDate.toDateString());
    }

    this.generateRecurringDates(schedule, startDate, actualEndDate, dates);
    return dates;
  }

  /**
   * Generate recurring dates based on recurrence type
   */
  private generateRecurringDates(schedule: DateSchedule, startDate: Date, endDate: Date, dates: Set<string>): void {
    const { recurrence_type } = schedule;

    if (recurrence_type === 'daily') {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.add(new Date(d).toDateString());
      }
    } else if (recurrence_type === 'weekly') {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
        dates.add(new Date(d).toDateString());
      }
    } else if (recurrence_type === 'biweekly') {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 14)) {
        dates.add(new Date(d).toDateString());
      }
    } else if (recurrence_type === 'semimonthly') {
      for (let d = new Date(startDate); d <= endDate; ) {
        dates.add(new Date(d).toDateString());
        if (d.getDate() < 15) {
          d.setDate(15);
        } else {
          d.setMonth(d.getMonth() + 1);
          d.setDate(1);
        }
      }
    } else if (recurrence_type === 'monthly') {
      for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
        dates.add(new Date(d).toDateString());
      }
    } else if (recurrence_type === 'on_certain_days' && schedule.recurrence_days) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const allowedDayNumbers = schedule.recurrence_days.map(name => dayNames.indexOf(name));
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (allowedDayNumbers.includes(d.getDay())) {
          dates.add(new Date(d).toDateString());
        }
      }
    } else if (recurrence_type === 'custom' && schedule.recurrence_interval && schedule.recurrence_period) {
      let d = new Date(startDate);
      while (d <= endDate) {
        dates.add(new Date(d).toDateString());
        if (schedule.recurrence_period === 'days') {
          d.setDate(d.getDate() + schedule.recurrence_interval);
        } else if (schedule.recurrence_period === 'weeks') {
          d.setDate(d.getDate() + (schedule.recurrence_interval * 7));
        } else if (schedule.recurrence_period === 'months') {
          d.setMonth(d.getMonth() + schedule.recurrence_interval);
        }
      }
    }
  }

  /**
   * Generate all allowed dates from date schedules AND venue schedules (intersection - most restrictive)
   */
  private getAllowedDates(): Date[] {
    console.log('[getAllowedDates] dateSchedules:', this.dateSchedules.length, 'venues:', this.venues.length);

    const constraintSets: Set<string>[] = [];

    // Generate dates from each date schedule
    this.dateSchedules.forEach((schedule, idx) => {
      const dates = this.generateDatesFromSchedule(schedule, `DateSchedule${idx}`);
      console.log(`[getAllowedDates] DateSchedule${idx} generated:`, dates.size, 'dates');
      if (dates.size > 0) {
        constraintSets.push(dates);
      }
    });

    // Generate dates from each venue schedule
    this.venues.forEach((venue, idx) => {
      if (venue.is_recurring && venue.recurrence_type && venue.availability_start_datetime && venue.availability_end_datetime) {
        const venueSchedule: DateSchedule = {
          id: venue.id,
          name: venue.name,
          use_specific_dates: venue.use_specific_dates || false,
          is_recurring: venue.is_recurring,
          recurrence_type: venue.recurrence_type,
          recurrence_days: venue.recurrence_days || null,
          recurrence_interval: null,
          recurrence_period: null,
          availability_start_datetime: venue.availability_start_datetime,
          availability_end_datetime: venue.availability_end_datetime,
          specific_dates: venue.specific_dates || null
        };
        const dates = this.generateDatesFromSchedule(venueSchedule, `Venue${idx}`);
        console.log(`[getAllowedDates] Venue${idx} (${venue.name}) generated:`, dates.size, 'dates');
        if (dates.size > 0) {
          constraintSets.push(dates);
        }
      }
    });

    // If no constraints, use season start/end with weekly intervals
    if (constraintSets.length === 0) {
      console.log('[getAllowedDates] No constraints, using season fallback');
      const startDate = this.season.start_date ? new Date(this.season.start_date) : new Date();
      const endDate = this.season.end_date ? new Date(this.season.end_date) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      const fallbackDates: Date[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
        fallbackDates.push(new Date(d));
      }
      return fallbackDates;
    }

    // Find INTERSECTION of all constraint sets (most restrictive)
    console.log('[getAllowedDates] Finding intersection of', constraintSets.length, 'constraint sets');
    let intersection = constraintSets[0];
    for (let i = 1; i < constraintSets.length; i++) {
      const newIntersection = new Set<string>();
      for (const dateStr of intersection) {
        if (constraintSets[i].has(dateStr)) {
          newIntersection.add(dateStr);
        }
      }
      intersection = newIntersection;
      console.log(`[getAllowedDates] After intersecting set ${i}:`, intersection.size, 'dates remain');
    }

    // Convert back to Date array and sort
    let allowedDates = Array.from(intersection).map(dateStr => new Date(dateStr));
    allowedDates.sort((a, b) => a.getTime() - b.getTime());

    console.log('[getAllowedDates] Before blackouts:', allowedDates.length, 'dates');

    // Exclude blackout dates
    allowedDates = this.filterOutBlackoutDates(allowedDates);

    console.log('[getAllowedDates] Final allowed dates after blackouts:', allowedDates.length);
    return allowedDates;
  }

  /**
   * Filter out blackout dates from the allowed dates list
   */
  private filterOutBlackoutDates(dates: Date[]): Date[] {
    if (this.blackoutDates.length === 0) return dates;

    const blackoutDateStrings = this.generateBlackoutDateStrings();
    console.log('[filterOutBlackoutDates] Generated', blackoutDateStrings.size, 'blackout dates');

    return dates.filter(date => {
      const dateStr = date.toDateString();
      return !blackoutDateStrings.has(dateStr);
    });
  }

  /**
   * Generate a set of all blackout date strings
   */
  private generateBlackoutDateStrings(): Set<string> {
    const blackoutSet = new Set<string>();
    const seasonStart = this.season.start_date ? new Date(this.season.start_date) : new Date();
    const seasonEnd = this.season.end_date ? new Date(this.season.end_date) : new Date(seasonStart.getTime() + 365 * 24 * 60 * 60 * 1000);

    this.blackoutDates.forEach((blackout, idx) => {
      console.log(`[generateBlackoutDateStrings] Processing blackout ${idx}: ${blackout.name} (${blackout.blackout_type})`);

      if (blackout.blackout_type === 'single_date' && blackout.start_date) {
        const date = new Date(blackout.start_date);
        blackoutSet.add(date.toDateString());
        console.log(`  Added single date: ${date.toDateString()}`);
      } else if (blackout.blackout_type === 'date_range' && blackout.start_date && blackout.end_date) {
        const start = new Date(blackout.start_date);
        const end = new Date(blackout.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          blackoutSet.add(new Date(d).toDateString());
        }
        console.log(`  Added date range: ${start.toDateString()} to ${end.toDateString()}`);
      } else if (blackout.blackout_type === 'holiday' && blackout.start_date) {
        const date = new Date(blackout.start_date);
        blackoutSet.add(date.toDateString());
        console.log(`  Added holiday: ${date.toDateString()}`);
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
        console.log(`  Added holiday weekend: ${blackout.start_date} with ${extendedDates.length} dates`);
        extendedDates.forEach(dateString => {
          const date = new Date(dateString);
          blackoutSet.add(date.toDateString());
          console.log(`    Added: ${date.toDateString()}`);
        });
      } else if (blackout.blackout_type === 'recurring' && blackout.start_date && blackout.end_date) {
        const start = new Date(blackout.start_date);
        const end = new Date(blackout.end_date);
        this.generateRecurringBlackoutDates(blackout, start, end, blackoutSet);
        console.log(`  Added recurring dates (${blackout.recurrence_type})`);
      }
    });

    return blackoutSet;
  }

  /**
   * Generate recurring blackout dates
   */
  private generateRecurringBlackoutDates(blackout: BlackoutDate, startDate: Date, endDate: Date, dates: Set<string>): void {
    if (blackout.recurrence_type === 'daily') {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.add(new Date(d).toDateString());
      }
    } else if (blackout.recurrence_type === 'weekly') {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
        dates.add(new Date(d).toDateString());
      }
    } else if (blackout.recurrence_type === 'biweekly') {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 14)) {
        dates.add(new Date(d).toDateString());
      }
    } else if (blackout.recurrence_type === 'monthly') {
      for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
        dates.add(new Date(d).toDateString());
      }
    } else if (blackout.recurrence_type === 'on_certain_days' && blackout.recurrence_days) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const allowedDayNumbers = blackout.recurrence_days.map(name => dayNames.indexOf(name));
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (allowedDayNumbers.includes(d.getDay())) {
          dates.add(new Date(d).toDateString());
        }
      }
    } else if (blackout.recurrence_type === 'custom' && blackout.recurrence_interval && blackout.recurrence_period) {
      let d = new Date(startDate);
      while (d <= endDate) {
        dates.add(new Date(d).toDateString());
        if (blackout.recurrence_period === 'days') {
          d.setDate(d.getDate() + blackout.recurrence_interval);
        } else if (blackout.recurrence_period === 'weeks') {
          d.setDate(d.getDate() + (blackout.recurrence_interval * 7));
        } else if (blackout.recurrence_period === 'months') {
          d.setMonth(d.getMonth() + blackout.recurrence_interval);
        }
      }
    }
  }

  /**
   * Check if a date is allowed by the date schedules
   */
  private isDateAllowed(date: Date): boolean {
    if (this.dateSchedules.length === 0) return true; // No restrictions

    return this.dateSchedules.some(schedule => {
      if (schedule.use_specific_dates && schedule.specific_dates) {
        return schedule.specific_dates.some(dateStr => {
          const scheduleDate = new Date(dateStr);
          return scheduleDate.toDateString() === date.toDateString();
        });
      }

      if (!schedule.availability_start_datetime || !schedule.availability_end_datetime) return false;

      const startDate = new Date(schedule.availability_start_datetime);
      const endDate = new Date(schedule.availability_end_datetime);

      // Check if date is within range
      if (date < startDate || date > endDate) return false;

      // Check recurrence pattern
      if (schedule.is_recurring) {
        if (schedule.recurrence_type === 'daily') {
          return true; // Any day within range
        } else if (schedule.recurrence_type === 'weekly') {
          return date.getDay() === startDate.getDay();
        } else if (schedule.recurrence_type === 'on_certain_days' && schedule.recurrence_days) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dateDayName = dayNames[date.getDay()];
          return schedule.recurrence_days.includes(dateDayName);
        }
      }

      return true; // Within range
    });
  }
}
