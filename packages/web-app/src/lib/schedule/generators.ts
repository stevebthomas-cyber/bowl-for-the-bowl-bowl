/**
 * Schedule Generation Logic
 *
 * Algorithms for generating different types of schedules (round-robin, divisional, pool, playoffs).
 */

import type { Team, ScheduleConfig, ScheduledMatch, ValidationIssue } from '../../types/schedule';
import { validateSchedule } from './validators';

/**
 * Main schedule generation orchestrator
 */
export function generateSchedule(
  config: ScheduleConfig,
  teams: Team[]
): { schedule: ScheduledMatch[]; issues: ValidationIssue[] } {
  const newSchedule: ScheduledMatch[] = [];
  const issues: ValidationIssue[] = [];
  let matchNumber = 1;

  if (config.gameDays.length === 0) {
    issues.push({
      type: 'error',
      message: 'Must select at least one game day'
    });
    return { schedule: [], issues };
  }

  // Generate matches based on schedule type
  if (config.scheduleType === 'round-robin') {
    matchNumber = generateRoundRobinSchedule(newSchedule, matchNumber, config, teams);
  } else if (config.scheduleType === 'divisional') {
    matchNumber = generateDivisionalSchedule(newSchedule, matchNumber, config, teams);
  } else if (config.scheduleType === 'pool-only') {
    matchNumber = generatePoolSchedule(newSchedule, matchNumber, config, teams);
  }

  // Generate playoff matches if enabled
  if (config.includePlayoffs && config.playoffFormat !== 'none') {
    matchNumber = generatePlayoffSchedule(newSchedule, matchNumber, config);
  }

  // Assign dates to matches
  assignDatesToMatches(newSchedule, issues, config);

  // Validate schedule
  issues.push(...validateSchedule(newSchedule, config));

  return { schedule: newSchedule, issues };
}

/**
 * Generate round-robin schedule where everyone plays everyone
 */
export function generateRoundRobinSchedule(
  schedule: ScheduledMatch[],
  startMatchNumber: number,
  config: ScheduleConfig,
  teams: Team[]
): number {
  const numSlots = config.teamsPerDivision * config.divisionsCount;
  const slots = Array.from({ length: numSlots }, (_, i) => `SLOT-${i + 1}`);

  // Try to assign actual teams if they exist
  const teamsByIndex = new Map<number, Team>();
  teams.forEach((team, idx) => {
    if (idx < numSlots) teamsByIndex.set(idx, team);
  });

  if (slots.length % 2 !== 0) {
    slots.push('BYE');
  }

  const numRounds = slots.length - 1;
  const halfSize = slots.length / 2;
  const slotIndices = slots.map((_, i) => i);

  let matchNum = startMatchNumber;

  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < halfSize; i++) {
      const home = slotIndices[i];
      const away = slotIndices[slots.length - 1 - i];

      if (slots[home] === 'BYE' || slots[away] === 'BYE') continue;

      const homeTeam = teamsByIndex.get(home);
      const awayTeam = teamsByIndex.get(away);

      schedule.push({
        matchNumber: matchNum++,
        homeSlot: homeTeam?.id || slots[home],
        homeTeamName: homeTeam?.name,
        awaySlot: awayTeam?.id || slots[away],
        awayTeamName: awayTeam?.name,
        scheduledDate: '',
        weekNumber: 0,
        matchType: 'round-robin',
      });
    }
    slotIndices.splice(1, 0, slotIndices.pop()!);
  }

  return matchNum;
}

/**
 * Generate divisional schedule with intra-division and inter-division games
 */
