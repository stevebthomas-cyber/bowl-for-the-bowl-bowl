/**
 * Schedule Validation Utilities
 *
 * Validates matches and returns errors and warnings.
 * Errors block publishing/sharing, warnings are informational only.
 */

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
  home_team?: { name: string } | null;
  away_team?: { name: string } | null;
  venue?: { name: string } | null;
  pitch?: { name: string } | null;
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  matchId?: string;
  matchNumber?: number;
  message: string;
  category: 'teams' | 'venues' | 'dates' | 'balance' | 'integrity';
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  isValid: boolean; // False if there are errors
  canPublish: boolean; // False if there are errors
}

export function validateSchedule(matches: Match[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (matches.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'Schedule is empty',
      category: 'integrity',
    });

    return {
      errors,
      warnings,
      isValid: true,
      canPublish: false,
    };
  }

  // Check each match for issues
  matches.forEach((match) => {
    // ERROR: Team playing itself
    if (match.home_team_id && match.away_team_id && match.home_team_id === match.away_team_id) {
      errors.push({
        type: 'error',
        matchId: match.id,
        matchNumber: match.match_number,
        message: `Match ${match.match_number}: Team cannot play itself`,
        category: 'integrity',
      });
    }

    // WARNING: Missing teams
    if (!match.home_team_id || !match.away_team_id) {
      warnings.push({
        type: 'warning',
        matchId: match.id,
        matchNumber: match.match_number,
        message: `Match ${match.match_number}: Missing team assignment`,
        category: 'teams',
      });
    }

    // WARNING: Missing venue
    if (!match.venue_id) {
      warnings.push({
        type: 'warning',
        matchId: match.id,
        matchNumber: match.match_number,
        message: `Match ${match.match_number}: Missing venue assignment`,
        category: 'venues',
      });
    }

    // WARNING: Missing date
    if (!match.scheduled_date) {
      warnings.push({
        type: 'warning',
        matchId: match.id,
        matchNumber: match.match_number,
        message: `Match ${match.match_number}: Missing scheduled date`,
        category: 'dates',
      });
    }
  });

  // ERROR: Check for venue/pitch conflicts (multiple games at same time/place)
  const dateVenuePitchMap = new Map<string, Match[]>();

  matches.forEach((match) => {
    if (match.scheduled_date && match.venue_id) {
      const pitchKey = match.pitch_id || 'no-pitch';
      const key = `${match.scheduled_date}-${match.venue_id}-${pitchKey}`;

      if (!dateVenuePitchMap.has(key)) {
        dateVenuePitchMap.set(key, []);
      }
      dateVenuePitchMap.get(key)!.push(match);
    }
  });

  // Find conflicts
  dateVenuePitchMap.forEach((conflictingMatches, key) => {
    if (conflictingMatches.length > 1) {
      const matchNumbers = conflictingMatches.map(m => m.match_number).join(', ');
      const venueName = conflictingMatches[0].venue?.name || 'Unknown Venue';
      const pitchName = conflictingMatches[0].pitch?.name;
      const location = pitchName ? `${venueName} - ${pitchName}` : venueName;

      errors.push({
        type: 'error',
        message: `Matches ${matchNumbers}: Venue/pitch conflict at ${location}`,
        category: 'venues',
      });
    }
  });

  // ERROR: Check for team playing multiple games at same time
  const dateTeamMap = new Map<string, { match: Match; team: 'home' | 'away' }[]>();

  matches.forEach((match) => {
    if (match.scheduled_date) {
      if (match.home_team_id) {
        const key = `${match.scheduled_date}-${match.home_team_id}`;
        if (!dateTeamMap.has(key)) {
          dateTeamMap.set(key, []);
        }
        dateTeamMap.get(key)!.push({ match, team: 'home' });
      }

      if (match.away_team_id) {
        const key = `${match.scheduled_date}-${match.away_team_id}`;
        if (!dateTeamMap.has(key)) {
          dateTeamMap.set(key, []);
        }
        dateTeamMap.get(key)!.push({ match, team: 'away' });
      }
    }
  });

  // Find team conflicts
  dateTeamMap.forEach((teamMatches, key) => {
    if (teamMatches.length > 1) {
      const matchNumbers = teamMatches.map(tm => tm.match.match_number).join(', ');
      const teamName = teamMatches[0].team === 'home'
        ? teamMatches[0].match.home_team?.name
        : teamMatches[0].match.away_team?.name;

      errors.push({
        type: 'error',
        message: `Matches ${matchNumbers}: ${teamName} scheduled for multiple games at same time`,
        category: 'teams',
      });
    }
  });

  // WARNING: Check for schedule balance (all teams play roughly same number of games)
  // Only count regular/fixture matches, not friendlies
  const fixtureMatches = matches.filter(m => m.match_type !== 'friendly');
  const teamGameCount = new Map<string, number>();

  fixtureMatches.forEach((match) => {
    if (match.home_team_id) {
      teamGameCount.set(match.home_team_id, (teamGameCount.get(match.home_team_id) || 0) + 1);
    }
    if (match.away_team_id) {
      teamGameCount.set(match.away_team_id, (teamGameCount.get(match.away_team_id) || 0) + 1);
    }
  });

  if (teamGameCount.size > 0) {
    const gameCounts = Array.from(teamGameCount.values());
    const maxGames = Math.max(...gameCounts);
    const minGames = Math.min(...gameCounts);

    if (maxGames - minGames > 2) {
      warnings.push({
        type: 'warning',
        message: `Unbalanced schedule: Some teams have ${maxGames} games while others have ${minGames}`,
        category: 'balance',
      });
    }
  }

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
    canPublish: errors.length === 0,
  };
}

/**
 * Get validation issues for a specific match
 */
export function getMatchValidation(match: Match, allMatches: Match[]): ValidationIssue[] {
  const result = validateSchedule(allMatches);
  return [...result.errors, ...result.warnings].filter(
    issue => issue.matchId === match.id
  );
}
