/**
 * Override registry — maps card names to their manual override functions.
 *
 * Each override returns a SpellAbility[] that completely replaces any
 * auto-parsed abilities for that card. Used for cards whose behavior
 * can't be derived from keywords + oracle text alone, and during
 * Phase 2 for all initial card implementations.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";

import { lightningBoltOverride, lightningBoltTargets } from "./lightning-bolt.js";
import { counterspellOverride, counterspellTargets } from "./counterspell.js";
import { giantGrowthOverride, giantGrowthTargets } from "./giant-growth.js";
import { shockOverride, shockTargets } from "./shock.js";
import { darkRitualOverride } from "./dark-ritual.js";
import { doomBladeOverride, doomBladeTargets } from "./doom-blade.js";
import { healingSalveOverride, healingSalveTargets } from "./healing-salve.js";
import { ancestralRecallOverride, ancestralRecallTargets } from "./ancestral-recall.js";
import { naturalizeOverride, naturalizeTargets } from "./naturalize.js";
import { divinationOverride } from "./divination.js";
import {
  plainsOverride,
  islandOverride,
  swampOverride,
  mountainOverride,
  forestOverride,
} from "./basic-lands.js";
import {
  elvishVisionaryOverride,
  flametongueKavuOverride,
  flametongueKavuTargets,
  acidicSlimeOverride,
  acidicSlimeTargets,
  mulldrifterOverride,
  ravenousChupacabraOverride,
  ravenousChupacabraTargets,
} from "./creatures-vanilla.js";
import {
  grizzlyBearsOverride,
  serraAngelOverride,
  llanowarElvesKeywordOverride,
  goblinGuideKeywordOverride,
  giantSpiderOverride,
  airElementalOverride,
  vampireNighthawkOverride,
  monasterySwiftspearOverride,
  savannahLionsOverride,
  elvishMysticOverride,
} from "./creatures-keyword.js";
import {
  oblivionRingOverride,
  oblivionRingTargets,
  lightningGreavesOverride,
  lightningGreavesTargets,
  pacifismOverride,
  pacifismTargets,
  solRingOverride,
  bonesplitterOverride,
  bonesplitterTargets,
} from "./enchantments-artifacts.js";
import {
  wallOfOmensOverride,
  motherOfRunesOverride,
  motherOfRunesTargets,
  baneslayerAngelOverride,
  snapcasterMageOverride,
  snapcasterMageTargets,
  delverOfSecretsOverride,
  manOWarOverride,
  manOWarTargets,
  netherSpiritOverride,
  darkConfidantOverride,
  dreadShadeOverride,
  lightningMaulerOverride,
  ballLightningOverride,
  emberHaulerOverride,
  emberHaulerTargets,
  tarmogoyfOverride,
  sylvanCaryatidOverride,
  leatherbackBalothOverride,
  kalonianTuskerOverride,
  courserOfKruphixOverride,
  geistOfSaintTraftOverride,
  kitchenFinksOverride,
  bloodbraidElfOverride,
} from "./creatures-phase3.js";
import {
  swordsToPlowsharesOverride, swordsToPlowsharesTargets,
  pathToExileOverride, pathToExileTargets,
  manaLeakOverride, manaLeakTargets,
  negateOverride, negateTargets,
  spellPierceOverride, spellPierceTargets,
  incinerateOverride, incinerateTargets,
  terminateOverride, terminateTargets,
  abruptDecayOverride, abruptDecayTargets,
  thoughtseizeOverride, thoughtseizeTargets,
  duressOverride, duressTargets,
  preordainOverride,
  ponderOverride,
  brainstormOverride,
  optOverride,
  considerOverride,
  murderOverride, murderTargets,
  flameSlashOverride, flameSlashTargets,
  hymnToTourachOverride, hymnToTourachTargets,
  vindicateOverride, vindicateTargets,
  maelstromPulseOverride, maelstromPulseTargets,
  collectedCompanyOverride,
  borosCharmOverride,
  lightningHelixOverride, lightningHelixTargets,
} from "./standard-instants.js";

// ---------------------------------------------------------------------------
// Override entry type
// ---------------------------------------------------------------------------

export interface CardOverrideEntry {
  /** Returns the SpellAbility array for this card. */
  readonly getAbilities: () => SpellAbility[];
  /**
   * Target requirements for the card's spell ability, if any.
   * Used by the server to know what targets to prompt for.
   */
  readonly spellTargets: readonly TargetRequirement[];
}

// ---------------------------------------------------------------------------
// Registry map (case-insensitive lookup)
// ---------------------------------------------------------------------------

const overrides = new Map<string, CardOverrideEntry>();

function register(
  name: string,
  getAbilities: () => SpellAbility[],
  spellTargets: readonly TargetRequirement[] = [],
): void {
  overrides.set(name.toLowerCase(), { getAbilities, spellTargets });
}

// Phase 2 spell overrides
register("Lightning Bolt", lightningBoltOverride, lightningBoltTargets);
register("Counterspell", counterspellOverride, counterspellTargets);
register("Giant Growth", giantGrowthOverride, giantGrowthTargets);
register("Shock", shockOverride, shockTargets);
register("Dark Ritual", darkRitualOverride);
register("Doom Blade", doomBladeOverride, doomBladeTargets);
register("Healing Salve", healingSalveOverride, healingSalveTargets);
register("Ancestral Recall", ancestralRecallOverride, ancestralRecallTargets);
register("Naturalize", naturalizeOverride, naturalizeTargets);
register("Divination", divinationOverride);

