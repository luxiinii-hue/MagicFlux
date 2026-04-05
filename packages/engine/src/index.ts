/**
 * @magic-flux/engine — Pure game logic for Magic: The Gathering.
 *
 * All exported functions are pure: same inputs produce same outputs.
 * No side effects, no I/O, no global state.
 */

// Game lifecycle
export { createGame, getGameStatus } from "./game.js";

// Player actions
export { executeAction, getLegalActions } from "./actions.js";

// Turn structure
export { advancePhase, advanceToNextPriorityPoint } from "./turn/phases.js";

// Priority
export {
  grantPriority,
  passPriority,
  allPlayersPassed,
  getNextPriorityPlayer,
} from "./turn/priority.js";

// Mana
export {
  addMana,
  addManaPool,
  totalMana,
  canPayCost,
  addManaToPlayer,
  emptyPlayerManaPool,
  EMPTY_MANA_POOL,
} from "./mana/pool.js";

// Stack
export { pushToStack, resolveTopOfStack } from "./stack/stack.js";
export { resolveStackItem } from "./stack/resolution.js";
export {
  validateTargetsOnCast,
  validateTargetsOnResolution,
} from "./stack/targeting.js";

// Copy effects
export { copyPermanent, copySpell } from "./stack/copy.js";

// Mana payment
export { payManaCost } from "./mana/payment.js";

// Triggers
export { checkTriggeredAbilities } from "./triggers/triggers.js";

// State-based actions
export {
  processStateBasedActions,
  processStateBasedActionsLoop,
} from "./state-based/sba.js";

// Zones
export {
  createZones,
  moveCard,
  drawCard,
  findCardZoneKey,
  getZoneCards,
  libraryKey,
  handKey,
  graveyardKey,
} from "./zones/transfers.js";

// Combat
export { declareAttackers } from "./combat/attackers.js";
export { declareBlockers } from "./combat/blockers.js";
export {
  calculateCombatDamage,
  applyCombatDamage,
  hasFirstStrikeCreatures,
} from "./combat/damage.js";
export {
  hasKeyword,
  cardHasKeyword,
  canAttack,
  canBlock,
  getCreaturePower,
  getCreatureToughness,
} from "./combat/keywords.js";

// Replacement effects
export {
  checkZoneChangeReplacement,
  checkDamageReplacement,
  checkAmountReplacement,
  addReplacementEffect,
  removeReplacementEffectsFromSource,
} from "./replacement/replacement.js";

// Layer system
export { applyLayerSystem } from "./layers/layer-system.js";

// Equipment
export { attachEquipment, detachEquipment } from "./combat/equipment.js";

// Planeswalker
export {
  canActivateLoyaltyAbility,
  activateLoyaltyAbility,
  dealDamageToPlayeswalker,
} from "./planeswalker.js";

// Alternative costs
export { canCastWithFlashback, exileFlashbackSpell } from "./alternative-costs.js";

// Mulligan
export { performMulligan, putCardsOnBottom } from "./mulligan.js";

// RNG
export { nextRandom, nextInt, shuffle } from "./rng.js";