export function generateDivisionalSchedule(
  schedule: ScheduledMatch[],
  startMatchNumber: number,
  config: ScheduleConfig,
  teams: Team[]
): number {
  let matchNum = startMatchNumber;

  // Create division slot structure
  const divisionSlots: string[][] = [];
  for (let d = 0; d < config.divisionsCount; d++) {
    const divSlots = Array.from({ length: config.teamsPerDivision }, (_, s) => `D${d + 1}-S${s + 1}`);
    divisionSlots.push(divSlots);
  }

  // Try to map existing teams to slots
  const teamsByDivision = new Map<number, Team[]>();
  teams.forEach(team => {
    const div = team.division ?? 1;
    if (!teamsByDivision.has(div)) teamsByDivision.set(div, []);
    teamsByDivision.get(div)!.push(team);
  });

  // Intra-division games
  for (let d = 0; d < config.divisionsCount; d++) {
    const slots = divisionSlots[d];
    const divTeams = teamsByDivision.get(d + 1) || [];

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        for (let game = 0; game < config.intraDivisionGames; game++) {
          const isHomeFirst = game % 2 === 0;
          const homeIdx = isHomeFirst ? i : j;
          const awayIdx = isHomeFirst ? j : i;

          schedule.push({
            matchNumber: matchNum++,
            homeSlot: divTeams[homeIdx]?.id || slots[homeIdx],
            homeTeamName: divTeams[homeIdx]?.name,
            awaySlot: divTeams[awayIdx]?.id || slots[awayIdx],
            awayTeamName: divTeams[awayIdx]?.name,
            scheduledDate: '',
            weekNumber: 0,
            matchType: 'intra-division',
          });
        }
      }
    }
  }

  // Inter-division games
  for (let d1 = 0; d1 < config.divisionsCount; d1++) {
    for (let d2 = d1 + 1; d2 < config.divisionsCount; d2++) {
      const slots1 = divisionSlots[d1];
      const slots2 = divisionSlots[d2];
      const teams1 = teamsByDivision.get(d1 + 1) || [];
      const teams2 = teamsByDivision.get(d2 + 1) || [];

      for (let s1 = 0; s1 < slots1.length; s1++) {
        for (let s2 = 0; s2 < slots2.length; s2++) {
          for (let game = 0; game < config.interDivisionGames; game++) {
            const isHomeFirst = game % 2 === 0;

            schedule.push({
              matchNumber: matchNum++,
              homeSlot: isHomeFirst ? (teams1[s1]?.id || slots1[s1]) : (teams2[s2]?.id || slots2[s2]),
              homeTeamName: isHomeFirst ? teams1[s1]?.name : teams2[s2]?.name,
              awaySlot: isHomeFirst ? (teams2[s2]?.id || slots2[s2]) : (teams1[s1]?.id || slots1[s1]),
              awayTeamName: isHomeFirst ? teams2[s2]?.name : teams1[s1]?.name,
              scheduledDate: '',
              weekNumber: 0,
              matchType: 'inter-division',
            });
          }
        }
      }
    }
  }

  return matchNum;
}

/**
 * Generate pool-only schedule (separate pools, games within each pool)
 */
export function generatePoolSchedule(
  schedule: ScheduledMatch[],
  startMatchNumber: number,
  config: ScheduleConfig,
  teams: Team[]
): number {
  let matchNum = startMatchNumber;

  // Create pool slot structure
  const poolSlots: string[][] = [];
  for (let p = 0; p < config.poolsCount; p++) {
    const pSlots = Array.from({ length: config.teamsPerPool }, (_, s) => `P${p + 1}-S${s + 1}`);
    poolSlots.push(pSlots);
  }

  // Try to map existing teams to pools
  const teamsByPool = new Map<number, Team[]>();
  teams.forEach((team, idx) => {
    const pool = Math.floor(idx / config.teamsPerPool) + 1;
    if (pool <= config.poolsCount) {
      if (!teamsByPool.has(pool)) teamsByPool.set(pool, []);
      teamsByPool.get(pool)!.push(team);
    }
  });

  // Generate games within each pool
  for (let p = 0; p < config.poolsCount; p++) {
    const slots = poolSlots[p];
    const poolTeams = teamsByPool.get(p + 1) || [];

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        for (let game = 0; game < config.gamesPerTeamInPool; game++) {
          const isHomeFirst = game % 2 === 0;
          const homeIdx = isHomeFirst ? i : j;
          const awayIdx = isHomeFirst ? j : i;

          schedule.push({
            matchNumber: matchNum++,
            homeSlot: poolTeams[homeIdx]?.id || slots[homeIdx],
            homeTeamName: poolTeams[homeIdx]?.name,
            awaySlot: poolTeams[awayIdx]?.id || slots[awayIdx],
            awayTeamName: poolTeams[awayIdx]?.name,
            scheduledDate: '',
            weekNumber: 0,
            matchType: 'pool',
          });
        }
      }
    }
  }

  return matchNum;
}

/**
 * Generate playoff schedule based on format
 */
