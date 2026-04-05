/**
 * Override sprint Group A — Aggro staples.
 *
 * Red/white aggressive creatures, burn, and combat tricks.
 * Many are keyword-only (handled by registry), but cards with
 * ETB triggers, attack triggers, or special abilities need overrides.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// --- Monastery Mentor: Whenever you cast a noncreature spell, create a 1/1 white Monk token with prowess ---
export function monasteryMentorOverride(): SpellAbility[] {
  return [{
    type: "triggered", id: "mentor_cast_trigger", sourceCardInstanceId: null,
    effects: [{
      type: "createToken",
      token: { name: "Monk", colors: ["W"], cardTypes: ["Creature"], subtypes: ["Monk"], power: 1, toughness: 1, abilities: [], keywords: ["Prowess"] },
      count: 1, controller: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: { eventType: "spellCast", filter: { cardTypes: ["Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker"] }, self: false, optional: false, interveningIf: null },
    targets: [],
  }];
}

// --- Young Pyromancer: Whenever you cast an instant or sorcery, create a 1/1 red Elemental token ---
export function youngPyromancerOverride(): SpellAbility[] {
  return [{
    type: "triggered", id: "pyro_cast_trigger", sourceCardInstanceId: null,
    effects: [{
      type: "createToken",
      token: { name: "Elemental", colors: ["R"], cardTypes: ["Creature"], subtypes: ["Elemental"], power: 1, toughness: 1, abilities: [], keywords: [] },
      count: 1, controller: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: { eventType: "spellCast", filter: { cardTypes: ["Instant", "Sorcery"] }, self: false, optional: false, interveningIf: null },
    targets: [],
  }];
}

// --- Thalia, Guardian of Thraben: Noncreature spells cost {1} more ---
export function thaliaOverride(): SpellAbility[] {
  return [{
    type: "static", id: "thalia_tax", sourceCardInstanceId: null, effects: [],
    zones: [ZoneType.Battlefield],
    continuousEffect: { effectType: "costIncrease", affectedFilter: { cardTypes: ["Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker"] }, modification: { genericIncrease: 1 } },
    condition: null, layer: 6,
  }];
}

// --- Eidolon of the Great Revel: Whenever a player casts a spell with CMC 3 or less, deal 2 damage to that player ---
// Note: "that player" refers to the caster of the triggering spell, which isn't expressible
// via TargetRef. Needs engine custom handler that reads the triggering event's playerId.
export function eidolonOfTheGreatRevelOverride(): SpellAbility[] {
  return [{
    type: "triggered", id: "eidolon_trigger", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "eidolon_damage_caster" }],
    zones: [ZoneType.Battlefield],
    triggerCondition: { eventType: "spellCast", filter: { cmc: { op: "lte", value: 3 } }, self: false, optional: false, interveningIf: null },
    targets: [],
  }];
}

// --- Goblin Rabblemaster: Create 1/1 Goblin token at beginning of combat, Goblins must attack ---
export function goblinRabblemasterOverride(): SpellAbility[] {
  return [
    {
      type: "triggered", id: "rabble_token", sourceCardInstanceId: null,
      effects: [{
        type: "createToken",
        token: { name: "Goblin", colors: ["R"], cardTypes: ["Creature"], subtypes: ["Goblin"], power: 1, toughness: 1, abilities: [], keywords: [] },
        count: 1, controller: { type: "controller" },
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "phaseChanged", filter: null, self: false, optional: false, interveningIf: null },
      targets: [],
    },
    {
      type: "static", id: "rabble_pump", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "modifyPT", affectedFilter: { self: true }, modification: { power: { countOf: { zone: ZoneType.Battlefield, controller: "you", subtypes: ["Goblin"] } }, toughness: 0 } },
      condition: null, layer: 7,
    },
  ];
}

// --- Zurgo Bellstriker: 2/2 for {R}, Dash {1}{R} ---
export function zurgoBellstrikerOverride(): SpellAbility[] {
  return [{
    type: "activated", id: "zurgo_dash", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "dash_cast" }],
    zones: [ZoneType.Hand],
    cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }, { type: "colored", color: "R" }], totalCMC: 2 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
    timing: "sorcery", targets: [], activationRestrictions: [],
  }];
}

// --- Figure of Destiny: {R/W}, 1/1 with 3 level-up abilities ---
export function figureOfDestinyOverride(): SpellAbility[] {
  return [
    {
      type: "activated", id: "figure_level1", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "figure_become_2_2" }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: { symbols: [{ type: "hybrid", colors: ["R", "W"] }], totalCMC: 1 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
      timing: "instant", targets: [], activationRestrictions: [],
    },
    {
      type: "activated", id: "figure_level2", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "figure_become_4_4" }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: { symbols: [{ type: "hybrid", colors: ["R", "W"] }, { type: "hybrid", colors: ["R", "W"] }, { type: "hybrid", colors: ["R", "W"] }], totalCMC: 3 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
      timing: "instant", targets: [], activationRestrictions: [],
    },
    {
      type: "activated", id: "figure_level3", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "figure_become_8_8" }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: { symbols: [{ type: "hybrid", colors: ["R", "W"] }, { type: "hybrid", colors: ["R", "W"] }, { type: "hybrid", colors: ["R", "W"] }, { type: "hybrid", colors: ["R", "W"] }, { type: "hybrid", colors: ["R", "W"] }, { type: "hybrid", colors: ["R", "W"] }], totalCMC: 6 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
      timing: "instant", targets: [], activationRestrictions: [],
    },
  ];
}

// --- Ahn-Crop Crasher: Exert when attacks — target creature can't block ---
export function ahnCropCrasherOverride(): SpellAbility[] {
  return [{
    type: "triggered", id: "crasher_exert", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "exert_cant_block" }],
    zones: [ZoneType.Battlefield],
    triggerCondition: { eventType: "attackersDeclared", filter: null, self: true, optional: true, interveningIf: null },
    targets: [{
      id: "crasher_t1", description: "target creature", count: { exactly: 1 },
      targetTypes: ["creature"], filter: null, controller: "opponent",
    }],
  }];
}
export const ahnCropCrasherTargets: TargetRequirement[] = [{
  id: "crasher_t1", description: "target creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "opponent",
}];

// --- Falkenrath Gorger: Each Vampire you control has madness with cost = mana cost ---
export function falkenrathGorgerOverride(): SpellAbility[] {
  return [{
    type: "static", id: "gorger_madness", sourceCardInstanceId: null, effects: [],
    zones: [ZoneType.Battlefield],
    continuousEffect: { effectType: "grantKeyword", affectedFilter: { subtypes: ["Vampire"] }, modification: { keywords: ["Madness"] } },
    condition: null, layer: 6,
  }];
}

// --- Reckless Bushwhacker: Surge {1}{R}, ETB give other creatures you control +1/+0 and haste until EOT ---
export function recklessBushwhackerOverride(): SpellAbility[] {
  return [{
    type: "triggered", id: "bushwhacker_etb", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "bushwhacker_pump" }],
    zones: [ZoneType.Battlefield],
    triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
    targets: [],
  }];
}

// --- Chain Lightning: Deal 3 damage to any target. Then target player may pay {R}{R} to copy ---
export function chainLightningOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "chain_lightning_spell", sourceCardInstanceId: null,
    effects: [
      { type: "dealDamage", amount: 3, to: { targetRequirementId: "cl_t1" } },
      { type: "custom", resolveFunction: "chain_lightning_copy" },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const chainLightningTargets: TargetRequirement[] = [{
  id: "cl_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// --- Lava Spike: Deal 3 damage to target player or planeswalker ---
export function lavaSpikeOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "lava_spike_spell", sourceCardInstanceId: null,
    effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "ls_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const lavaSpikeTargets: TargetRequirement[] = [{
  id: "ls_t1", description: "target player or planeswalker", count: { exactly: 1 },
  targetTypes: ["player", "planeswalker"], filter: null, controller: "any",
}];

// --- Rift Bolt: Suspend 1 — {R}. Deal 3 damage to any target ---
export function riftBoltOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "rift_bolt_spell", sourceCardInstanceId: null,
    effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "rb_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const riftBoltTargets: TargetRequirement[] = [{
  id: "rb_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// --- Skullcrack: Deal 3 damage to target player. Players can't gain life this turn ---
export function skullcrackOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "skullcrack_spell", sourceCardInstanceId: null,
    effects: [
      { type: "dealDamage", amount: 3, to: { targetRequirementId: "sc_t1" } },
      { type: "custom", resolveFunction: "skullcrack_no_lifegain" },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const skullcrackTargets: TargetRequirement[] = [{
  id: "sc_t1", description: "target player", count: { exactly: 1 },
  targetTypes: ["player"], filter: null, controller: "any",
}];

// --- Searing Blaze: Deal 1 damage to target player and 1 to target creature. Landfall: 3 each instead ---
export function searingBlazeOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "searing_blaze_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "searing_blaze" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const searingBlazeTargets: TargetRequirement[] = [
  { id: "sb_t1", description: "target player", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "opponent" },
  { id: "sb_t2", description: "target creature that player controls", count: { exactly: 1 }, targetTypes: ["creature"], filter: null, controller: "opponent" },
];

// --- Brimstone Volley: Deal 3 damage to any target. Morbid: 5 damage instead ---
export function brimstoneVolleyOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "brimstone_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "brimstone_volley" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const brimstoneVolleyTargets: TargetRequirement[] = [{
  id: "bv_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// --- Stoke the Flames: Convoke. Deal 4 damage to any target ---
export function stokeTheFlamesOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "stoke_spell", sourceCardInstanceId: null,
    effects: [{ type: "dealDamage", amount: 4, to: { targetRequirementId: "stoke_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const stokeTheFlamesTargets: TargetRequirement[] = [{
  id: "stoke_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// --- Exquisite Firecraft: Deal 4 damage to any target. Spell mastery: can't be countered ---
export function exquisiteFirecraftOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "firecraft_spell", sourceCardInstanceId: null,
    effects: [{ type: "dealDamage", amount: 4, to: { targetRequirementId: "ef_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const exquisiteFirecraftTargets: TargetRequirement[] = [{
  id: "ef_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];
