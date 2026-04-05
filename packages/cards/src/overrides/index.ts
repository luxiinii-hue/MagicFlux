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

// Phase 5 Group A: Aggro staples
register("Eidolon of the Great Revel", eidolonOfTheGreatRevelOverride);
register("Earthshaker Khenra", earthshakerKhenraOverride, earthshakerKhenraTargets);
register("Thalia, Guardian of Thraben", thaliaOverride);
register("Adanto Vanguard", adantoVanguardOverride);
register("Benalish Marshal", benalishMarshalOverride);
register("Experiment One", experimentOneOverride);
register("Pelt Collector", peltCollectorOverride);
register("Steel Leaf Champion", steelLeafChampionOverride);
register("Burning-Tree Emissary", burningTreeEmissaryOverride);
register("Gruul Spellbreaker", gruulSpellbreakerOverride);

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
register("Young Pyromancer", youngPyromancerOverride);
register("Sakura-Tribe Elder", sakuraTribeElderOverride);
register("Village Rites", villageRitesOverride);
register("Viscera Seer", visceraSeerOverride);
register("Walking Ballista", walkingBallistaOverride, walkingBallistaTargets);
register("Luminarch Aspirant", luminarchAspirantOverride, luminarchAspirantTargets);
register("Champion of the Parish", championOfTheParishOverride);
register("Fireball", fireballOverride, fireballTargets);
register("Sphinx's Revelation", sphinxsRevelationOverride);

// Phase 5 sprint: additional cards (non-overlapping with aggro/control-staples)
register("Monastery Mentor", monasteryMentorOverride);
register("Goblin Rabblemaster", goblinRabblemasterOverride);
register("Zurgo Bellstriker", zurgoBellstrikerOverride);
register("Figure of Destiny", figureOfDestinyOverride);
register("Ahn-Crop Crasher", ahnCropCrasherOverride, ahnCropCrasherTargets);
register("Falkenrath Gorger", falkenrathGorgerOverride);
register("Reckless Bushwhacker", recklessBushwhackerOverride);
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
register("Thragtusk", thragtuskOverride);
register("Restoration Angel", restorationAngelOverride, restorationAngelTargets);
register("Scavenging Ooze", scavengingOozeOverride);
register("Tireless Tracker", tirelessTrackerOverride);
register("Eternal Witness", eternalWitnessOverride, eternalWitnessTargets);
register("Voice of Resurgence", voiceOfResurgenceOverride);
register("Hangarback Walker", hangarbackWalkerOverride);
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
register("Vendilion Clique", vendilionCliqueOverride);
register("Spell Queller", spellQuellerOverride);
register("Reflector Mage", reflectorMageOverride, reflectorMageTargets);
register("Thought-Knot Seer", thoughtKnotSeerOverride);
register("Gurmag Angler", gurmagAnglerOverride);
register("Tasigur, the Golden Fang", tasigurOverride);
register("Kalitas, Traitor of Ghet", kalitasOverride);
register("Glorybringer", glorybringerOverride);
register("Rekindling Phoenix", rekindlingPhoenixOverride);
register("Questing Beast", questingBeastOverride);
register("Polukranos, World Eater", polukranosOverride);
register("Knight of Autumn", knightOfAutumnOverride);
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
register("Thrun, the Last Troll", thrunOverride);
register("Fleecemane Lion", fleecemaneLionOverride);
register("Dragonlord Ojutai", dragonlordOjutaiOverride);
register("Mantis Rider", mantisRiderOverride);
register("Anafenza, the Foremost", anafenzaOverride);
register("Grim Lavamancer", grimLavamancerOverride, grimLavamancerTargets);

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
register("Death's Shadow", deathsShadowOverride);
register("Stoneforge Mystic", stoneforgeOverride);
register("Primeval Titan", primevalTitanOverride);
register("Wurmcoil Engine", wurmcoilEngineOverride);
register("Noble Hierarch", nobleHierarchOverride);
register("Birds of Paradise", birdsOfParadiseOverride);
register("Emrakul, the Aeons Torn", emrakulAeonsTornOverride);
register("Ulamog, the Ceaseless Hunger", ulamogCeaselessOverride);
register("Karn Liberated", karnLiberatedOverride);
register("Teferi, Hero of Dominaria", teferiHeroOverride);
register("Huntmaster of the Fells", huntmasterOverride);
register("Arcbound Ravager", arcboundRavagerOverride);
register("Goblin Dark-Dwellers", goblinDarkDwellersOverride);
register("Inferno Titan", infernoTitanOverride);
register("Sun Titan", sunTitanOverride);
register("Grave Titan", graveTitanOverride);

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
register("Atraxa, Praetors' Voice", atraxaOverride);
register("Edgar Markov", edgarMarkovOverride);
register("Muldrotha, the Gravetide", muldrothaOverride);
register("Korvold, Fae-Cursed King", korvoldOverride);
register("Kenrith, the Returned King", kenrithOverride);

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
