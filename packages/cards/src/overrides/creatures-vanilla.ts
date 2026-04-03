/**
 * Vanilla and French-vanilla creature overrides.
 *
 * Creatures whose abilities come entirely from keywords (Flying, etc.)
 * don't need overrides — the keyword registry handles them.
 *
 * This file covers creatures with simple non-keyword abilities that the
 * oracle parser can't reliably handle yet, or that need specific tuning.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Llanowar Elves — {G} 1/1, {T}: Add {G}
// The mana ability is parseable from oracle text, but we override for
// reliability since it's a Phase 3 test card.
// ---------------------------------------------------------------------------

export function llanowarElvesOverride(): SpellAbility[] {
  return [{
    type: "mana",
    id: "llanowar_elves_mana",
    sourceCardInstanceId: null,
    effects: [{
      type: "addMana",
      mana: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
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
// Goblin Guide — {R} 2/2, Haste, attack trigger
// ---------------------------------------------------------------------------

export function goblinGuideOverride(): SpellAbility[] {
  return [{
    type: "triggered",
    id: "goblin_guide_attack",
    sourceCardInstanceId: null,
    effects: [{
      type: "custom",
      resolveFunction: "goblin_guide_reveal",
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: {
      eventType: "attackersDeclared",
      filter: null,
      self: true,
      optional: false,
      interveningIf: null,
    },
    targets: [],
  }];
}

// ---------------------------------------------------------------------------
// Elvish Visionary — {1}{G} 1/1, ETB draw a card
// ---------------------------------------------------------------------------

export function elvishVisionaryOverride(): SpellAbility[] {
  return [{
    type: "triggered",
    id: "elvish_visionary_etb",
    sourceCardInstanceId: null,
    effects: [{
      type: "drawCards",
      count: 1,
      player: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: {
      eventType: "cardEnteredZone",
      filter: null,
      self: true,
      optional: false,
      interveningIf: null,
    },
    targets: [],
  }];
}

// ---------------------------------------------------------------------------
// Flametongue Kavu — {3}{R} 4/2, ETB deals 4 damage to target creature
// ---------------------------------------------------------------------------

export function flametongueKavuOverride(): SpellAbility[] {
  return [{
    type: "triggered",
    id: "ftk_etb",
    sourceCardInstanceId: null,
    effects: [{
      type: "dealDamage",
      amount: 4,
      to: { targetRequirementId: "ftk_target" },
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
      id: "ftk_target",
      description: "target creature",
      count: { exactly: 1 },
      targetTypes: ["creature"],
      filter: null,
      controller: "any",
    }],
  }];
}

export const flametongueKavuTargets = [{
  id: "ftk_target",
  description: "target creature",
  count: { exactly: 1 } as const,
  targetTypes: ["creature"] as const,
  filter: null,
  controller: "any" as const,
}];

// ---------------------------------------------------------------------------
// Acidic Slime — {3}{G}{G} 2/2, Deathtouch, ETB destroy target artifact/enchantment/land
// ---------------------------------------------------------------------------

export function acidicSlimeOverride(): SpellAbility[] {
  return [{
    type: "triggered",
    id: "acidic_slime_etb",
    sourceCardInstanceId: null,
    effects: [{
      type: "destroy",
      target: { targetRequirementId: "slime_target" },
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
      id: "slime_target",
      description: "target artifact, enchantment, or land",
      count: { exactly: 1 },
      targetTypes: ["artifact", "enchantment", "land"],
      filter: null,
      controller: "any",
    }],
  }];
}

export const acidicSlimeTargets = [{
  id: "slime_target",
  description: "target artifact, enchantment, or land",
  count: { exactly: 1 } as const,
  targetTypes: ["artifact", "enchantment", "land"] as const,
  filter: null,
  controller: "any" as const,
}];

// ---------------------------------------------------------------------------
// Mulldrifter — {4}{U} 2/2 Flying, ETB draw 2 cards (evoke {2}{U})
// For Phase 3 we just implement the ETB, not evoke.
// ---------------------------------------------------------------------------

export function mulldrifterOverride(): SpellAbility[] {
  return [{
    type: "triggered",
    id: "mulldrifter_etb",
    sourceCardInstanceId: null,
    effects: [{
      type: "drawCards",
      count: 2,
      player: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: {
      eventType: "cardEnteredZone",
      filter: null,
      self: true,
      optional: false,
      interveningIf: null,
    },
    targets: [],
  }];
}

// ---------------------------------------------------------------------------
// Ravenous Chupacabra — {2}{B}{B} 2/2, ETB destroy target creature opponent controls
// ---------------------------------------------------------------------------

export function ravenousChupacabraOverride(): SpellAbility[] {
  return [{
    type: "triggered",
    id: "chupacabra_etb",
    sourceCardInstanceId: null,
    effects: [{
      type: "destroy",
      target: { targetRequirementId: "chupa_target" },
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
      id: "chupa_target",
      description: "target creature an opponent controls",
      count: { exactly: 1 },
      targetTypes: ["creature"],
      filter: null,
      controller: "opponent",
    }],
  }];
}

export const ravenousChupacabraTargets = [{
  id: "chupa_target",
  description: "target creature an opponent controls",
  count: { exactly: 1 } as const,
  targetTypes: ["creature"] as const,
  filter: null,
  controller: "opponent" as const,
}];
