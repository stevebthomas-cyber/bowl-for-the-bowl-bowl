/**
 * Schedule Validation Logic
 *
 * Validation rules for schedules to ensure data integrity.
 */

import type { ScheduledMatch, ValidationIssue, ScheduleConfig } from '../../types/schedule';

/**
 * Comprehensive schedule validation
 */
export function validateSchedule(
  matches: ScheduledMatch[],
  config: ScheduleConfig
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Run all validation rules
  issues.push(...validateNoDuplicateMatchups(matches, config));
  issues.push(...validateNoSelfMatchups(matches));
  issues.push(...validateNoDoubleBooking(matches));
  issues.push(...validateUnassignedSlots(matches));

  return issues;
}

/**
 * Check for duplicate matchups (unless home-and-home is configured)
 */
export function validateNoDuplicateMatchups(
  matches: ScheduledMatch[],
  config: ScheduleConfig
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Don't check for duplicate matchups if we're doing home-and-home (>1 game vs opponent)
  const maxGamesVsOpponent = Math.max(
    config.scheduleType === 'divisional' ? config.intraDivisionGames : 1,
    config.scheduleType === 'divisional' ? config.interDivisionGames : 1,
    config.scheduleType === 'pool-only' ? config.gamesPerTeamInPool : 1
  );

  if (maxGamesVsOpponent === 1) {
    // Only check for duplicates if not doing home-and-home
    const matchupCounts = new Map<string, number[]>();
    matches.forEach(match => {
      const key = [match.homeSlot, match.awaySlot].sort().join('-');
      if (!matchupCounts.has(key)) matchupCounts.set(key, []);
      matchupCounts.get(key)!.push(match.matchNumber);
    });

    matchupCounts.forEach((matchNumbers, key) => {
      if (matchNumbers.length > 1) {
        issues.push({
          type: 'warning',
          message: `Duplicate matchup detected: ${key.split('-').join(' vs ')}`,
          matchNumbers
        });
      }
    });
  }

  return issues;
}

/**
 * Check that no team plays itself
 */
export function validateNoSelfMatchups(matches: ScheduledMatch[]): ValidationIssue[] {
  const selfMatchups = matches.filter(m => m.homeSlot === m.awaySlot);

  if (selfMatchups.length > 0) {
    return [{
      type: 'error',
      message: `${selfMatchups.length} invalid match(es): teams cannot play themselves`,
      matchNumbers: selfMatchups.map(m => m.matchNumber)
    }];
  }

  return [];
}

/**
 * Check that no team plays multiple matches on the same date
 */
export function validateNoDoubleBooking(matches: ScheduledMatch[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byDate = new Map<string, Map<string, number[]>>();

  matches.forEach(match => {
    if (!match.scheduledDate) return; // Skip matches without dates

    const date = match.scheduledDate;
    if (!byDate.has(date)) byDate.set(date, new Map());

    const dateMatches = byDate.get(date)!;
    [match.homeSlot, match.awaySlot].forEach(slot => {
      if (!dateMatches.has(slot)) dateMatches.set(slot, []);
      dateMatches.get(slot)!.push(match.matchNumber);
    });
  });

  byDate.forEach((teams, date) => {
    teams.forEach((matchNumbers, team) => {
      if (matchNumbers.length > 1) {
        issues.push({
          type: 'error',
          message: `${team} plays ${matchNumbers.length} matches on ${date}`,
          matchNumbers
        });
      }
    });
  });

  return issues;
}

/**
 * Warn about unassigned slots
 */
export function validateUnassignedSlots(matches: ScheduledMatch[]): ValidationIssue[] {
  const unassignedSlots = new Set<string>();

  matches.forEach(match => {
    if (!match.homeTeamName) unassignedSlots.add(match.homeSlot);
    if (!match.awayTeamName) unassignedSlots.add(match.awaySlot);
  });

  if (unassignedSlots.size > 0) {
    return [{
      type: 'warning',
      message: `${unassignedSlots.size} slot(s) don't have teams assigned yet. Teams can be assigned later.`
    }];
  }

  return [];
}

/**
 * Validate that schedule fits within season date range
 */
export function validateWithinSeasonDates(
  matches: ScheduledMatch[],
  startDate: string,
  endDate: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const outsideRange = matches.filter(m => {
    if (!m.scheduledDate) return false;
    const date = new Date(m.scheduledDate);
    return date < start || date > end;
  });

  if (outsideRange.length > 0) {
    outsideRange.forEach(match => {
      issues.push({
        type: 'error',
        message: `Match #${match.matchNumber} scheduled outside season (${match.scheduledDate})`,
        matchNumber: match.matchNumber
      });
    });
  }

  return issues;
}

/**
 * Validate that daily match limit is respected
 */
export function validateDailyMatchLimit(
  matches: ScheduledMatch[],
  maxMatchesPerDay: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byDate = new Map<string, number[]>();

  matches.forEach(match => {
    if (!match.scheduledDate) return;
    const date = match.scheduledDate;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(match.matchNumber);
  });

  byDate.forEach((matchNumbers, date) => {
    if (matchNumbers.length > maxMatchesPerDay) {
      issues.push({
        type: 'warning',
        message: `${matchNumbers.length} matches on ${date} (limit: ${maxMatchesPerDay})`,
        matchNumbers
      });
    }
  });

  return issues;
}

/**
 * Validate a single match for real-time editing
 */
export function validateMatch(
  match: ScheduledMatch,
  allMatches: ScheduledMatch[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check self-matchup
  if (match.homeSlot === match.awaySlot) {
    issues.push({
      type: 'error',
      message: `Match #${match.matchNumber}: Team cannot play itself`,
      matchNumber: match.matchNumber
    });
  }

  // Check for conflicts on the same date (double booking)
  if (match.scheduledDate) {
    const sameDate = allMatches.filter(
      m => m.matchNumber !== match.matchNumber && m.scheduledDate === match.scheduledDate
    );

    const conflictingMatches = sameDate.filter(
      m => m.homeSlot === match.homeSlot || m.awaySlot === match.homeSlot ||
           m.homeSlot === match.awaySlot || m.awaySlot === match.awaySlot
    );

    if (conflictingMatches.length > 0) {
      const teams = new Set<string>();
      if (conflictingMatches.some(m => m.homeSlot === match.homeSlot || m.awaySlot === match.homeSlot)) {
        teams.add(match.homeSlot);
      }
      if (conflictingMatches.some(m => m.homeSlot === match.awaySlot || m.awaySlot === match.awaySlot)) {
        teams.add(match.awaySlot);
      }

      issues.push({
        type: 'error',
        message: `Match #${match.matchNumber}: Team(s) ${Array.from(teams).join(', ')} already playing on ${match.scheduledDate}`,
        matchNumber: match.matchNumber
      });
    }
  }

  return issues;
}
