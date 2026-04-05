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
import {
  eidolonOfTheGreatRevelOverride,
  earthshakerKhenraOverride, earthshakerKhenraTargets,
  thaliaOverride,
  adantoVanguardOverride,
  benalishMarshalOverride,
  experimentOneOverride,
  peltCollectorOverride,
  steelLeafChampionOverride,
  burningTreeEmissaryOverride,
  gruulSpellbreakerOverride,
} from "./aggro-staples.js";
import {
  essenceScatterOverride, essenceScatterTargets,
  serumVisionsOverride,
  fatalPushOverride, fatalPushTargets,
  inquisitionOfKozilekOverride, inquisitionOfKozilekTargets,
  herosDownfallOverride, herosDownfallTargets,
  wrathOfGodOverride,
  dayOfJudgmentOverride,
} from "./control-staples.js";
import {
  siegeRhinoOverride,
  assassinsTrophyOverride, assassinsTrophyTargets,
  mindStoneOverride,
  rampantGrowthOverride,
  cultivateOverride,
} from "./midrange-staples.js";
import {
  raiseTheAlarmOverride,
  dragonFodderOverride,
  lingeringSoulsOverride,
  spectralProcessionOverride,
  youngPyromancerOverride,
  sakuraTribeElderOverride,
  villageRitesOverride,
  visceraSeerOverride,
  walkingBallistaOverride, walkingBallistaTargets,
  luminarchAspirantOverride, luminarchAspirantTargets,
  championOfTheParishOverride,
  fireballOverride, fireballTargets,
  sphinxsRevelationOverride,
} from "./new-effect-cards.js";
import {
  monasteryMentorOverride, goblinRabblemasterOverride,
  zurgoBellstrikerOverride, figureOfDestinyOverride,
  ahnCropCrasherOverride, ahnCropCrasherTargets, falkenrathGorgerOverride,
  recklessBushwhackerOverride, chainLightningOverride, chainLightningTargets,
  lavaSpikeOverride, lavaSpikeTargets, riftBoltOverride, riftBoltTargets,
  skullcrackOverride, skullcrackTargets, searingBlazeOverride, searingBlazeTargets,
  brimstoneVolleyOverride, brimstoneVolleyTargets,
  stokeTheFlamesOverride, stokeTheFlamesTargets,
  exquisiteFirecraftOverride, exquisiteFirecraftTargets,
} from "./sprint-aggro.js";
import {
  supremeVerdictOverride, damnationOverride,
  crypticCommandOverride, forceOfWillOverride, forceOfWillTargets,
  remandOverride, remandTargets,
  jaceTMSOverride, lilianaOfTheVeilOverride,
  factOrFictionOverride, digThroughTimeOverride, treasureCruiseOverride,
  collectiveBrutalityOverride,
  detentionSphereOverride, detentionSphereTargets,
  thinkTwiceOverride,
} from "./sprint-control.js";
import {
  thragtuskOverride,
  restorationAngelOverride, restorationAngelTargets,
  scavengingOozeOverride, tirelessTrackerOverride,
  eternalWitnessOverride, eternalWitnessTargets,
  voiceOfResurgenceOverride, hangarbackWalkerOverride,
  aetherVialOverride, chromaticStarOverride, rancorOverride,
  expeditionMapOverride, farseekOverride,
  beastWithinOverride, beastWithinTargets, dismemberOverride, dismemberTargets,
} from "./sprint-midrange.js";
import {
  // Removal/Interaction
  goForTheThroatOverride, goForTheThroatTargets,
  condemnOverride, condemnTargets,
  anguishedUnmakingOverride, anguishedUnmakingTargets,
  dreadboreOverride, dreadboreTargets,
  kolaghansCommandOverride, kolaghansCommandTargets,
  electrolyzeOverride, electrolyzeTargets,
  izzetCharmOverride, izzetCharmTargets,
  lightningStrikeOverride, lightningStrikeTargets,
  charOverride, charTargets,
  // Creatures
  vendilionCliqueOverride,
  spellQuellerOverride,
  reflectorMageOverride, reflectorMageTargets,
  thoughtKnotSeerOverride,
  gurmagAnglerOverride,
  tasigurOverride,
  kalitasOverride,
  glorybringerOverride,
  rekindlingPhoenixOverride,
  questingBeastOverride,
  polukranosOverride,
  knightOfAutumnOverride,
  // Enchantments/Artifacts
  restInPeaceOverride,
  leylineOfTheVoidOverride,
  chaliceOfTheVoidOverride,
  pithingNeedleOverride,
  grafdiggersCageOverride,
  tormodsCryptOverride, tormodsCryptTargets,
  relicOfProgenitusOverride,
  // Instants/Sorceries
  abzanCharmOverride,
  dromokasCommandOverride, dromokasCommandTargets,
  unburialRitesOverride, unburialRitesTargets,
  traverseTheUlvenwaldOverride,
  // Extra staples
  settleTheWreckageOverride,
  councilsJudgmentOverride, councilsJudgmentTargets,
  spellSnareOverride, spellSnareTargets,
  dissolveOverride, dissolveTargets,
  boneShardsOverride, boneShardsTargets,
  searingSpearOverride, searingSpearTargets,
  skullclampOverride,
  thrunOverride,
  fleecemaneLionOverride,
  dragonlordOjutaiOverride,
  mantisRiderOverride,
  anafenzaOverride,
  grimLavamancerOverride, grimLavamancerTargets,
} from "./final-sprint.js";

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
  /** Power string (e.g., "4", "*"). Used when Scryfall DB is not loaded. */
  readonly power: string | null;
  /** Toughness string (e.g., "4", "*"). Used when Scryfall DB is not loaded. */
  readonly toughness: string | null;
}