export function generatePlayoffSchedule(
  schedule: ScheduledMatch[],
  startMatchNumber: number,
  config: ScheduleConfig
): number {
  let matchNum = startMatchNumber;

  // Generate playoff matches based on format
  if (config.playoffFormat === 'championship') {
    // Top 2 teams - single championship game
    schedule.push({
      matchNumber: matchNum++,
      homeSlot: 'PLAYOFF-SEED1',
      awaySlot: 'PLAYOFF-SEED2',
      scheduledDate: '',
      weekNumber: 0,
      matchType: 'playoff',
      playoffRound: 'Championship',
    });
  } else if (config.playoffFormat === 'top_4') {
    // Top 4 teams - semifinals + championship
    schedule.push({
      matchNumber: matchNum++,
      homeSlot: 'PLAYOFF-SEED1',
      awaySlot: 'PLAYOFF-SEED4',
      scheduledDate: '',
      weekNumber: 0,
      matchType: 'playoff',
      playoffRound: 'Semifinals',
    });
    schedule.push({
      matchNumber: matchNum++,
      homeSlot: 'PLAYOFF-SEED2',
      awaySlot: 'PLAYOFF-SEED3',
      scheduledDate: '',
      weekNumber: 0,
      matchType: 'playoff',
      playoffRound: 'Semifinals',
    });
    schedule.push({
      matchNumber: matchNum++,
      homeSlot: 'PLAYOFF-SF1-WINNER',
      awaySlot: 'PLAYOFF-SF2-WINNER',
      scheduledDate: '',
      weekNumber: 0,
      matchType: 'playoff',
      playoffRound: 'Championship',
    });
  } else if (config.playoffFormat === 'play_in') {
    // Play-in game (seed 3 vs 4) + semifinals + championship
    schedule.push({
      matchNumber: matchNum++,
      homeSlot: 'PLAYOFF-SEED3',
      awaySlot: 'PLAYOFF-SEED4',
      scheduledDate: '',
      weekNumber: 0,
      matchType: 'playoff',
      playoffRound: 'Play-In',
    });
    schedule.push({
      matchNumber: matchNum++,
      homeSlot: 'PLAYOFF-SEED1',
      awaySlot: 'PLAYOFF-PLAYIN-WINNER',
      scheduledDate: '',
      weekNumber: 0,
      matchType: 'playoff',
      playoffRound: 'Semifinals',
    });
    schedule.push({
      matchNumber: matchNum++,
      homeSlot: 'PLAYOFF-SEED2',
      awaySlot: 'PLAYOFF-PLAYIN-LOSER',
      scheduledDate: '',
      weekNumber: 0,
      matchType: 'playoff',
      playoffRound: 'Semifinals',
    });
    schedule.push({
      matchNumber: matchNum++,
      homeSlot: 'PLAYOFF-SF1-WINNER',
      awaySlot: 'PLAYOFF-SF2-WINNER',
      scheduledDate: '',
      weekNumber: 0,
      matchType: 'playoff',
      playoffRound: 'Championship',
    });
  } else if (config.playoffFormat === 'top_8') {
    // Top 8 - quarterfinals + semifinals + championship
    for (let i = 0; i < 4; i++) {
      schedule.push({
        matchNumber: matchNum++,
        homeSlot: `PLAYOFF-SEED${i * 2 + 1}`,
        awaySlot: `PLAYOFF-SEED${8 - i * 2}`,
        scheduledDate: '',
        weekNumber: 0,
        matchType: 'playoff',
        playoffRound: 'Quarterfinals',
      });
    }
    for (let i = 0; i < 2; i++) {
      schedule.push({
        matchNumber: matchNum++,
        homeSlot: `PLAYOFF-QF${i * 2 + 1}-WINNER`,
        awaySlot: `PLAYOFF-QF${i * 2 + 2}-WINNER`,
        scheduledDate: '',
        weekNumber: 0,
        matchType: 'playoff',
        playoffRound: 'Semifinals',
      });
    }
    schedule.push({
      matchNumber: matchNum++,
      homeSlot: 'PLAYOFF-SF1-WINNER',
      awaySlot: 'PLAYOFF-SF2-WINNER',
      scheduledDate: '',
      weekNumber: 0,
      matchType: 'playoff',
      playoffRound: 'Championship',
    });
  } else if (config.playoffFormat === 'division_winners') {
    // Division winners playoff
    const numDivisions = config.divisionsCount;
    if (numDivisions === 2) {
      // Just championship between division winners
      schedule.push({
        matchNumber: matchNum++,
        homeSlot: 'PLAYOFF-DIV1-WINNER',
        awaySlot: 'PLAYOFF-DIV2-WINNER',
        scheduledDate: '',
        weekNumber: 0,
        matchType: 'playoff',
        playoffRound: 'Championship',
      });
    } else if (numDivisions === 4) {
      // Semifinals + championship
      schedule.push({
        matchNumber: matchNum++,
        homeSlot: 'PLAYOFF-DIV1-WINNER',
        awaySlot: 'PLAYOFF-DIV4-WINNER',
        scheduledDate: '',
        weekNumber: 0,
        matchType: 'playoff',
        playoffRound: 'Semifinals',
      });
      schedule.push({
        matchNumber: matchNum++,
        homeSlot: 'PLAYOFF-DIV2-WINNER',
        awaySlot: 'PLAYOFF-DIV3-WINNER',
        scheduledDate: '',
        weekNumber: 0,
        matchType: 'playoff',
        playoffRound: 'Semifinals',
      });
      schedule.push({
        matchNumber: matchNum++,
        homeSlot: 'PLAYOFF-SF1-WINNER',
        awaySlot: 'PLAYOFF-SF2-WINNER',
        scheduledDate: '',
        weekNumber: 0,
        matchType: 'playoff',
        playoffRound: 'Championship',
      });
    }
  }

  return matchNum;
}

