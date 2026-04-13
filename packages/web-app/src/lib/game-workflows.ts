/**
 * Game Workflows - Central export for all pre-game and post-game functions
 * Import from this file to access all game workflow capabilities
 */

// Team Calculations
export {
  calculateRosterValue,
  calculateStaffValue,
  calculateTotalTeamValue,
  calculateCurrentTeamValue,
  calculatePettyCash,
  getTeamSpecialRules,
  hasBriberyAndCorruption,
  hasBrawlinBrutes,
  getSPPForTouchdown,
  getSPPForCasualty
} from './team-calculations';

// Journeyman Utilities
export {
  getEligibleLinemanPositions,
  selectLinemanForJourneyman,
  canFieldElevenPlayers,
  calculateJourneymenNeeded
} from './journeyman-utils';

// Inducement Utilities
export {
  getAvailableInducements,
  getTeamSpecialRulesLeague,
  getAvailableStarPlayers,
  getInducementCost
} from './inducement-utils';

// Pre-Game Workflow
export {
  autoHireJourneymen,
  capturePreGameSnapshot,
  checkPreGameEligibility,
  getPreGameInfo
} from './pregame-workflow';

// Post-Game Workflow
export {
  recordGameResult,
  updateDedicatedFans,
  recordTouchdown,
  recordCasualty,
  recordCompletion,
  recordInterception,
  recordSuperbThrow,
  recordSuccessfulLanding,
  recordMVP,
  calculateWinnings,
  checkExpensiveMistakes,
  revertFriendlyGame,
  getPlayerAdvancementInfo,
  rollRandomSkill,
  rollCharacteristicImprovement,
  applySkillAdvancement,
  applyCharacteristicImprovement,
  completePostGameWorkflow
} from './postgame-workflow';

// Injury Workflow
export {
  rollD16,
  rollD6,
  determineInjury,
  rollAndApplyCasualty,
  applyManualCasualty,
  applyInjury,
  addHatredTrait,
  processGameCasualties,
  getPlayerInjurySummary
} from './injury-workflow';

export type { InjuryResult, CasualtyRollResult } from './injury-workflow';
