/**
 * Group D — Cards needing new effect types.
 *
 * Token creation (createToken), sacrifice, counters (addCounters/removeCounters),
 * and X spells (NumberOrExpression { variable: "X" }).
 */

import type { SpellAbility, TargetRequirement, TokenDefinition } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Shared token definitions
// ---------------------------------------------------------------------------

const SOLDIER_TOKEN: TokenDefinition = {
  name: "Soldier",
  colors: ["W"],
  cardTypes: ["Creature"],
  subtypes: ["Soldier"],
  power: 1,
  toughness: 1,
  abilities: [],
  keywords: [],
};

const GOBLIN_TOKEN: TokenDefinition = {
  name: "Goblin",
  colors: ["R"],
  cardTypes: ["Creature"],
  subtypes: ["Goblin"],
  power: 1,
  toughness: 1,
  abilities: [],
  keywords: [],
};

const SPIRIT_TOKEN: TokenDefinition = {
  name: "Spirit",
  colors: ["W"],
  cardTypes: ["Creature"],
  subtypes: ["Spirit"],
  power: 1,
  toughness: 1,
  abilities: [],
  keywords: ["Flying"],
};

const ELEMENTAL_TOKEN: TokenDefinition = {
  name: "Elemental",
  colors: ["R"],
  cardTypes: ["Creature"],
  subtypes: ["Elemental"],
  power: 1,
  toughness: 1,
  abilities: [],
  keywords: [],
};

// ---------------------------------------------------------------------------
// Raise the Alarm — {1}{W} instant. Create two 1/1 white Soldier tokens.
// ---------------------------------------------------------------------------

export function raiseTheAlarmOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "raise_alarm_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "createToken",
      token: SOLDIER_TOKEN,
      count: 2,
      controller: { type: "controller" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// ---------------------------------------------------------------------------
// Dragon Fodder — {1}{R} sorcery. Create two 1/1 red Goblin tokens.
// ---------------------------------------------------------------------------

export function dragonFodderOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "dragon_fodder_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "createToken",
      token: GOBLIN_TOKEN,
      count: 2,
      controller: { type: "controller" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// ---------------------------------------------------------------------------
// Lingering Souls — {2}{W} sorcery. Create two 1/1 white Spirit tokens
// with flying. Flashback {1}{B}.
// ---------------------------------------------------------------------------

export function lingeringSoulsOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "lingering_souls_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "createToken",
      token: SPIRIT_TOKEN,
      count: 2,
      controller: { type: "controller" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack, ZoneType.Graveyard],
  }];
}

// ---------------------------------------------------------------------------
// Spectral Procession — {3}{W}{W}{W} sorcery (simplified from {2/W}{2/W}{2/W}).
// Create three 1/1 white Spirit creature tokens with flying.
// ---------------------------------------------------------------------------

