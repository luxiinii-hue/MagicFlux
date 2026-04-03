/**
 * Keyword registry — maps keyword names to SpellAbility generators.
 *
 * Keywords from Scryfall's `keywords` array are looked up here during
 * card instantiation to produce the appropriate SpellAbility objects.
 *
 * Keyword types:
 * - static: Continuous effect while on the battlefield (Flying, Hexproof, etc.)
 * - evasion: Combat restriction on blocking (Flying, Menace, Intimidate)
 * - combat: Modifies combat damage calculation (First Strike, Trample, Deathtouch)
 * - triggered: Fires on game events (Lifelink, Prowess)
 * - activated: Player-activated ability (Equip, Ward)
 * - flag: Modifies timing or behavior rules (Flash, Haste, Defender)
 */

import type { SpellAbility } from "@magic-flux/types";

export type KeywordType =
  | "static"
  | "evasion"
  | "combat"
  | "triggered"
  | "activated"
  | "flag";

export interface KeywordDefinition {
  readonly name: string;
  readonly type: KeywordType;
  /**
   * Generate SpellAbility objects for this keyword on a card.
   * Some keywords are pure engine flags (Flying, Haste) and produce
   * static abilities. Others (Equip, Prowess) produce activated/triggered abilities.
   */
  readonly generateAbilities: () => SpellAbility[];
}

const keywords = new Map<string, KeywordDefinition>();

export function registerKeyword(def: KeywordDefinition): void {
  keywords.set(def.name.toLowerCase(), def);
}

export function getKeywordDefinition(name: string): KeywordDefinition | undefined {
  return keywords.get(name.toLowerCase());
}

export function hasKeyword(name: string): boolean {
  return keywords.has(name.toLowerCase());
}

export function getImplementedKeywords(): string[] {
  return [...keywords.keys()];
}

/**
 * Generate all SpellAbility objects for a card's keywords.
 * Called during instantiateCard for Tier 1 ability resolution.
 */
export function generateKeywordAbilities(keywordNames: readonly string[]): SpellAbility[] {
  const abilities: SpellAbility[] = [];
  for (const name of keywordNames) {
    const def = keywords.get(name.toLowerCase());
    if (def) {
      abilities.push(...def.generateAbilities());
    }
  }
  return abilities;
}