/**
 * Assign dates to all matches based on configuration
 */
export function assignDatesToMatches(
  matches: ScheduledMatch[],
  issues: ValidationIssue[],
  config: ScheduleConfig
): void {
  if (matches.length === 0) return;

  // Separate regular season and playoff matches
  const regularSeasonMatches = matches.filter(m => m.matchType !== 'playoff');
  const playoffMatches = matches.filter(m => m.matchType === 'playoff');

  // Use matchesPerDay from config
  const maxConcurrentMatches = config.matchesPerDay * config.gamesPerMeetup;

  // Determine period between game days
  let daysBetween = 7; // Default weekly
  if (config.schedulingPeriod === 'bi-weekly') daysBetween = 14;
  else if (config.schedulingPeriod === 'semi-weekly') daysBetween = 3;
  else if (config.schedulingPeriod === 'monthly') daysBetween = 30;
  else if (config.schedulingPeriod === 'custom') daysBetween = config.customDaysBetween;

  let currentWeek = 0;
  let currentDate = new Date(config.seasonStartDate);
  const endDate = new Date(config.seasonEndDate);
  let gameDayIndex = 0;
  let weeksNeededBeyondEnd = 0;

  // Move to first game day
  while (!config.gameDays.includes(currentDate.getDay())) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Schedule regular season matches
  for (let i = 0; i < regularSeasonMatches.length; i += maxConcurrentMatches) {
    // Skip blackout dates
    while (config.blackoutDates.includes(currentDate.toISOString().split('T')[0])) {
      // Move to next scheduled day
      currentDate.setDate(currentDate.getDate() + 1);
      while (!config.gameDays.includes(currentDate.getDay())) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Check if we're past the end date
    if (currentDate > endDate) {
      weeksNeededBeyondEnd++;
    }

    // Assign this period's matches
    const periodMatches = regularSeasonMatches.slice(i, i + maxConcurrentMatches);
    periodMatches.forEach(match => {
      match.scheduledDate = currentDate.toISOString().split('T')[0];
      match.weekNumber = currentWeek + 1;
    });

    // Move to next game period
    if (config.gameDays.length > 1 && gameDayIndex < config.gameDays.length - 1) {
      // Multiple days per period - move to next day in the same period
      gameDayIndex++;
      currentDate.setDate(currentDate.getDate() + 1);
      while (!config.gameDays.includes(currentDate.getDay()) || currentDate.getDay() !== config.gameDays[gameDayIndex]) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // End of period - advance to next period
      gameDayIndex = 0;
      currentWeek++;
      currentDate.setDate(currentDate.getDate() + daysBetween);
      while (!config.gameDays.includes(currentDate.getDay())) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  }

  // Schedule playoff matches after regular season
  if (playoffMatches.length > 0) {
    // Group playoffs by round
    const roundGroups = new Map<string, ScheduledMatch[]>();
    playoffMatches.forEach(match => {
      const round = match.playoffRound || 'Unknown';
      if (!roundGroups.has(round)) roundGroups.set(round, []);
      roundGroups.get(round)!.push(match);
    });

    // Order rounds appropriately
    const roundOrder = ['Play-In', 'Quarterfinals', 'Semifinals', 'Championship'];
    roundOrder.forEach(roundName => {
      const roundMatches = roundGroups.get(roundName);
      if (!roundMatches) return;

      // Skip blackout dates
      while (config.blackoutDates.includes(currentDate.toISOString().split('T')[0])) {
        currentDate.setDate(currentDate.getDate() + 1);
        while (!config.gameDays.includes(currentDate.getDay())) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Check if past end date
      if (currentDate > endDate) {
        weeksNeededBeyondEnd++;
      }

      // Assign all matches in this round to the same date
      roundMatches.forEach(match => {
        match.scheduledDate = currentDate.toISOString().split('T')[0];
        match.weekNumber = currentWeek + 1;
      });

      // Move to next period for next round
      gameDayIndex = 0;
      currentWeek++;
      currentDate.setDate(currentDate.getDate() + daysBetween);
      while (!config.gameDays.includes(currentDate.getDay())) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
  }

  // Single consolidated timeline error
  if (weeksNeededBeyondEnd > 0) {
    const periodType = config.schedulingPeriod === 'bi-weekly' ? 'bi-weekly periods'
      : config.schedulingPeriod === 'semi-weekly' ? 'semi-weekly periods'
      : config.schedulingPeriod === 'monthly' ? 'months'
      : config.schedulingPeriod === 'custom' ? `${config.customDaysBetween}-day periods`
      : 'weeks';

    issues.push({
      type: 'error',
      message: `Schedule extends ${weeksNeededBeyondEnd} ${periodType} beyond season end date. Extend the season end date or reduce number of matches.`
    });
  }
}

