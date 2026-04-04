/**
 * Group B — Control staples.
 *
 * Counterspells, card draw, removal, board wipes, and exile effects.
 * Only cards NOT already registered in index.ts are included here.
 *
 * Already registered elsewhere:
 * - Mana Leak (standard-instants.ts)
 * - Negate (standard-instants.ts)
 * - Thoughtseize (standard-instants.ts)
 * - Opt (standard-instants.ts)
 * - Swords to Plowshares (standard-instants.ts)
 * - Path to Exile (standard-instants.ts)
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// 1. Essence Scatter — {1}{U} instant
//    Counter target creature spell.
// ---------------------------------------------------------------------------

export function essenceScatterOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "essence_scatter_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "counter",
      target: { targetRequirementId: "es_t1" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

export const essenceScatterTargets: TargetRequirement[] = [{
  id: "es_t1",
  description: "target creature spell",
  count: { exactly: 1 },
  targetTypes: ["spell"],
  filter: { cardTypes: ["Creature"] },
  controller: "any",
}];

// ---------------------------------------------------------------------------
// 2. Serum Visions — {U} sorcery
//    Draw a card. (Scry 2 simplified to just draw.)
// ---------------------------------------------------------------------------

export function serumVisionsOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "serum_visions_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "drawCards",
      count: 1,
      player: { type: "controller" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// ---------------------------------------------------------------------------
// 3. Fatal Push — {B} instant
//    Destroy target creature with CMC 2 or less.
//    Simplified: destroy target creature.
// ---------------------------------------------------------------------------

export function fatalPushOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "fatal_push_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "destroy",
      target: { targetRequirementId: "fp_t1" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

export const fatalPushTargets: TargetRequirement[] = [{
  id: "fp_t1",
  description: "target creature",
  count: { exactly: 1 },
  targetTypes: ["creature"],
  filter: null,
  controller: "any",
}];

// ---------------------------------------------------------------------------
// 4. Inquisition of Kozilek — {B} sorcery
//    Target player discards a card.
//    (Full version: target opponent reveals hand, you choose a nonland card
//     with CMC 3 or less. Simplified to discard 1.)
// ---------------------------------------------------------------------------

export function inquisitionOfKozilekOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "inquisition_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "discardCards",
      count: 1,
      player: {
        type: "targetPlayer",
        targetRef: { targetRequirementId: "iok_t1" },
      },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

export const inquisitionOfKozilekTargets: TargetRequirement[] = [{
  id: "iok_t1",
  description: "target player",
  count: { exactly: 1 },
  targetTypes: ["player"],
  filter: null,
  controller: "any",
}];

// ---------------------------------------------------------------------------
// 5. Hero's Downfall — {1}{B}{B} instant
//    Destroy target creature or planeswalker.
// ---------------------------------------------------------------------------

export function herosDownfallOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "heros_downfall_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "destroy",
      target: { targetRequirementId: "hd_t1" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

export const herosDownfallTargets: TargetRequirement[] = [{
  id: "hd_t1",
  description: "target creature or planeswalker",
  count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker"],
  filter: null,
  controller: "any",
}];

// ---------------------------------------------------------------------------
// 6. Wrath of God — {2}{W}{W} sorcery
//    Destroy all creatures. They can't be regenerated.
//    Board wipe uses custom resolve since forEach isn't fully wired.
// ---------------------------------------------------------------------------

export function wrathOfGodOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "wrath_of_god_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "custom",
      resolveFunction: "destroy_all_creatures",
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// ---------------------------------------------------------------------------
// 7. Day of Judgment — {2}{W}{W} sorcery
//    Destroy all creatures.
//    Functionally identical to Wrath of God (no regeneration clause matters
//    since regeneration isn't implemented yet).
// ---------------------------------------------------------------------------

export function dayOfJudgmentOverride(): SpellAbility[] {
  return [{
    type: "spell",
    id: "day_of_judgment_spell",
    sourceCardInstanceId: null,
    effects: [{
      type: "custom",
      resolveFunction: "destroy_all_creatures",
    }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
