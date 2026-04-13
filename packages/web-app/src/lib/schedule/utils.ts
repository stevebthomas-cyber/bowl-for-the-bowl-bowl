/**
 * Schedule Utility Functions
 *
 * Helper functions for sorting, filtering, grouping, and manipulating schedules.
 */

import type {
  ScheduledMatch,
  SortConfig,
  FilterConfig,
  WeekGroup
} from '../../types/schedule';

/**
 * Sort matches based on configuration
 */
export function sortMatches(
  matches: ScheduledMatch[],
  sortConfig: SortConfig
): ScheduledMatch[] {
  const sorted = [...matches];

  sorted.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortConfig.field) {
      case 'matchNumber':
        aVal = a.matchNumber;
        bVal = b.matchNumber;
        break;
      case 'scheduledDate':
        aVal = a.scheduledDate || '9999-12-31'; // Unscheduled dates go to end
        bVal = b.scheduledDate || '9999-12-31';
        break;
      case 'weekNumber':
        aVal = a.weekNumber;
        bVal = b.weekNumber;
        break;
      case 'matchType':
        aVal = a.matchType;
        bVal = b.matchType;
        break;
      case 'homeTeam':
        aVal = a.homeTeamName || a.homeSlot;
        bVal = b.homeTeamName || b.homeSlot;
        break;
      case 'awayTeam':
        aVal = a.awayTeamName || a.awaySlot;
        bVal = b.awayTeamName || b.awaySlot;
        break;
      default:
        aVal = a.matchNumber;
        bVal = b.matchNumber;
    }

    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    if (aVal < bVal) return -1 * direction;
    if (aVal > bVal) return 1 * direction;
    return 0;
  });

  return sorted;
}

/**
 * Filter matches based on filter configuration
 */
