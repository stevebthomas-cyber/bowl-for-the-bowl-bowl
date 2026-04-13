// Shared utility functions

export function calculateSOB(teamTier: number, points: number): number {
  // SOB = log(team_tier) + 2 × (points / 10)
  return Math.round(Math.log(teamTier) + 2 * (points / 10));
}

export function calculatePlayerValue(
  baseValue: number,
  spp: number,
  skillsCost: number
): number {
  // Simplified - actual calculation depends on position and skills
  return baseValue + skillsCost * 20000;
}
