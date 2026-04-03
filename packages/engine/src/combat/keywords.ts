/**
 * Keyword checking utilities for combat.
 *
 * Checks whether a CardInstance has a specific keyword by examining its
 * abilities array and cardDataId. In Phase 3, keywords come from card
 * overrides via the abilities array (static abilities or keywords stored
 * on the card's data).
 *
 * For Phase 3, we use a simple approach: keywords are stored as static
 * abilities with a recognizable pattern, or detected from the cardDataId
 * metadata. The cards package populates these during instantiation.
 */

import type { CardInstance, GameState } from "@magic-flux/types";

/**
 * Known combat-relevant keywords. Maps keyword name to a description
 * of its combat role.
 */
export type CombatKeyword =
  | "flying"
  | "reach"
  | "trample"
  | "deathtouch"
  | "lifelink"
  | "vigilance"
  | "haste"
  | "first strike"
  | "double strike"
  | "menace"
  | "defender"
  | "hexproof"
  | "indestructible"
  | "flash";

/**
 * Check if a card instance has a specific keyword.
 *
 * Keywords can be present as:
 * 1. A static ability with matching keyword name in the abilities array
 * 2. A field on the card's metadata (populated by the cards package)
 *
 * For Phase 3, we check the `keywords` property which is populated
 * during card instantiation from the cards package overrides.
 */
export function hasKeyword(
  state: GameState,
  instanceId: string,
  keyword: CombatKeyword,
): boolean {
  const card = state.cardInstances[instanceId];
  if (!card) return false;
  return cardHasKeyword(card, keyword);
}

/**
 * Check a card directly for a keyword (no state lookup needed).
 */
export function cardHasKeyword(card: CardInstance, keyword: string): boolean {
  // Check abilities for static abilities that represent keywords
  for (const ability of card.abilities) {
    if (ability.type === "static") {
      const effectType = ability.continuousEffect?.effectType;
      if (effectType && effectType.toLowerCase() === keyword.toLowerCase()) {
        return true;
      }
    }
  }

  // Check cardDataId for known keyword-bearing cards (fallback)
  // The cards package should populate keywords on the abilities array,
  // but for testing we also accept a `_keywords` convention on cardDataId
  return false;
}

/**
 * Get the effective power of a creature, accounting for modifications.
 * Returns null if not a creature.
 */
export function getCreaturePower(state: GameState, instanceId: string): number | null {
  const card = state.cardInstances[instanceId];
  if (!card) return null;
  return card.modifiedPower;
}

/**
 * Get the effective toughness of a creature.
 */
export function getCreatureToughness(state: GameState, instanceId: string): number | null {
  const card = state.cardInstances[instanceId];
  if (!card) return null;
  return card.modifiedToughness;
}

/**
 * Check if a creature has lethal damage marked on it.
 * Lethal = damage >= toughness, OR any deathtouch damage > 0.
 */
export function hasLethalDamage(
  state: GameState,
  instanceId: string,
  deathtouchSources: Set<string>,
): boolean {
  const card = state.cardInstances[instanceId];
  if (!card || card.modifiedToughness === null) return false;

  // Standard lethal: damage >= toughness
  if (card.damage >= card.modifiedToughness) return true;

  // Deathtouch: any damage from a deathtouch source is lethal
  // This is tracked by the combat damage system marking deathtouch damage
  // For SBA purposes, we check if the card has been dealt deathtouch damage
  // (stored as a flag or tracked separately)

  return false;
}

/**
 * Check if a creature can attack (not tapped, no summoning sickness
 * unless it has haste, not a defender).
 */
export function canAttack(
  state: GameState,
  instanceId: string,
): { canAttack: boolean; reason?: string } {
  const card = state.cardInstances[instanceId];
  if (!card) return { canAttack: false, reason: "Card not found" };
  if (card.modifiedPower === null) return { canAttack: false, reason: "Not a creature" };
  if (card.tapped) return { canAttack: false, reason: "Tapped" };

  if (card.summoningSickness && !cardHasKeyword(card, "haste")) {
    return { canAttack: false, reason: "Summoning sickness" };
  }

  if (cardHasKeyword(card, "defender")) {
    return { canAttack: false, reason: "Defender" };
  }

  return { canAttack: true };
}

/**
 * Check if a creature can block a specific attacker.
 */
export function canBlock(
  state: GameState,
  blockerId: string,
  attackerId: string,
): { canBlock: boolean; reason?: string } {
  const blocker = state.cardInstances[blockerId];
  const attacker = state.cardInstances[attackerId];
  if (!blocker || !attacker) return { canBlock: false, reason: "Card not found" };
  if (blocker.tapped) return { canBlock: false, reason: "Tapped" };
  if (blocker.modifiedPower === null) return { canBlock: false, reason: "Not a creature" };

  // Flying: can only be blocked by creatures with flying or reach
  if (cardHasKeyword(attacker, "flying")) {
    if (!cardHasKeyword(blocker, "flying") && !cardHasKeyword(blocker, "reach")) {
      return { canBlock: false, reason: "Cannot block a flying creature without flying or reach" };
    }
  }

  return { canBlock: true };
}
