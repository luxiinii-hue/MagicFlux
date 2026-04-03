/**
 * Enchantment and artifact overrides for Phase 3.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Oblivion Ring — {1}{W}{W} Enchantment
// ETB: Exile target nonland permanent an opponent controls.
// LTB: Return the exiled card to the battlefield.
// ---------------------------------------------------------------------------

export function oblivionRingOverride(): SpellAbility[] {
  return [
    {
      type: "triggered",
      id: "oring_etb",
      sourceCardInstanceId: null,
      effects: [{
        type: "exile",
        target: { targetRequirementId: "oring_target" },
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "cardEnteredZone",
        filter: null,
        self: true,
        optional: false,
        interveningIf: null,
      },
      targets: [{
        id: "oring_target",
        description: "target nonland permanent",
        count: { exactly: 1 },
        targetTypes: ["permanent"],
        filter: {
          cardTypes: ["Creature", "Artifact", "Enchantment", "Planeswalker"],
        },
        controller: "any",
      }],
    },
    {
      type: "triggered",
      id: "oring_ltb",
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "oblivion_ring_return",
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "cardLeftZone",
        filter: null,
        self: true,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    },
  ];
}

export const oblivionRingTargets: TargetRequirement[] = [{
  id: "oring_target",
  description: "target nonland permanent",
  count: { exactly: 1 },
  targetTypes: ["permanent"],
  filter: {
    cardTypes: ["Creature", "Artifact", "Enchantment", "Planeswalker"],
  },
  controller: "any",
}];

// ---------------------------------------------------------------------------
// Lightning Greaves — {2} Artifact — Equipment
// Equipped creature has haste and shroud.
// Equip {0}
// ---------------------------------------------------------------------------

export function lightningGreavesOverride(): SpellAbility[] {
  return [
    {
      type: "static",
      id: "greaves_haste",
      sourceCardInstanceId: null,
      effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: {
        effectType: "grantKeyword",
        affectedFilter: { self: false, custom: "equipped_creature" },
        modification: { keywords: ["Haste", "Shroud"] },
      },
      condition: null,
      layer: 6,
    },
    {
      type: "activated",
      id: "greaves_equip",
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "equip_attach",
      }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: { symbols: [{ type: "generic", amount: 0 }], totalCMC: 0 },
        tapSelf: false,
        untapSelf: false,
        sacrifice: null,
        discard: null,
        payLife: null,
        exileSelf: false,
        exileFromGraveyard: null,
        removeCounters: null,
        additionalCosts: [],
      },
      timing: "sorcery",
      targets: [{
        id: "equip_target",
        description: "target creature you control",
        count: { exactly: 1 },
        targetTypes: ["creature"],
        filter: null,
        controller: "you",
      }],
      activationRestrictions: [],
    },
  ];
}

export const lightningGreavesTargets: TargetRequirement[] = [{
  id: "equip_target",
  description: "target creature you control",
  count: { exactly: 1 },
  targetTypes: ["creature"],
  filter: null,
  controller: "you",
}];

// ---------------------------------------------------------------------------
// Pacifism — {1}{W} Enchantment — Aura
// Enchant creature
// Enchanted creature can't attack or block.
// ---------------------------------------------------------------------------

export function pacifismOverride(): SpellAbility[] {
  return [{
    type: "static",
    id: "pacifism_restrict",
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Battlefield],
    continuousEffect: {
      effectType: "restrictCombat",
      affectedFilter: { self: false, custom: "enchanted_creature" },
      modification: { cantAttack: true, cantBlock: true },
    },
    condition: null,
    layer: 6,
  }];
}

export const pacifismTargets: TargetRequirement[] = [{
  id: "pacifism_enchant",
  description: "target creature",
  count: { exactly: 1 },
  targetTypes: ["creature"],
  filter: null,
  controller: "any",
}];

// ---------------------------------------------------------------------------
// Sol Ring — {1} Artifact
// {T}: Add {C}{C}.
// ---------------------------------------------------------------------------

export function solRingOverride(): SpellAbility[] {
  return [{
    type: "mana",
    id: "sol_ring_mana",
    sourceCardInstanceId: null,
    effects: [{
      type: "addMana",
      mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 2 },
      player: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null,
      tapSelf: true,
      untapSelf: false,
      sacrifice: null,
      discard: null,
      payLife: null,
      exileSelf: false,
      exileFromGraveyard: null,
      removeCounters: null,
      additionalCosts: [],
    },
  }];
}

// ---------------------------------------------------------------------------
// Bonesplitter — {1} Artifact — Equipment
// Equipped creature gets +2/+0.
// Equip {1}
// ---------------------------------------------------------------------------

export function bonesplitterOverride(): SpellAbility[] {
  return [
    {
      type: "static",
      id: "bonesplitter_pt",
      sourceCardInstanceId: null,
      effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: {
        effectType: "modifyPT",
        affectedFilter: { self: false, custom: "equipped_creature" },
        modification: { power: 2, toughness: 0 },
      },
      condition: null,
      layer: 7,
    },
    {
      type: "activated",
      id: "bonesplitter_equip",
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "equip_attach",
      }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: { symbols: [{ type: "generic", amount: 1 }], totalCMC: 1 },
        tapSelf: false,
        untapSelf: false,
        sacrifice: null,
        discard: null,
        payLife: null,
        exileSelf: false,
        exileFromGraveyard: null,
        removeCounters: null,
        additionalCosts: [],
      },
      timing: "sorcery",
      targets: [{
        id: "bonesplitter_equip_target",
        description: "target creature you control",
        count: { exactly: 1 },
        targetTypes: ["creature"],
        filter: null,
        controller: "you",
      }],
      activationRestrictions: [],
    },
  ];
}

export const bonesplitterTargets: TargetRequirement[] = [{
  id: "bonesplitter_equip_target",
  description: "target creature you control",
  count: { exactly: 1 },
  targetTypes: ["creature"],
  filter: null,
  controller: "you",
}];
