/**
 * ValidationPanel Component
 *
 * Displays validation errors and warnings for the schedule.
 */

import type { ValidationIssue } from '../../types/schedule';

interface ValidationPanelProps {
  issues: ValidationIssue[];
}

export default function ValidationPanel({ issues }: ValidationPanelProps) {
  if (issues.length === 0) {
    return null;
  }

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  return (
    <div className="p-4 border-b border-gray-200 space-y-2">
      {/* Errors first */}
      {errors.map((issue, idx) => (
        <div
          key={`error-${idx}`}
          className="p-3 rounded bg-red-50 border border-red-200 text-red-900"
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠</span>
            <div className="flex-1">
              <div className="font-semibold">Error</div>
              <div className="text-sm">{issue.message}</div>
              {issue.matchNumbers && issue.matchNumbers.length > 0 && (
                <div className="text-xs mt-1 text-red-700">
                  Matches: {issue.matchNumbers.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Warnings second */}
      {warnings.map((issue, idx) => (
        <div
          key={`warning-${idx}`}
          className="p-3 rounded bg-yellow-50 border border-yellow-200 text-yellow-900"
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠</span>
            <div className="flex-1">
              <div className="font-semibold">Warning</div>
              <div className="text-sm">{issue.message}</div>
              {issue.matchNumbers && issue.matchNumbers.length > 0 && (
                <div className="text-xs mt-1 text-yellow-700">
                  Matches: {issue.matchNumbers.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