export function spectralProcessionOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "spectral_procession_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "createToken",
      token: SPIRIT_TOKEN,
      count: 3,
      controller: { type: "controller" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// ---------------------------------------------------------------------------
// Young Pyromancer — {1}{R} 2/1.
// Whenever you cast an instant or sorcery, create a 1/1 red Elemental token.
// ---------------------------------------------------------------------------

export function youngPyromancerOverride(): SpellAbility[] {
  return [{
    type: "triggered",
    id: "pyro_cast_trigger",
    sourceCardInstanceId: null,
    effects: [{
      type: "createToken",
      token: ELEMENTAL_TOKEN,
      count: 1,
      controller: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: {
      eventType: "spellCast",
      filter: { cardTypes: ["Instant", "Sorcery"] },
      self: false,
      optional: false,
      interveningIf: null,
    },
    targets: [],
  }];
}

// ---------------------------------------------------------------------------
// Sakura-Tribe Elder — {1}{G} 1/1.
// Sacrifice Sakura-Tribe Elder: Add {G} to your mana pool.
// (Mana-producing sacrifice ability.)
// ---------------------------------------------------------------------------

export function sakuraTribeElderOverride(): SpellAbility[] {
  return [{
    type: "mana",
    id: "ste_sacrifice_mana",
    sourceCardInstanceId: null,
    effects: [{
      type: "addMana",
      mana: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      player: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null,
      tapSelf: false,
      untapSelf: false,
      sacrifice: { self: true, description: "Sacrifice Sakura-Tribe Elder" },
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
// Village Rites — {B} instant.
// As an additional cost to cast, sacrifice a creature. Draw two cards.
// ---------------------------------------------------------------------------

export function villageRitesOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "village_rites_spell",
    sourceCardInstanceId: null,
    effects: [
      {
        type: "sacrifice",
        filter: { cardTypes: ["Creature"] },
        player: { type: "controller" },
        count: 1,
      },
      {
        type: "drawCards",
        count: 2,
        player: { type: "controller" },
      },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// ---------------------------------------------------------------------------
// Viscera Seer — {B} 1/1.
// Sacrifice a creature: Scry 1. (Simplified: sacrifice a creature, draw a card.)
// ---------------------------------------------------------------------------

export function visceraSeerOverride(): SpellAbility[] {
  return [{
    type: "activated",
    id: "viscera_seer_sac",
    sourceCardInstanceId: null,
    effects: [{
      type: "drawCards",
      count: 1,
      player: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null,
      tapSelf: false,
      untapSelf: false,
      sacrifice: { cardTypes: ["Creature"], description: "Sacrifice a creature" },
      discard: null,
      payLife: null,
      exileSelf: false,
      exileFromGraveyard: null,
      removeCounters: null,
      additionalCosts: [],
    },
    timing: "instant",
    targets: [],
    activationRestrictions: [],
  }];
}

// ---------------------------------------------------------------------------
// Walking Ballista — {X}{X} 0/0.
// Enters the battlefield with X +1/+1 counters on it.
// Remove a +1/+1 counter from Walking Ballista: It deals 1 damage to any target.
// ---------------------------------------------------------------------------

export function walkingBallistaOverride(): SpellAbility[] {
  return [
    {
      type: "triggered",
      id: "ballista_etb_counters",
      sourceCardInstanceId: null,
      effects: [{
        type: "addCounters",
        counterType: "+1/+1",
        count: { variable: "X" },
        target: { targetRequirementId: "self" },
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
    },
    {
      type: "activated",
      id: "ballista_ping",
      sourceCardInstanceId: null,
      effects: [{
        type: "dealDamage",
        amount: 1,
        to: { targetRequirementId: "ballista_t1" },
      }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: null,
        tapSelf: false,
        untapSelf: false,
        sacrifice: null,
        discard: null,
        payLife: null,
        exileSelf: false,
        exileFromGraveyard: null,
        removeCounters: { counterType: "+1/+1", count: 1 },
        additionalCosts: [],
      },
      timing: "instant",
      targets: [{
        id: "ballista_t1",
        description: "any target",
        count: { exactly: 1 },
        targetTypes: ["creature", "planeswalker", "player"],
        filter: null,
        controller: "any",
      }],
      activationRestrictions: [],
    },
  ];
}

export const walkingBallistaTargets: TargetRequirement[] = [{
  id: "ballista_t1",
  description: "any target",
  count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"],
  filter: null,
  controller: "any",
}];

// ---------------------------------------------------------------------------
// Luminarch Aspirant — {1}{W} 1/1.
// At the beginning of combat on your turn, put a +1/+1 counter on target
// creature you control.
// ---------------------------------------------------------------------------

export function luminarchAspirantOverride(): SpellAbility[] {
  return [{
    type: "triggered",
    id: "luminarch_combat_trigger",
    sourceCardInstanceId: null,
    effects: [{
      type: "addCounters",
      counterType: "+1/+1",
      count: 1,
      target: { targetRequirementId: "luminarch_t1" },
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: {
      eventType: "phaseChanged",
      filter: null,
      self: false,
      optional: false,
      interveningIf: null,
    },
    targets: [{
      id: "luminarch_t1",
      description: "target creature you control",
      count: { exactly: 1 },
      targetTypes: ["creature"],
      filter: null,
      controller: "you",
    }],
  }];
}

export const luminarchAspirantTargets: TargetRequirement[] = [{
  id: "luminarch_t1",
  description: "target creature you control",
  count: { exactly: 1 },
  targetTypes: ["creature"],
  filter: null,
  controller: "you",
}];

// ---------------------------------------------------------------------------
// Champion of the Parish — {W} 1/1.
// Whenever another Human enters the battlefield under your control, put a
// +1/+1 counter on Champion of the Parish.
// ---------------------------------------------------------------------------

export function championOfTheParishOverride(): SpellAbility[] {
  return [{
    type: "triggered",
    id: "champion_human_trigger",
    sourceCardInstanceId: null,
    effects: [{
      type: "addCounters",
      counterType: "+1/+1",
      count: 1,
      target: { targetRequirementId: "self" },
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: {
      eventType: "cardEnteredZone",
      filter: { subtypes: ["Human"] },
      self: false,
      optional: false,
      interveningIf: null,
    },
    targets: [],
  }];
}

// ---------------------------------------------------------------------------
// Fireball — {X}{R} sorcery. Deal X damage to any target.
// ---------------------------------------------------------------------------

export function fireballOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "fireball_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "dealDamage",
      amount: { variable: "X" },
      to: { targetRequirementId: "fireball_t1" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

export const fireballTargets: TargetRequirement[] = [{
  id: "fireball_t1",
  description: "any target",
  count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"],
  filter: null,
  controller: "any",
}];

// ---------------------------------------------------------------------------
// Sphinx's Revelation — {X}{W}{U}{U} instant. Gain X life and draw X cards.
// ---------------------------------------------------------------------------

export function sphinxsRevelationOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "sphinxs_rev_spell",
    sourceCardInstanceId: null,
    effects: [
      {
        type: "gainLife",
        amount: { variable: "X" },
        player: { type: "controller" },
      },
      {
        type: "drawCards",
        count: { variable: "X" },
        player: { type: "controller" },
      },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
