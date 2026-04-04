/**
 * Override sprint Groups C+D — Midrange, utility, tokens, sacrifice, counters.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// --- Siege Rhino: ETB each opponent loses 3 life, you gain 3 life ---
export function siegeRhinoOverride(): SpellAbility[] {
  return [{
    type: "triggered", id: "rhino_etb", sourceCardInstanceId: null,
    effects: [
      { type: "loseLife", amount: 3, player: { type: "controller" } }, // "each opponent" approximated
      { type: "gainLife", amount: 3, player: { type: "controller" } },
    ],
    zones: [ZoneType.Battlefield],
    triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
    targets: [],
  }];
}

// --- Thragtusk: ETB gain 5 life. LTB create 3/3 Beast token ---
export function thragtuskOverride(): SpellAbility[] {
  return [
    { type: "triggered", id: "thragtusk_etb", sourceCardInstanceId: null,
      effects: [{ type: "gainLife", amount: 5, player: { type: "controller" } }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [] },
    { type: "triggered", id: "thragtusk_ltb", sourceCardInstanceId: null,
      effects: [{
        type: "createToken",
        token: { name: "Beast", colors: ["G"], cardTypes: ["Creature"], subtypes: ["Beast"], power: 3, toughness: 3, abilities: [], keywords: [] },
        count: 1, controller: { type: "controller" },
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardLeftZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [] },
  ];
}

// --- Restoration Angel: Flash, Flying. ETB exile target nonangel creature you control, return it ---
export function restorationAngelOverride(): SpellAbility[] {
  return [{
    type: "triggered", id: "resto_etb", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "blink_creature" }],
    zones: [ZoneType.Battlefield],
    triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: true, interveningIf: null },
    targets: [{
      id: "resto_t1", description: "target non-Angel creature you control", count: { exactly: 1 },
      targetTypes: ["creature"], filter: { subtypes: ["Angel"] }, controller: "you", // Note: filter should exclude Angels — engine handles negation
    }],
  }];
}
export const restorationAngelTargets: TargetRequirement[] = [{
  id: "resto_t1", description: "target non-Angel creature you control", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "you",
}];

// --- Scavenging Ooze: {G}: Exile target card from a graveyard. If creature, +1/+1 counter and gain 1 life ---
export function scavengingOozeOverride(): SpellAbility[] {
  return [{
    type: "activated", id: "ooze_exile", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "scavenging_ooze" }],
    zones: [ZoneType.Battlefield],
    cost: { manaCost: { symbols: [{ type: "colored", color: "G" }], totalCMC: 1 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
    timing: "instant", targets: [{ id: "ooze_t1", description: "target card in a graveyard", count: { exactly: 1 }, targetTypes: ["card-in-graveyard"], filter: null, controller: "any" }],
    activationRestrictions: [],
  }];
}

// --- Tireless Tracker: Landfall — investigate (create a Clue token) ---
export function tirelessTrackerOverride(): SpellAbility[] {
  return [{
    type: "triggered", id: "tracker_landfall", sourceCardInstanceId: null,
    effects: [{
      type: "createToken",
      token: { name: "Clue", colors: [], cardTypes: ["Artifact"], subtypes: ["Clue"], power: null, toughness: null, abilities: [], keywords: [] },
      count: 1, controller: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: { eventType: "cardEnteredZone", filter: { cardTypes: ["Land"] }, self: false, optional: false, interveningIf: null },
    targets: [],
  }];
}

// --- Eternal Witness: ETB return target card from graveyard to hand ---
export function eternalWitnessOverride(): SpellAbility[] {
  return [{
    type: "triggered", id: "ewit_etb", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "eternal_witness_return" }],
    zones: [ZoneType.Battlefield],
    triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: true, interveningIf: null },
    targets: [{ id: "ewit_t1", description: "target card in your graveyard", count: { exactly: 1 }, targetTypes: ["card-in-graveyard"], filter: null, controller: "you" }],
  }];
}
export const eternalWitnessTargets: TargetRequirement[] = [{
  id: "ewit_t1", description: "target card in your graveyard", count: { exactly: 1 },
  targetTypes: ["card-in-graveyard"], filter: null, controller: "you",
}];

// --- Voice of Resurgence: Opponent casts on your turn → create X/X Elemental (X = creatures you control) ---
export function voiceOfResurgenceOverride(): SpellAbility[] {
  return [
    { type: "triggered", id: "voice_cast", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "voice_create_elemental" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "spellCast", filter: null, self: false, optional: false, interveningIf: null },
      targets: [] },
    { type: "triggered", id: "voice_dies", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "voice_create_elemental" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardDestroyed", filter: null, self: true, optional: false, interveningIf: null },
      targets: [] },
  ];
}

// --- Walking Ballista: ETB with X +1/+1 counters. Remove counter to deal 1 damage ---
export function walkingBallistaOverride(): SpellAbility[] {
  return [
    { type: "activated", id: "ballista_ping", sourceCardInstanceId: null,
      effects: [{ type: "dealDamage", amount: 1, to: { targetRequirementId: "ballista_t1" } }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "+1/+1", count: 1 }, additionalCosts: [] },
      timing: "instant", targets: [{ id: "ballista_t1", description: "any target", count: { exactly: 1 }, targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any" }],
      activationRestrictions: [] },
    { type: "activated", id: "ballista_pump", sourceCardInstanceId: null,
      effects: [{ type: "addCounters", counterType: "+1/+1", count: 1, target: { targetRequirementId: "self" } }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: { symbols: [{ type: "generic", amount: 4 }], totalCMC: 4 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
      timing: "instant", targets: [], activationRestrictions: [] },
  ];
}

// --- Hangarback Walker: Dies — create X 1/1 Thopter tokens with flying (X = +1/+1 counters) ---
export function hangarbackWalkerOverride(): SpellAbility[] {
  return [
    { type: "activated", id: "hangarback_pump", sourceCardInstanceId: null,
      effects: [{ type: "addCounters", counterType: "+1/+1", count: 1, target: { targetRequirementId: "self" } }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }, { type: "colored", color: "C" as any }], totalCMC: 2 }, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
      timing: "instant", targets: [], activationRestrictions: [] },
    { type: "triggered", id: "hangarback_dies", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "hangarback_thopters" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardDestroyed", filter: null, self: true, optional: false, interveningIf: null },
      targets: [] },
  ];
}

// --- Collected Company already in standard-instants.ts ---

// --- Aether Vial: Put charge counter at upkeep, tap to put creature from hand onto battlefield ---
export function aetherVialOverride(): SpellAbility[] {
  return [
    { type: "triggered", id: "vial_upkeep", sourceCardInstanceId: null,
      effects: [{ type: "addCounters", counterType: "charge", count: 1, target: { targetRequirementId: "self" } }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "phaseChanged", filter: null, self: false, optional: true, interveningIf: null },
      targets: [] },
    { type: "activated", id: "vial_activate", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "aether_vial_put" }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
      timing: "instant", targets: [], activationRestrictions: [] },
  ];
}

// --- Chromatic Star: {1}, {T}, Sacrifice: Add one mana of any color. Draw when it goes to graveyard ---
export function chromaticStarOverride(): SpellAbility[] {
  return [
    { type: "mana", id: "cstar_mana", sourceCardInstanceId: null,
      effects: [{ type: "addMana", mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 }, player: { type: "controller" } }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }], totalCMC: 1 }, tapSelf: true, untapSelf: false, sacrifice: { self: true, description: "Sacrifice ~" }, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } },
    { type: "triggered", id: "cstar_draw", sourceCardInstanceId: null,
      effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
      zones: [ZoneType.Battlefield, ZoneType.Graveyard],
      triggerCondition: { eventType: "cardLeftZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [] },
  ];
}

// --- Rancor: Enchant creature. +2/+0 and trample. Return to hand when it goes to graveyard ---
export function rancorOverride(): SpellAbility[] {
  return [
    { type: "static", id: "rancor_buff", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "modifyPT", affectedFilter: { self: false, custom: "enchanted_creature" }, modification: { power: 2, toughness: 0 } },
      condition: null, layer: 7 },
    { type: "static", id: "rancor_trample", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "grantKeyword", affectedFilter: { self: false, custom: "enchanted_creature" }, modification: { keywords: ["Trample"] } },
      condition: null, layer: 6 },
    { type: "triggered", id: "rancor_return", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "rancor_return_to_hand" }],
      zones: [ZoneType.Graveyard],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [] },
  ];
}

// --- Expedition Map: {2}, {T}, Sacrifice: Search for a land, put in hand ---
export function expeditionMapOverride(): SpellAbility[] {
  return [{
    type: "activated", id: "map_search", sourceCardInstanceId: null,
    effects: [{ type: "search", zone: ZoneType.Library, filter: { cardTypes: ["Land"] }, player: { type: "controller" }, then: { type: "custom", resolveFunction: "put_in_hand" } }],
    zones: [ZoneType.Battlefield],
    cost: { manaCost: { symbols: [{ type: "generic", amount: 2 }], totalCMC: 2 }, tapSelf: true, untapSelf: false, sacrifice: { self: true, description: "Sacrifice ~" }, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
    timing: "instant", targets: [], activationRestrictions: [],
  }];
}

// --- Cultivate: Search for up to 2 basic lands. Put one onto battlefield tapped, other in hand ---
export function cultivateOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "cultivate_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "cultivate" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Farseek: Search for a Plains, Island, Swamp, or Mountain card, put it onto battlefield tapped ---
export function farseekOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "farseek_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "farseek_search" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Rampant Growth: Search for a basic land, put it onto battlefield tapped ---
export function rampantGrowthOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "rg_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "rampant_growth_search" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Beast Within: Destroy target permanent. Its controller creates a 3/3 Beast ---
export function beastWithinOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "bw_spell", sourceCardInstanceId: null,
    effects: [
      { type: "destroy", target: { targetRequirementId: "bw_t1" } },
      { type: "custom", resolveFunction: "beast_within_token" },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const beastWithinTargets: TargetRequirement[] = [{
  id: "bw_t1", description: "target permanent", count: { exactly: 1 },
  targetTypes: ["permanent"], filter: null, controller: "any",
}];

// --- Dismember: -5/-5 until EOT. May pay 4 life instead of {1} ---
export function dismemberOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "dismember_spell", sourceCardInstanceId: null,
    effects: [{ type: "modifyPT", power: -5, toughness: -5, target: { targetRequirementId: "dis_t1" }, duration: "endOfTurn" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const dismemberTargets: TargetRequirement[] = [{
  id: "dis_t1", description: "target creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];