// ---------------------------------------------------------------------------
// Registry map (case-insensitive lookup)
// ---------------------------------------------------------------------------

const overrides = new Map<string, CardOverrideEntry>();

function register(
  name: string,
  getAbilities: () => SpellAbility[],
  spellTargets: readonly TargetRequirement[] = [],
  power: string | null = null,
  toughness: string | null = null,
): void {
  overrides.set(name.toLowerCase(), { getAbilities, spellTargets, power, toughness });
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
register("Elvish Visionary", elvishVisionaryOverride, [], "1", "1");
register("Flametongue Kavu", flametongueKavuOverride, flametongueKavuTargets, "4", "2");
register("Acidic Slime", acidicSlimeOverride, acidicSlimeTargets, "2", "2");
register("Mulldrifter", mulldrifterOverride, [], "2", "2");
register("Ravenous Chupacabra", ravenousChupacabraOverride, ravenousChupacabraTargets, "2", "2");

// Phase 3 enchantment/artifact overrides
register("Oblivion Ring", oblivionRingOverride, oblivionRingTargets);
register("Lightning Greaves", lightningGreavesOverride, lightningGreavesTargets);
register("Pacifism", pacifismOverride, pacifismTargets);
register("Sol Ring", solRingOverride);
register("Bonesplitter", bonesplitterOverride, bonesplitterTargets);

// Phase 3 additional creature overrides (20+ creatures)
// White
register("Wall of Omens", wallOfOmensOverride, [], "0", "4");
register("Mother of Runes", motherOfRunesOverride, motherOfRunesTargets, "1", "1");
register("Baneslayer Angel", baneslayerAngelOverride, [], "5", "5");
// Blue
register("Snapcaster Mage", snapcasterMageOverride, snapcasterMageTargets, "2", "1");
register("Delver of Secrets", delverOfSecretsOverride, [], "1", "1");
register("Man-o'-War", manOWarOverride, manOWarTargets, "2", "2");
// Black
register("Nether Spirit", netherSpiritOverride, [], "2", "2");
register("Dark Confidant", darkConfidantOverride, [], "2", "1");
register("Dread Shade", dreadShadeOverride, [], "3", "3");
// Red
register("Lightning Mauler", lightningMaulerOverride, [], "2", "1");
register("Ball Lightning", ballLightningOverride, [], "6", "1");
register("Ember Hauler", emberHaulerOverride, emberHaulerTargets, "2", "2");
// Green
register("Tarmogoyf", tarmogoyfOverride, [], "*", "1+*");
register("Sylvan Caryatid", sylvanCaryatidOverride, [], "0", "3");
register("Leatherback Baloth", leatherbackBalothOverride, [], "4", "5");
register("Kalonian Tusker", kalonianTuskerOverride, [], "3", "3");
register("Courser of Kruphix", courserOfKruphixOverride, [], "2", "4");
// Multicolor
register("Geist of Saint Traft", geistOfSaintTraftOverride, [], "2", "2");
register("Kitchen Finks", kitchenFinksOverride, [], "3", "2");
register("Bloodbraid Elf", bloodbraidElfOverride, [], "3", "2");

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
register("Grizzly Bears", grizzlyBearsOverride, [], "2", "2");
register("Serra Angel", serraAngelOverride, [], "4", "4");
register("Llanowar Elves", llanowarElvesKeywordOverride, [], "1", "1");
register("Goblin Guide", goblinGuideKeywordOverride, [], "2", "2");
register("Giant Spider", giantSpiderOverride, [], "2", "4");
register("Air Elemental", airElementalOverride, [], "4", "4");
register("Vampire Nighthawk", vampireNighthawkOverride, [], "2", "3");
register("Monastery Swiftspear", monasterySwiftspearOverride, [], "1", "2");
register("Savannah Lions", savannahLionsOverride, [], "2", "1");
register("Elvish Mystic", elvishMysticOverride, [], "1", "1");

// Phase 5 Group A: Aggro staples
register("Eidolon of the Great Revel", eidolonOfTheGreatRevelOverride, [], "2", "2");
register("Earthshaker Khenra", earthshakerKhenraOverride, earthshakerKhenraTargets, "2", "1");
register("Thalia, Guardian of Thraben", thaliaOverride, [], "2", "1");
register("Adanto Vanguard", adantoVanguardOverride, [], "1", "1");
register("Benalish Marshal", benalishMarshalOverride, [], "3", "3");
register("Experiment One", experimentOneOverride, [], "1", "1");
register("Pelt Collector", peltCollectorOverride, [], "1", "1");
register("Steel Leaf Champion", steelLeafChampionOverride, [], "5", "4");
register("Burning-Tree Emissary", burningTreeEmissaryOverride, [], "2", "2");
register("Gruul Spellbreaker", gruulSpellbreakerOverride, [], "3", "3");

// Phase 5 Group B: Control staples
register("Essence Scatter", essenceScatterOverride, essenceScatterTargets);
register("Serum Visions", serumVisionsOverride);
register("Fatal Push", fatalPushOverride, fatalPushTargets);
register("Inquisition of Kozilek", inquisitionOfKozilekOverride, inquisitionOfKozilekTargets);
register("Hero's Downfall", herosDownfallOverride, herosDownfallTargets);
register("Wrath of God", wrathOfGodOverride);
register("Day of Judgment", dayOfJudgmentOverride);

// Phase 5 Group C: Midrange/utility staples
register("Siege Rhino", siegeRhinoOverride);
register("Assassin's Trophy", assassinsTrophyOverride, assassinsTrophyTargets);
register("Mind Stone", mindStoneOverride);
register("Rampant Growth", rampantGrowthOverride);
register("Cultivate", cultivateOverride);

// Phase 5 Group D: Cards using new effect types (tokens, sacrifice, counters, X spells)
register("Raise the Alarm", raiseTheAlarmOverride);
register("Dragon Fodder", dragonFodderOverride);
register("Lingering Souls", lingeringSoulsOverride);
register("Spectral Procession", spectralProcessionOverride);
register("Young Pyromancer", youngPyromancerOverride, [], "2", "1");
register("Sakura-Tribe Elder", sakuraTribeElderOverride, [], "1", "1");
register("Village Rites", villageRitesOverride);
register("Viscera Seer", visceraSeerOverride, [], "1", "1");
register("Walking Ballista", walkingBallistaOverride, walkingBallistaTargets, "0", "0");
register("Luminarch Aspirant", luminarchAspirantOverride, luminarchAspirantTargets, "1", "1");
register("Champion of the Parish", championOfTheParishOverride, [], "1", "1");
register("Fireball", fireballOverride, fireballTargets);
register("Sphinx's Revelation", sphinxsRevelationOverride);

// Phase 5 sprint: additional cards (non-overlapping with aggro/control-staples)
register("Monastery Mentor", monasteryMentorOverride, [], "2", "2");
register("Goblin Rabblemaster", goblinRabblemasterOverride, [], "2", "2");
register("Zurgo Bellstriker", zurgoBellstrikerOverride, [], "2", "2");
register("Figure of Destiny", figureOfDestinyOverride, [], "1", "1");
register("Ahn-Crop Crasher", ahnCropCrasherOverride, ahnCropCrasherTargets, "3", "2");
register("Falkenrath Gorger", falkenrathGorgerOverride, [], "2", "1");
register("Reckless Bushwhacker", recklessBushwhackerOverride, [], "2", "1");
register("Chain Lightning", chainLightningOverride, chainLightningTargets);
register("Lava Spike", lavaSpikeOverride, lavaSpikeTargets);
register("Rift Bolt", riftBoltOverride, riftBoltTargets);
register("Skullcrack", skullcrackOverride, skullcrackTargets);
register("Searing Blaze", searingBlazeOverride, searingBlazeTargets);
register("Brimstone Volley", brimstoneVolleyOverride, brimstoneVolleyTargets);
register("Stoke the Flames", stokeTheFlamesOverride, stokeTheFlamesTargets);
register("Exquisite Firecraft", exquisiteFirecraftOverride, exquisiteFirecraftTargets);
register("Supreme Verdict", supremeVerdictOverride);
register("Damnation", damnationOverride);
register("Cryptic Command", crypticCommandOverride);
register("Force of Will", forceOfWillOverride, forceOfWillTargets);
register("Remand", remandOverride, remandTargets);
register("Jace, the Mind Sculptor", jaceTMSOverride);
register("Liliana of the Veil", lilianaOfTheVeilOverride);
register("Fact or Fiction", factOrFictionOverride);
register("Dig Through Time", digThroughTimeOverride);
register("Treasure Cruise", treasureCruiseOverride);
register("Collective Brutality", collectiveBrutalityOverride);
register("Detention Sphere", detentionSphereOverride, detentionSphereTargets);
register("Think Twice", thinkTwiceOverride);
register("Thragtusk", thragtuskOverride, [], "5", "3");
register("Restoration Angel", restorationAngelOverride, restorationAngelTargets, "3", "4");
register("Scavenging Ooze", scavengingOozeOverride, [], "2", "2");
register("Tireless Tracker", tirelessTrackerOverride, [], "3", "2");
register("Eternal Witness", eternalWitnessOverride, eternalWitnessTargets, "2", "1");
register("Voice of Resurgence", voiceOfResurgenceOverride, [], "2", "2");
register("Hangarback Walker", hangarbackWalkerOverride, [], "0", "0");
register("Aether Vial", aetherVialOverride);
register("Chromatic Star", chromaticStarOverride);
register("Rancor", rancorOverride);
register("Expedition Map", expeditionMapOverride);
register("Farseek", farseekOverride);
register("Beast Within", beastWithinOverride, beastWithinTargets);
register("Dismember", dismemberOverride, dismemberTargets);

// Final sprint: 45 new cards to reach 200+
// Removal/Interaction
register("Go for the Throat", goForTheThroatOverride, goForTheThroatTargets);
register("Condemn", condemnOverride, condemnTargets);
register("Anguished Unmaking", anguishedUnmakingOverride, anguishedUnmakingTargets);
register("Dreadbore", dreadboreOverride, dreadboreTargets);
register("Kolaghan's Command", kolaghansCommandOverride, kolaghansCommandTargets);
register("Electrolyze", electrolyzeOverride, electrolyzeTargets);
register("Izzet Charm", izzetCharmOverride, izzetCharmTargets);
register("Lightning Strike", lightningStrikeOverride, lightningStrikeTargets);
register("Char", charOverride, charTargets);
// Creatures
register("Vendilion Clique", vendilionCliqueOverride, [], "3", "1");
register("Spell Queller", spellQuellerOverride, [], "2", "3");
register("Reflector Mage", reflectorMageOverride, reflectorMageTargets, "2", "3");
register("Thought-Knot Seer", thoughtKnotSeerOverride, [], "4", "4");
register("Gurmag Angler", gurmagAnglerOverride, [], "5", "5");
register("Tasigur, the Golden Fang", tasigurOverride, [], "4", "5");
register("Kalitas, Traitor of Ghet", kalitasOverride, [], "3", "4");
register("Glorybringer", glorybringerOverride, [], "4", "4");
register("Rekindling Phoenix", rekindlingPhoenixOverride, [], "4", "3");
register("Questing Beast", questingBeastOverride, [], "4", "4");
register("Polukranos, World Eater", polukranosOverride, [], "5", "5");
register("Knight of Autumn", knightOfAutumnOverride, [], "2", "1");
// Enchantments/Artifacts
register("Rest in Peace", restInPeaceOverride);
register("Leyline of the Void", leylineOfTheVoidOverride);
register("Chalice of the Void", chaliceOfTheVoidOverride);
register("Pithing Needle", pithingNeedleOverride);
register("Grafdigger's Cage", grafdiggersCageOverride);
register("Tormod's Crypt", tormodsCryptOverride, tormodsCryptTargets);
register("Relic of Progenitus", relicOfProgenitusOverride);
// Instants/Sorceries
register("Abzan Charm", abzanCharmOverride);
register("Dromoka's Command", dromokasCommandOverride, dromokasCommandTargets);
register("Unburial Rites", unburialRitesOverride, unburialRitesTargets);
register("Traverse the Ulvenwald", traverseTheUlvenwaldOverride);
// Extra staples to reach 200
register("Settle the Wreckage", settleTheWreckageOverride);
register("Council's Judgment", councilsJudgmentOverride, councilsJudgmentTargets);
register("Spell Snare", spellSnareOverride, spellSnareTargets);
register("Dissolve", dissolveOverride, dissolveTargets);
register("Bone Shards", boneShardsOverride, boneShardsTargets);
register("Searing Spear", searingSpearOverride, searingSpearTargets);
register("Skullclamp", skullclampOverride);
register("Thrun, the Last Troll", thrunOverride, [], "4", "4");
register("Fleecemane Lion", fleecemaneLionOverride, [], "3", "3");
register("Dragonlord Ojutai", dragonlordOjutaiOverride, [], "5", "4");
register("Mantis Rider", mantisRiderOverride, [], "3", "3");
register("Anafenza, the Foremost", anafenzaOverride, [], "4", "4");
register("Grim Lavamancer", grimLavamancerOverride, grimLavamancerTargets, "1", "1");

// Phase 6: Modern burn
import {
  searingBloodOverride, searingBloodTargets, bumpInTheNightOverride, bumpInTheNightTargets,
  shardVolleyOverride, shardVolleyTargets, flamesOfTheBloodHandOverride, flamesOfTheBloodHandTargets,
  lightUpTheStageOverride, waywardGuideBeastOverride, roilingVortexOverride,
  playWithFireOverride, playWithFireTargets, fieryImpulseOverride, fieryImpulseTargets,
  wildSlashOverride, wildSlashTargets, magmaJetOverride, magmaJetTargets,
  bonecrushGiantOverride, bonecrushGiantTargets,
} from "./modern-burn.js";
import {
  sacredFoundryOverride, steamVentsOverride, overgrowlThombOverride, templeGardenOverride,
  hallowedFountainOverride, waternGraveOverride, bloodCryptOverride, stompingGroundOverride,
  godlessShriineOverride, breedingPoolOverride,
  flooodedStrandOverride, pollutedDeltaOverride, bloodstainedMireOverride,
  woodedFoothillsOverride, windsweptHeathOverride, scaldingTarnOverride,
  verdantCatacombsOverride, aridMesaOverride, mistyRainforestOverride, marshFlatsOverride,
  commandTowerOverride, mutavaultOverride, celestialColonnadeOverride,
  creepingTarPitOverride, ragingRavineOverride,
  urzasTowerOverride, urzasMineOverride, urzasPowerPlantOverride,
} from "./modern-lands.js";
import {
  deathsShadowOverride, stoneforgeOverride, primevalTitanOverride, wurmcoilEngineOverride,
  nobleHierarchOverride, birdsOfParadiseOverride, emrakulAeonsTornOverride,
  ulamogCeaselessOverride, karnLiberatedOverride, teferiHeroOverride,
  huntmasterOverride, arcboundRavagerOverride, goblinDarkDwellersOverride,
  infernoTitanOverride, sunTitanOverride, graveTitanOverride,
} from "./modern-creatures.js";

// Modern Burn
register("Searing Blood", searingBloodOverride, searingBloodTargets);
register("Bump in the Night", bumpInTheNightOverride, bumpInTheNightTargets);
register("Shard Volley", shardVolleyOverride, shardVolleyTargets);
register("Flames of the Blood Hand", flamesOfTheBloodHandOverride, flamesOfTheBloodHandTargets);
register("Light Up the Stage", lightUpTheStageOverride);
register("Wayward Guide-Beast", waywardGuideBeastOverride);
register("Roiling Vortex", roilingVortexOverride);
register("Play with Fire", playWithFireOverride, playWithFireTargets);
register("Fiery Impulse", fieryImpulseOverride, fieryImpulseTargets);
register("Wild Slash", wildSlashOverride, wildSlashTargets);
register("Magma Jet", magmaJetOverride, magmaJetTargets);
register("Bonecrusher Giant", bonecrushGiantOverride, bonecrushGiantTargets);
// Modern Lands — Shock lands
register("Sacred Foundry", sacredFoundryOverride);
register("Steam Vents", steamVentsOverride);
register("Overgrown Tomb", overgrowlThombOverride);
register("Temple Garden", templeGardenOverride);
register("Hallowed Fountain", hallowedFountainOverride);
register("Watery Grave", waternGraveOverride);
register("Blood Crypt", bloodCryptOverride);
register("Stomping Ground", stompingGroundOverride);
register("Godless Shrine", godlessShriineOverride);
register("Breeding Pool", breedingPoolOverride);
// Modern Lands — Fetch lands
register("Flooded Strand", flooodedStrandOverride);
register("Polluted Delta", pollutedDeltaOverride);
register("Bloodstained Mire", bloodstainedMireOverride);
register("Wooded Foothills", woodedFoothillsOverride);
register("Windswept Heath", windsweptHeathOverride);
register("Scalding Tarn", scaldingTarnOverride);
register("Verdant Catacombs", verdantCatacombsOverride);
register("Arid Mesa", aridMesaOverride);
register("Misty Rainforest", mistyRainforestOverride);
register("Marsh Flats", marshFlatsOverride);
// Modern Lands — Utility
register("Command Tower", commandTowerOverride);
register("Mutavault", mutavaultOverride);
register("Celestial Colonnade", celestialColonnadeOverride);
register("Creeping Tar Pit", creepingTarPitOverride);
register("Raging Ravine", ragingRavineOverride);
register("Urza's Tower", urzasTowerOverride);
register("Urza's Mine", urzasMineOverride);
register("Urza's Power Plant", urzasPowerPlantOverride);
// Modern Creatures
register("Death's Shadow", deathsShadowOverride, [], "13", "13");
register("Stoneforge Mystic", stoneforgeOverride, [], "1", "2");
register("Primeval Titan", primevalTitanOverride, [], "6", "6");
register("Wurmcoil Engine", wurmcoilEngineOverride, [], "6", "6");
register("Noble Hierarch", nobleHierarchOverride, [], "0", "1");
register("Birds of Paradise", birdsOfParadiseOverride, [], "0", "1");
register("Emrakul, the Aeons Torn", emrakulAeonsTornOverride, [], "15", "15");
register("Ulamog, the Ceaseless Hunger", ulamogCeaselessOverride, [], "10", "10");
register("Karn Liberated", karnLiberatedOverride); // Planeswalker, not creature
register("Teferi, Hero of Dominaria", teferiHeroOverride); // Planeswalker
register("Huntmaster of the Fells", huntmasterOverride, [], "2", "2");
register("Arcbound Ravager", arcboundRavagerOverride, [], "0", "0");
register("Goblin Dark-Dwellers", goblinDarkDwellersOverride, [], "4", "4");
register("Inferno Titan", infernoTitanOverride, [], "6", "6");
register("Sun Titan", sunTitanOverride, [], "6", "6");
register("Grave Titan", graveTitanOverride, [], "6", "6");

// Phase 6: Commander staples
import {
  cyclonicRiftOverride, cyclonicRiftTargets, demonicTutorOverride,
  rhysticStudyOverride, mysticRemoraOverride, smotheringTitheOverride,
  fierceGuardianshipOverride, fierceGuardianshipTargets,
  deflectingSwatOverride, deadlyRollickOverride, deadlyRollickTargets,
  heroicInterventionOverride, teferisProtectionOverride,
  chaosWarpOverride, chaosWarpTargets, arcaneSignetOverride,
  thoughtVesselOverride, swiftfootBootsOverride, swiftfootBootsTargets,
  senseisDiviningTopOverride, manaCryptOverride,
  atraxaOverride, edgarMarkovOverride, muldrothaOverride,
  korvoldOverride, kenrithOverride,
} from "./commander-staples.js";

register("Cyclonic Rift", cyclonicRiftOverride, cyclonicRiftTargets);
register("Demonic Tutor", demonicTutorOverride);
register("Rhystic Study", rhysticStudyOverride);
register("Mystic Remora", mysticRemoraOverride);
register("Smothering Tithe", smotheringTitheOverride);
register("Fierce Guardianship", fierceGuardianshipOverride, fierceGuardianshipTargets);
register("Deflecting Swat", deflectingSwatOverride);
register("Deadly Rollick", deadlyRollickOverride, deadlyRollickTargets);
register("Heroic Intervention", heroicInterventionOverride);
register("Teferi's Protection", teferisProtectionOverride);
register("Chaos Warp", chaosWarpOverride, chaosWarpTargets);
register("Arcane Signet", arcaneSignetOverride);
register("Thought Vessel", thoughtVesselOverride);
register("Swiftfoot Boots", swiftfootBootsOverride, swiftfootBootsTargets);
register("Sensei's Divining Top", senseisDiviningTopOverride);
register("Mana Crypt", manaCryptOverride);
register("Atraxa, Praetors' Voice", atraxaOverride, [], "4", "4");
register("Edgar Markov", edgarMarkovOverride, [], "4", "4");
register("Muldrotha, the Gravetide", muldrothaOverride, [], "6", "6");
register("Korvold, Fae-Cursed King", korvoldOverride, [], "4", "4");
register("Kenrith, the Returned King", kenrithOverride, [], "5", "5");

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
