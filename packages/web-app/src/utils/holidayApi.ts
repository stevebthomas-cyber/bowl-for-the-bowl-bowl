/**
 * Holiday API Integration using Nager.Date
 *
 * Free API for public holidays across 100+ countries
 * API Docs: https://date.nager.at/
 * No API key required, no rate limits
 */

export interface Holiday {
  date: string; // YYYY-MM-DD format
  localName: string;
  name: string; // English name
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

export interface Country {
  countryCode: string;
  name: string;
}

const API_BASE = 'https://date.nager.at/api/v3';

/**
 * Get list of all available countries
 */
export async function getAvailableCountries(): Promise<Country[]> {
  try {
    const response = await fetch(`${API_BASE}/AvailableCountries`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching available countries:', error);
    throw error;
  }
}

/**
 * Get public holidays for a specific country and year
 */
export async function getPublicHolidays(
  countryCode: string,
  year: number
): Promise<Holiday[]> {
  try {
    const response = await fetch(`${API_BASE}/PublicHolidays/${year}/${countryCode}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching public holidays:', error);
    throw error;
  }
}

/**
 * Check if a specific date is a holiday
 */
export async function isPublicHoliday(
  countryCode: string,
  date: Date
): Promise<boolean> {
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const response = await fetch(
      `${API_BASE}/IsTodayPublicHoliday/${countryCode}?date=${year}-${month}-${day}`
    );

    return response.status === 200;
  } catch (error) {
    console.error('Error checking if date is public holiday:', error);
    return false;
  }
}

/**
 * Get the next public holidays for a country
 */
export async function getNextPublicHolidays(
  countryCode: string
): Promise<Holiday[]> {
  try {
    const response = await fetch(`${API_BASE}/NextPublicHolidays/${countryCode}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching next public holidays:', error);
    throw error;
  }
}

/**
 * Get holidays with optional weekend extension
 *
 * Holiday: Just the single day
 * Holiday Weekend: The holiday + NEAREST weekend to create a long weekend
 *
 * Logic for holiday weekends (blocks through the NEAREST weekend):
 * - Monday: Fri-Mon (previous weekend)
 * - Tuesday: Fri-Tue (previous weekend)
 * - Wednesday: Wed-Sun (following weekend - equidistant, choose following)
 * - Thursday: Thu-Sun (following weekend)
 * - Friday: Fri-Sun (current weekend)
 * - Saturday: Sat-Mon (current weekend + Monday)
 * - Sunday: Sun-Mon (current weekend + Monday)
 */
export function getHolidayDates(
  holiday: Holiday,
  includeWeekend: boolean = false
): string[] {
  const dates: string[] = [holiday.date];

  if (includeWeekend) {
    // Use timezone-safe parsing
    const [year, month, day] = holiday.date.split('-').map(Number);
    const holidayDate = new Date(year, month - 1, day);
    const dayOfWeek = holidayDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    if (dayOfWeek === 1) {
      // Monday: Block Fri-Mon (previous weekend)
      // Add Friday (3 days back), Saturday (2 days back), Sunday (1 day back)
      for (let i = 3; i >= 1; i--) {
        const d = new Date(year, month - 1, day - i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (dayOfWeek === 2) {
      // Tuesday: Block Fri-Tue (previous weekend)
      // Add Friday (4 days back), Saturday (3 days back), Sunday (2 days back), Monday (1 day back)
      for (let i = 4; i >= 1; i--) {
        const d = new Date(year, month - 1, day - i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (dayOfWeek === 3) {
      // Wednesday: Block Wed-Sun (following weekend)
      // Add Thu, Fri, Sat, Sun (1-4 days forward)
      for (let i = 1; i <= 4; i++) {
        const d = new Date(year, month - 1, day + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (dayOfWeek === 4) {
      // Thursday: Block Thu-Sun (following weekend)
      // Add Fri, Sat, Sun (1-3 days forward)
      for (let i = 1; i <= 3; i++) {
        const d = new Date(year, month - 1, day + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (dayOfWeek === 5) {
      // Friday: Block Fri-Sun
      // Add Sat, Sun (1-2 days forward)
      for (let i = 1; i <= 2; i++) {
        const d = new Date(year, month - 1, day + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (dayOfWeek === 6) {
      // Saturday: Block Sat-Mon
      // Add Sun, Mon (1-2 days forward)
      for (let i = 1; i <= 2; i++) {
        const d = new Date(year, month - 1, day + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (dayOfWeek === 0) {
      // Sunday: Block Sun-Mon
      // Add Mon (1 day forward)
      const d = new Date(year, month - 1, day + 1);
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  return dates.sort();
}

/**
 * Common country codes for quick access
 */
export const COMMON_COUNTRIES = {
  US: 'US', // United States
  GB: 'GB', // United Kingdom
  CA: 'CA', // Canada
  AU: 'AU', // Australia
  DE: 'DE', // Germany
  FR: 'FR', // France
  IT: 'IT', // Italy
  ES: 'ES', // Spain
  NL: 'NL', // Netherlands
  BE: 'BE', // Belgium
  CH: 'CH', // Switzerland
  AT: 'AT', // Austria
  IE: 'IE', // Ireland
  NZ: 'NZ', // New Zealand
  SE: 'SE', // Sweden
  NO: 'NO', // Norway
  DK: 'DK', // Denmark
  FI: 'FI', // Finland
};