// Basic land overrides
register("Plains", plainsOverride);
register("Island", islandOverride);
register("Swamp", swampOverride);
register("Mountain", mountainOverride);
register("Forest", forestOverride);

// Phase 3 creature overrides (creatures with special abilities beyond keywords)
register("Elvish Visionary", elvishVisionaryOverride);
register("Flametongue Kavu", flametongueKavuOverride, flametongueKavuTargets);
register("Acidic Slime", acidicSlimeOverride, acidicSlimeTargets);
register("Mulldrifter", mulldrifterOverride);
register("Ravenous Chupacabra", ravenousChupacabraOverride, ravenousChupacabraTargets);

// Phase 3 enchantment/artifact overrides
register("Oblivion Ring", oblivionRingOverride, oblivionRingTargets);
register("Lightning Greaves", lightningGreavesOverride, lightningGreavesTargets);
register("Pacifism", pacifismOverride, pacifismTargets);
register("Sol Ring", solRingOverride);
register("Bonesplitter", bonesplitterOverride, bonesplitterTargets);

// Phase 3 additional creature overrides (20+ creatures)
// White
register("Wall of Omens", wallOfOmensOverride);
register("Mother of Runes", motherOfRunesOverride, motherOfRunesTargets);
register("Baneslayer Angel", baneslayerAngelOverride);
// Blue
register("Snapcaster Mage", snapcasterMageOverride, snapcasterMageTargets);
register("Delver of Secrets", delverOfSecretsOverride);
register("Man-o'-War", manOWarOverride, manOWarTargets);
// Black
register("Nether Spirit", netherSpiritOverride);
register("Dark Confidant", darkConfidantOverride);
register("Dread Shade", dreadShadeOverride);
// Red
register("Lightning Mauler", lightningMaulerOverride);
register("Ball Lightning", ballLightningOverride);
register("Ember Hauler", emberHaulerOverride, emberHaulerTargets);
// Green
register("Tarmogoyf", tarmogoyfOverride);
register("Sylvan Caryatid", sylvanCaryatidOverride);
register("Leatherback Baloth", leatherbackBalothOverride);
register("Kalonian Tusker", kalonianTuskerOverride);
register("Courser of Kruphix", courserOfKruphixOverride);
// Multicolor
register("Geist of Saint Traft", geistOfSaintTraftOverride);
register("Kitchen Finks", kitchenFinksOverride);
register("Bloodbraid Elf", bloodbraidElfOverride);

// Phase 5 Standard instant/sorcery overrides
register("Swords to Plowshares", swordsToPlowsharesOverride, swordsToPlowsharesTargets);
register("Path to Exile", pathToExileOverride, pathToExileTargets);
register("Mana Leak", manaLeakOverride, manaLeakTargets);
register("Negate", negateOverride, negateTargets);
register("Spell Pierce", spellPierceOverride, spellPierceTargets);
register("Incinerate", incinerateOverride, incinerateTargets);
register("Terminate", terminateOverride, terminateTargets);
register("Abrupt Decay", abruptDecayOverride, abruptDecayTargets);
register("Thoughtseize", thoughtseizeOverride, thoughtseizeTargets);
register("Duress", duressOverride, duressTargets);
register("Preordain", preordainOverride);
register("Ponder", ponderOverride);
register("Brainstorm", brainstormOverride);
register("Opt", optOverride);
register("Consider", considerOverride);
register("Murder", murderOverride, murderTargets);
register("Flame Slash", flameSlashOverride, flameSlashTargets);
register("Hymn to Tourach", hymnToTourachOverride, hymnToTourachTargets);
register("Vindicate", vindicateOverride, vindicateTargets);
register("Maelstrom Pulse", maelstromPulseOverride, maelstromPulseTargets);
register("Collected Company", collectedCompanyOverride);
register("Boros Charm", borosCharmOverride);
register("Lightning Helix", lightningHelixOverride, lightningHelixTargets);

// Phase 4 keyword creature overrides (spell + keyword static abilities)
register("Grizzly Bears", grizzlyBearsOverride);
register("Serra Angel", serraAngelOverride);
register("Llanowar Elves", llanowarElvesKeywordOverride);
register("Goblin Guide", goblinGuideKeywordOverride);
register("Giant Spider", giantSpiderOverride);
register("Air Elemental", airElementalOverride);
register("Vampire Nighthawk", vampireNighthawkOverride);
register("Monastery Swiftspear", monasterySwiftspearOverride);
register("Savannah Lions", savannahLionsOverride);
register("Elvish Mystic", elvishMysticOverride);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a card override by name (case-insensitive).
 *
 * Returns the override entry containing the ability factory and
 * target requirements, or undefined if no override is registered.
 */
export function getCardOverride(name: string): CardOverrideEntry | undefined {
  return overrides.get(name.toLowerCase());
}

/**
 * Check whether a card has a manual override registered.
 */
export function hasCardOverride(name: string): boolean {
  return overrides.has(name.toLowerCase());
}

/**
 * Return all registered override card names (lowercase).
 * Useful for diagnostics and testing.
 */
export function getOverrideNames(): string[] {
  return [...overrides.keys()];
}
