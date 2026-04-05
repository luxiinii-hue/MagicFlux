/**
 * Commander/EDH staples.
 * High-impact cards commonly played in Commander format.
 * Sol Ring and Command Tower already registered elsewhere.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// --- Cyclonic Rift: Return target nonland permanent. Overload {6}{U}: return all ---
export function cyclonicRiftOverride(): SpellAbility[] { return [{ type: "spell", id: "crift", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "cyclonic_rift" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const cyclonicRiftTargets: TargetRequirement[] = [{ id: "cr_t1", description: "target nonland permanent you don't control", count: { exactly: 1 }, targetTypes: ["permanent"], filter: { cardTypes: ["Creature", "Artifact", "Enchantment", "Planeswalker"] }, controller: "opponent" }];

// --- Demonic Tutor: Search library for a card, put in hand ---
export function demonicTutorOverride(): SpellAbility[] { return [{ type: "spell", id: "dt", sourceCardInstanceId: null, effects: [{ type: "search", zone: ZoneType.Library, filter: {}, player: { type: "controller" }, then: { type: "custom", resolveFunction: "search_put_in_hand" } }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }

// --- Rhystic Study: Whenever opponent casts, draw unless they pay {1} ---
export function rhysticStudyOverride(): SpellAbility[] { return [{ type: "triggered", id: "rhystic", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "rhystic_study" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "spellCast", filter: null, self: false, optional: false, interveningIf: null }, targets: [] }]; }

// --- Mystic Remora: Whenever opponent casts noncreature, draw unless they pay {4} ---
export function mysticRemoraOverride(): SpellAbility[] { return [{ type: "triggered", id: "remora", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "mystic_remora" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "spellCast", filter: { cardTypes: ["Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker"] }, self: false, optional: false, interveningIf: null }, targets: [] }]; }

// --- Smothering Tithe: Whenever opponent draws, they pay {2} or you create a Treasure ---
export function smotheringTitheOverride(): SpellAbility[] { return [{ type: "triggered", id: "tithe", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "smothering_tithe" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardEnteredZone", filter: null, self: false, optional: false, interveningIf: null }, targets: [] }]; }

// --- Fierce Guardianship: Free counter (commander on battlefield). Counter noncreature spell ---
export function fierceGuardianshipOverride(): SpellAbility[] { return [{ type: "spell", id: "fg", sourceCardInstanceId: null, effects: [{ type: "counter", target: { targetRequirementId: "fg_t1" } }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const fierceGuardianshipTargets: TargetRequirement[] = [{ id: "fg_t1", description: "target noncreature spell", count: { exactly: 1 }, targetTypes: ["spell"], filter: null, controller: "any" }];

// --- Deflecting Swat: Free redirect (commander on battlefield) ---
export function deflectingSwatOverride(): SpellAbility[] { return [{ type: "spell", id: "ds", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "deflecting_swat" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }

// --- Deadly Rollick: Free exile creature (commander on battlefield) ---
export function deadlyRollickOverride(): SpellAbility[] { return [{ type: "spell", id: "dr", sourceCardInstanceId: null, effects: [{ type: "exile", target: { targetRequirementId: "dr_t1" } }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const deadlyRollickTargets: TargetRequirement[] = [{ id: "dr_t1", description: "target creature", count: { exactly: 1 }, targetTypes: ["creature"], filter: null, controller: "any" }];

// --- Heroic Intervention: Your permanents gain hexproof and indestructible until EOT ---
export function heroicInterventionOverride(): SpellAbility[] { return [{ type: "spell", id: "hi", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "heroic_intervention" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }

// --- Teferi's Protection: Phase out all permanents, can't lose life until your next turn ---
export function teferisProtectionOverride(): SpellAbility[] { return [{ type: "spell", id: "tp", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "teferis_protection" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }

// --- Swords to Plowshares already in standard-instants.ts ---

// --- Beast Within already in sprint-midrange.ts ---

// --- Chaos Warp: Shuffle target permanent into library, reveal top card, put permanent onto battlefield ---
export function chaosWarpOverride(): SpellAbility[] { return [{ type: "spell", id: "cw", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "chaos_warp" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const chaosWarpTargets: TargetRequirement[] = [{ id: "cw_t1", description: "target permanent", count: { exactly: 1 }, targetTypes: ["permanent"], filter: null, controller: "any" }];

// --- Arcane Signet: {T}: Add one mana of any color in your commander's color identity ---
export function arcaneSignetOverride(): SpellAbility[] { return [{ type: "mana", id: "signet_mana", sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } }]; }

// --- Thought Vessel: {T}: Add {C}. No max hand size ---
export function thoughtVesselOverride(): SpellAbility[] { return [
  { type: "mana", id: "tv_mana", sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } },
  { type: "static", id: "tv_no_max", sourceCardInstanceId: null, effects: [], zones: [ZoneType.Battlefield], continuousEffect: { effectType: "noMaxHandSize", affectedFilter: {}, modification: {} }, condition: null, layer: 6 },
]; }

// --- Lightning Greaves already registered ---

// --- Swiftfoot Boots: Equipped creature has hexproof and haste. Equip {1} ---
export function swiftfootBootsOverride(): SpellAbility[] { return [
  { type: "static", id: "boots_static", sourceCardInstanceId: null, effects: [], zones: [ZoneType.Battlefield], continuousEffect: { effectType: "grantKeyword", affectedFilter: { self: false, custom: "equipped_creature" }, modification: { keywords: ["Hexproof", "Haste"] } }, condition: null, layer: 6 },
  { type: "activated", id: "boots_equip", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "equip_attach" }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }], totalCMC: 1 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "sorcery", targets: [{ id: "boots_t1", description: "target creature you control", count: { exactly: 1 }, targetTypes: ["creature"], filter: null, controller: "you" }], activationRestrictions: [] },
]; }
export const swiftfootBootsTargets: TargetRequirement[] = [{ id: "boots_t1", description: "target creature you control", count: { exactly: 1 }, targetTypes: ["creature"], filter: null, controller: "you" }];

// --- Sensei's Divining Top: {1}: Look at top 3. {T}: Draw, put Top on top of library ---
export function senseisDiviningTopOverride(): SpellAbility[] { return [
  { type: "activated", id: "top_look", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "top_look_3" }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }], totalCMC: 1 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [], activationRestrictions: [] },
  { type: "activated", id: "top_draw", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "top_draw_put_back" }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [], activationRestrictions: [] },
]; }

// --- Mana Crypt: {T}: Add {C}{C}. Upkeep flip coin: 3 damage if tails ---
export function manaCryptOverride(): SpellAbility[] { return [
  { type: "mana", id: "crypt_mana", sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 2 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } },
  { type: "triggered", id: "crypt_upkeep", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "mana_crypt_flip" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "phaseChanged", filter: null, self: false, optional: false, interveningIf: null }, targets: [] },
]; }

// --- Popular Commanders ---

// --- Atraxa, Praetors' Voice: Flying, vigilance, deathtouch, lifelink. At end step proliferate ---
export function atraxaOverride(): SpellAbility[] { return [{ type: "triggered", id: "atraxa_proliferate", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "proliferate" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "phaseChanged", filter: null, self: false, optional: false, interveningIf: null }, targets: [] }]; }

// --- Edgar Markov: Eminence — whenever you cast a Vampire, create a 1/1 black Vampire token ---
export function edgarMarkovOverride(): SpellAbility[] { return [
  { type: "triggered", id: "edgar_eminence", sourceCardInstanceId: null, effects: [{ type: "createToken", token: { name: "Vampire", colors: ["B"], cardTypes: ["Creature"], subtypes: ["Vampire"], power: 1, toughness: 1, abilities: [], keywords: [] }, count: 1, controller: { type: "controller" } }], zones: [ZoneType.Battlefield, ZoneType.CommandZone], triggerCondition: { eventType: "spellCast", filter: { subtypes: ["Vampire"] }, self: false, optional: false, interveningIf: null }, targets: [] },
  { type: "triggered", id: "edgar_attack", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "edgar_pump_vampires" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "attackersDeclared", filter: null, self: true, optional: false, interveningIf: null }, targets: [] },
]; }

// --- Muldrotha, the Gravetide: Each turn, cast one permanent of each type from graveyard ---
export function muldrothaOverride(): SpellAbility[] { return [{ type: "static", id: "muldrotha_static", sourceCardInstanceId: null, effects: [], zones: [ZoneType.Battlefield], continuousEffect: { effectType: "castFromGraveyard", affectedFilter: {}, modification: { permanentTypes: true } }, condition: null, layer: 6 }]; }

// --- Korvold, Fae-Cursed King: Flying. Whenever you sacrifice, draw a card and +1/+1 counter ---
export function korvoldOverride(): SpellAbility[] { return [{ type: "triggered", id: "korvold_sac", sourceCardInstanceId: null, effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }, { type: "addCounters", counterType: "+1/+1", count: 1, target: { targetRequirementId: "self" } }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardLeftZone", filter: null, self: false, optional: false, interveningIf: null }, targets: [] }]; }

// --- Kenrith, the Returned King: 5 activated abilities (one per color) ---
export function kenrithOverride(): SpellAbility[] { return [
  { type: "activated", id: "kenrith_r", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "kenrith_trample_haste" }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "colored", color: "R" }], totalCMC: 1 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [], activationRestrictions: [] },
  { type: "activated", id: "kenrith_g", sourceCardInstanceId: null, effects: [{ type: "addCounters", counterType: "+1/+1", count: 1, target: { targetRequirementId: "ken_t1" } }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }, { type: "colored", color: "G" }], totalCMC: 2 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [{ id: "ken_t1", description: "target creature", count: { exactly: 1 }, targetTypes: ["creature"], filter: null, controller: "any" }], activationRestrictions: [] },
  { type: "activated", id: "kenrith_w", sourceCardInstanceId: null, effects: [{ type: "gainLife", amount: 5, player: { type: "targetPlayer", targetRef: { targetRequirementId: "ken_t2" } } }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }, { type: "colored", color: "W" }], totalCMC: 2 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [{ id: "ken_t2", description: "target player", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "any" }], activationRestrictions: [] },
  { type: "activated", id: "kenrith_u", sourceCardInstanceId: null, effects: [{ type: "drawCards", count: 1, player: { type: "targetPlayer", targetRef: { targetRequirementId: "ken_t3" } } }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 2 }, { type: "colored", color: "U" }], totalCMC: 3 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [{ id: "ken_t3", description: "target player", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "any" }], activationRestrictions: [] },
  { type: "activated", id: "kenrith_b", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "kenrith_reanimate" }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 3 }, { type: "colored", color: "B" }], totalCMC: 4 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [{ id: "ken_t4", description: "target creature card in a graveyard", count: { exactly: 1 }, targetTypes: ["card-in-graveyard"], filter: { cardTypes: ["Creature"] }, controller: "any" }], activationRestrictions: [] },
]; }
