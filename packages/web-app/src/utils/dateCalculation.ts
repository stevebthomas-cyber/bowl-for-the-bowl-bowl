/**
 * Date Calculation Utilities
 *
 * Functions for calculating game dates based on date schedule rules
 */

interface DateSchedule {
  id: string;
  name: string;
  use_specific_dates: boolean;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_days: string[] | null;
  recurrence_interval: number | null;
  recurrence_period: string | null;
  availability_start_datetime: string | null;
  availability_end_datetime: string | null;
  specific_dates: string[] | null;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculate the next occurrence of a date based on recurrence rules
 */
export function calculateNextOccurrence(
  schedule: DateSchedule,
  fromDate?: Date
): Date | null {
  if (!schedule.availability_start_datetime) {
    return null;
  }

  const startDate = new Date(schedule.availability_start_datetime);
  const baseDate = fromDate || startDate;

  // If not recurring, just return the start date
  if (!schedule.is_recurring) {
    return fromDate ? null : startDate;
  }

  let nextDate = new Date(baseDate);

  // Preserve the time from the schedule's start datetime
  // When calculating from a previous round, we only want to change the date, not the time
  const scheduleTime = new Date(schedule.availability_start_datetime);
  nextDate.setHours(scheduleTime.getHours());
  nextDate.setMinutes(scheduleTime.getMinutes());
  nextDate.setSeconds(scheduleTime.getSeconds());
  nextDate.setMilliseconds(scheduleTime.getMilliseconds());

  switch (schedule.recurrence_type) {
    case 'daily':
      // Every day
      if (fromDate) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      return nextDate;

    case 'on_certain_days': {
      // Specific days of the week (e.g., Tuesday, Thursday)
      if (!schedule.recurrence_days || schedule.recurrence_days.length === 0) {
        return null;
      }

      // Find next occurrence of any of the specified days
      let daysChecked = 0;
      const maxDays = 14; // Check up to 2 weeks ahead

      while (daysChecked < maxDays) {
        if (fromDate || daysChecked > 0) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
        daysChecked++;

        const dayName = DAYS_OF_WEEK[nextDate.getDay()];
        if (schedule.recurrence_days.includes(dayName)) {
          return nextDate;
        }
      }
      return null;
    }

    case 'weekly':
      // Same day of week, every week
      if (fromDate) {
        nextDate.setDate(nextDate.getDate() + 7);
      }
      return nextDate;

    case 'biweekly':
      // Same day of week, every 2 weeks
      if (fromDate) {
        nextDate.setDate(nextDate.getDate() + 14);
      }
      return nextDate;

    case 'semimonthly':
      // Twice a month (1st and 15th, approximately)
      if (fromDate) {
        const currentDay = nextDate.getDate();
        if (currentDay < 15) {
          nextDate.setDate(15);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(1);
        }
      }
      return nextDate;

    case 'monthly':
      // Same day of month, every month
      if (fromDate) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      return nextDate;

    case 'custom': {
      // Every X days/weeks/months
      if (!schedule.recurrence_interval || !schedule.recurrence_period) {
        return null;
      }

      if (!fromDate) {
        return startDate;
      }

      switch (schedule.recurrence_period) {
        case 'days':
          nextDate.setDate(nextDate.getDate() + schedule.recurrence_interval);
          break;
        case 'weeks':
          nextDate.setDate(nextDate.getDate() + (schedule.recurrence_interval * 7));
          break;
        case 'months':
          nextDate.setMonth(nextDate.getMonth() + schedule.recurrence_interval);
          break;
      }
      return nextDate;
    }

    default:
      return null;
  }
}

/**
 * Calculate dates for a specific round based on schedule rules
 */
export function calculateRoundDate(
  schedule: DateSchedule,
  roundNumber: number,
  previousRoundDate?: Date
): Date | null {
  console.log('[calculateRoundDate] Input:', {
    scheduleName: schedule.name,
    roundNumber,
    useSpecificDates: schedule.use_specific_dates,
    isRecurring: schedule.is_recurring,
    recurrenceType: schedule.recurrence_type,
    startDateTime: schedule.availability_start_datetime,
    previousRoundDate: previousRoundDate?.toISOString(),
  });

  if (schedule.use_specific_dates) {
    // Use specific dates array
    if (!schedule.specific_dates || schedule.specific_dates.length === 0) {
      console.error('[calculateRoundDate] No specific dates provided');
      return null;
    }

    // Use the round number as index (round 1 = index 0)
    const dateIndex = roundNumber - 1;
    if (dateIndex < schedule.specific_dates.length) {
      const result = new Date(schedule.specific_dates[dateIndex]);
      console.log('[calculateRoundDate] Using specific date:', result.toISOString());
      return result;
    }

    console.error('[calculateRoundDate] Round number exceeds specific dates array length');
    return null;
  }

  // For recurring schedules
  if (roundNumber === 1) {
    // First round uses the start date
    const result = calculateNextOccurrence(schedule);
    console.log('[calculateRoundDate] Round 1 date:', result?.toISOString());
    return result;
  }

  // Subsequent rounds calculate from previous round's date
  if (previousRoundDate) {
    const result = calculateNextOccurrence(schedule, previousRoundDate);
    console.log('[calculateRoundDate] Subsequent round date:', result?.toISOString());
    return result;
  }

  console.error('[calculateRoundDate] No previous round date provided for round', roundNumber);
  return null;
}

/**
 * Calculate start time for subsequent games on the same pitch
 */
export function calculateGameStartTime(
  baseDate: Date,
  gameIndex: number,
  minGameDurationMinutes: number
): Date {
  const startTime = new Date(baseDate);
  startTime.setMinutes(startTime.getMinutes() + (gameIndex * minGameDurationMinutes));
  return startTime;
}

/**
 * Check if a game time fits within venue availability window
 */
export function isWithinAvailability(
  gameStartTime: Date,
  gameDurationMinutes: number,
  availabilityStart: Date,
  availabilityEnd: Date
): boolean {
  const gameEndTime = new Date(gameStartTime);
  gameEndTime.setMinutes(gameEndTime.getMinutes() + gameDurationMinutes);

  return gameStartTime >= availabilityStart && gameEndTime <= availabilityEnd;
}
