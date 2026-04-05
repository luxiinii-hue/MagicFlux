/**
 * Group C — Midrange/utility staples.
 *
 * Siege Rhino, Assassin's Trophy, Mind Stone, Rampant Growth, Cultivate.
 *
 * Abrupt Decay and Maelstrom Pulse are already in standard-instants.ts.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Siege Rhino — {1}{W}{B}{G} 4/5, Trample
// ETB: each opponent loses 3 life and you gain 3 life.
// ---------------------------------------------------------------------------

export function siegeRhinoOverride(): SpellAbility[] {
  return [
    {
      type: "triggered",
      id: "siege_rhino_etb",
      sourceCardInstanceId: null,
      effects: [
        { type: "custom", resolveFunction: "each_opponent_lose_life_3" },
        { type: "gainLife", amount: 3, player: { type: "controller" } },
      ],
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
      type: "static",
      id: "siege_rhino_trample",
      sourceCardInstanceId: null,
      effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: {
        effectType: "trample",
        affectedFilter: {},
        modification: {},
      },
      condition: null,
      layer: 6,
    },
  ];
}

// ---------------------------------------------------------------------------
// Assassin's Trophy — {B}{G} instant. Destroy target permanent.
// (The real card lets the opponent search for a basic land, simplified.)
// ---------------------------------------------------------------------------

export function assassinsTrophyOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "at_spell",
    sourceCardInstanceId: null,
    effects: [{ type: "destroy", target: { targetRequirementId: "at_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

export const assassinsTrophyTargets: TargetRequirement[] = [{
  id: "at_t1",
  description: "target permanent",
  count: { exactly: 1 },
  targetTypes: ["permanent"],
  filter: null,
  controller: "any",
}];

// ---------------------------------------------------------------------------
// Mind Stone — {2} artifact.
// {T}: Add {C}.
// {1}, {T}, Sacrifice Mind Stone: Draw a card.
// ---------------------------------------------------------------------------

export function mindStoneOverride(): SpellAbility[] {
  return [
    {
      type: "mana",
      id: "mind_stone_mana",
      sourceCardInstanceId: null,
      effects: [{
        type: "addMana",
        mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 },
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
    },
    {
      type: "activated",
      id: "mind_stone_draw",
      sourceCardInstanceId: null,
      effects: [{
        type: "drawCards",
        count: 1,
        player: { type: "controller" },
      }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: { symbols: [{ type: "generic", amount: 1 }], totalCMC: 1 },
        tapSelf: true,
        untapSelf: false,
        sacrifice: { self: true, description: "Sacrifice Mind Stone" },
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
    },
  ];
}

// ---------------------------------------------------------------------------
// Rampant Growth — {1}{G} sorcery.
// Search your library for a basic land and put it onto the battlefield tapped.
// Simplified: add {G} to mana pool.
// ---------------------------------------------------------------------------

export function rampantGrowthOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "rampant_growth_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "addMana",
      mana: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      player: { type: "controller" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// ---------------------------------------------------------------------------
// Cultivate — {2}{G} sorcery.
// Search for a basic land onto battlefield tapped + one to hand.
// Simplified: add {G}{G} to mana pool.
// ---------------------------------------------------------------------------

export function cultivateOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "cultivate_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "addMana",
      mana: { W: 0, U: 0, B: 0, R: 0, G: 2, C: 0 },
      player: { type: "controller" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