export function filterMatches(
  matches: ScheduledMatch[],
  filterConfig: FilterConfig
): ScheduledMatch[] {
  return matches.filter(match => {
    // Filter by match type
    if (filterConfig.matchTypes.size > 0 && !filterConfig.matchTypes.has(match.matchType)) {
      return false;
    }

    // Filter by week number
    if (filterConfig.weekNumbers.length > 0 && !filterConfig.weekNumbers.includes(match.weekNumber)) {
      return false;
    }

    // Filter by date range
    if (filterConfig.dateRange.start && match.scheduledDate < filterConfig.dateRange.start) {
      return false;
    }
    if (filterConfig.dateRange.end && match.scheduledDate > filterConfig.dateRange.end) {
      return false;
    }

    // Filter by teams
    if (filterConfig.teams.size > 0) {
      const hasTeam = filterConfig.teams.has(match.homeSlot) || filterConfig.teams.has(match.awaySlot);
      if (!hasTeam) return false;
    }

    // Filter by unassigned slots
    if (filterConfig.hasUnassignedSlots !== null) {
      const hasUnassigned = !match.homeTeamName || !match.awayTeamName;
      if (filterConfig.hasUnassignedSlots !== hasUnassigned) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Group matches by week number
 */
export function groupMatchesByWeek(matches: ScheduledMatch[]): WeekGroup[] {
  const weekMap = new Map<number, ScheduledMatch[]>();

  matches.forEach(match => {
    if (!weekMap.has(match.weekNumber)) {
      weekMap.set(match.weekNumber, []);
    }
    weekMap.get(match.weekNumber)!.push(match);
  });

  const weeks: WeekGroup[] = [];
  weekMap.forEach((matches, weekNumber) => {
    const sortedMatches = matches.sort((a, b) => a.matchNumber - b.matchNumber);
    const startDate = sortedMatches[0]?.scheduledDate || '';

    weeks.push({
      weekNumber,
      startDate,
      matches: sortedMatches
    });
  });

  return weeks.sort((a, b) => a.weekNumber - b.weekNumber);
}

/**
 * Check if a string is a UUID
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Get display name for a slot (team name or slot identifier)
 */
export function getSlotDisplayName(slot: string, teamName?: string): string {
  if (teamName) return teamName;

  // Format slot identifiers for display
  if (slot.startsWith('D')) {
    // D1-S1 -> "Division 1, Slot 1"
    const match = slot.match(/D(\d+)-S(\d+)/);
    if (match) return `Division ${match[1]}, Slot ${match[2]}`;
  } else if (slot.startsWith('P')) {
    // P1-S1 -> "Pool 1, Slot 1"
    const match = slot.match(/P(\d+)-S(\d+)/);
    if (match) return `Pool ${match[1]}, Slot ${match[2]}`;
  } else if (slot.startsWith('PLAYOFF-')) {
    // PLAYOFF-SEED1 -> "Playoff Seed 1"
    return slot.replace('PLAYOFF-', 'Playoff ').replace('-', ' ');
  } else if (slot.startsWith('SLOT-')) {
    // SLOT-1 -> "Slot 1"
    return slot.replace('SLOT-', 'Slot ');
  }

  return slot;
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return 'TBD';

  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get unique list of all teams/slots in schedule
 */
export function getUniqueTeams(matches: ScheduledMatch[]): Array<{ id: string; name: string }> {
  const teamMap = new Map<string, string>();

  matches.forEach(match => {
    if (!teamMap.has(match.homeSlot)) {
      teamMap.set(match.homeSlot, match.homeTeamName || getSlotDisplayName(match.homeSlot));
    }
    if (!teamMap.has(match.awaySlot)) {
      teamMap.set(match.awaySlot, match.awayTeamName || getSlotDisplayName(match.awaySlot));
    }
  });

  return Array.from(teamMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get unique week numbers from schedule
 */
export function getUniqueWeeks(matches: ScheduledMatch[]): number[] {
  const weeks = new Set<number>();
  matches.forEach(match => weeks.add(match.weekNumber));
  return Array.from(weeks).sort((a, b) => a - b);
}

/**
 * Calculate summary statistics for a schedule
 */
export function calculateScheduleStats(matches: ScheduledMatch[]): {
  totalMatches: number;
  regularSeasonMatches: number;
  playoffMatches: number;
  totalWeeks: number;
  matchesByType: Record<string, number>;
  unassignedSlots: number;
} {
  const regularSeasonMatches = matches.filter(m => m.matchType !== 'playoff');
  const playoffMatches = matches.filter(m => m.matchType === 'playoff');

  const matchesByType: Record<string, number> = {};
  matches.forEach(match => {
    matchesByType[match.matchType] = (matchesByType[match.matchType] || 0) + 1;
  });

  const unassignedSlots = new Set<string>();
  matches.forEach(match => {
    if (!match.homeTeamName) unassignedSlots.add(match.homeSlot);
    if (!match.awayTeamName) unassignedSlots.add(match.awaySlot);
  });

  return {
    totalMatches: matches.length,
    regularSeasonMatches: regularSeasonMatches.length,
    playoffMatches: playoffMatches.length,
    totalWeeks: getUniqueWeeks(matches).length,
    matchesByType,
    unassignedSlots: unassignedSlots.size
  };
}

/**
 * Move a match to a different date
 */
export function moveMatch(
  matches: ScheduledMatch[],
  matchNumber: number,
  newDate: string,
  newWeekNumber?: number
): ScheduledMatch[] {
  return matches.map(match => {
    if (match.matchNumber === matchNumber) {
      return {
        ...match,
        scheduledDate: newDate,
        weekNumber: newWeekNumber ?? match.weekNumber
      };
    }
    return match;
  });
}

/**
 * Update a match with new values
 */
export function updateMatch(
  matches: ScheduledMatch[],
  matchNumber: number,
  updates: Partial<ScheduledMatch>
): ScheduledMatch[] {
  return matches.map(match => {
    if (match.matchNumber === matchNumber) {
      return { ...match, ...updates };
    }
    return match;
  });
}

/**
 * Delete a match from the schedule
 */
export function deleteMatch(
  matches: ScheduledMatch[],
  matchNumber: number
): ScheduledMatch[] {
  return matches.filter(match => match.matchNumber !== matchNumber);
}

/**
 * Reorder matches within a week
 */
export function reorderMatchesInWeek(
  matches: ScheduledMatch[],
  weekNumber: number,
  newOrder: number[]
): ScheduledMatch[] {
  const weekMatches = matches.filter(m => m.weekNumber === weekNumber);
  const otherMatches = matches.filter(m => m.weekNumber !== weekNumber);

  const reordered = newOrder.map(matchNum =>
    weekMatches.find(m => m.matchNumber === matchNum)!
  );

  return [...otherMatches, ...reordered].sort((a, b) => a.matchNumber - b.matchNumber);
}
