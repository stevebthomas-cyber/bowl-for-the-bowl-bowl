/**
 * Date Utility Functions
 *
 * Handles timezone-aware date conversions for datetime-local inputs
 *
 * STRATEGY: Store in UTC (ISO format), display in user's local timezone
 * - When user inputs a time, treat it as their local timezone and convert to UTC for storage
 * - When displaying, convert UTC back to local timezone
 */

/**
 * Convert a datetime-local input value to UTC ISO string
 * User enters "2025-01-15 19:00" in their local timezone
 * We store it as UTC ISO string (e.g., "2025-01-16T03:00:00.000Z" if user is UTC+8)
 *
 * @param datetimeLocalValue - Value from datetime-local input (YYYY-MM-DDTHH:mm)
 * @returns UTC ISO string for storage in database
 */
export function datetimeLocalToISO(datetimeLocalValue: string): string {
  if (!datetimeLocalValue) return '';

  // datetime-local gives us a string like "2025-01-15T19:00"
  // Create a Date object treating this as local time
  const localDate = new Date(datetimeLocalValue);

  // Convert to UTC ISO string for storage
  return localDate.toISOString();
}

/**
 * Convert a UTC ISO string to datetime-local input format in user's local timezone
 * Database has "2025-01-16T03:00:00.000Z" (UTC)
 * User in UTC+8 sees "2025-01-16T11:00" in their input field
 *
 * @param isoString - UTC ISO datetime string from database
 * @returns datetime-local format (YYYY-MM-DDTHH:mm) in user's local timezone
 */
export function isoToDatetimeLocal(isoString: string): string {
  if (!isoString) return '';

  const date = new Date(isoString);

  // Get local date/time components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  // Return in datetime-local format
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format a date/time for display
 *
 * @param isoString - ISO datetime string
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDateTime(
  isoString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!isoString) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  const date = new Date(isoString);
  return date.toLocaleString('en-US', options || defaultOptions);
}

/**
 * Format just the time portion for display
 *
 * @param isoString - ISO datetime string
 * @returns Formatted time string (e.g., "7:00 PM")
 */
export function formatTime(isoString: string): string {
  if (!isoString) return '';

  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
