/**
 * Group A — Aggro staples.
 *
 * Each creature override produces:
 * - A "spell" ability for casting
 * - Static abilities for each keyword
 * - Triggered/activated/static abilities for special text
 */

import type {
  SpellAbility,
  SpellAbilityStatic,
  SpellAbilityTriggered,
  SpellAbilityActivated,
  SpellAbilityMana,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Helpers (same pattern as creatures-keyword.ts / creatures-phase3.ts)
// ---------------------------------------------------------------------------

function spellAbility(cardName: string): SpellAbility {
  const slug = cardName.toLowerCase().replace(/[',\s-]+/g, "_");
  return {
    type: "spell",
    id: `${slug}_spell`,
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Hand, ZoneType.Stack],
  };
}

function keywordStatic(cardName: string, keyword: string): SpellAbilityStatic {
  const slug = cardName.toLowerCase().replace(/[',\s-]+/g, "_");
  const kwSlug = keyword.toLowerCase().replace(/\s+/g, "_");
  return {
    type: "static",
    id: `${slug}_${kwSlug}`,
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Battlefield],
    continuousEffect: {
      effectType: keyword.toLowerCase(),
      affectedFilter: {},
      modification: {},
    },
    condition: null,
    layer: 6,
  };
}

// ---------------------------------------------------------------------------
// 1. Eidolon of the Great Revel — {R}{R} 2/2
//    Whenever a player casts a spell with CMC 3 or less, deal 2 damage
//    to that player.
// ---------------------------------------------------------------------------

export function eidolonOfTheGreatRevelOverride(): SpellAbility[] {
  const slug = "eidolon_of_the_great_revel";
  return [
    spellAbility("Eidolon of the Great Revel"),
    {
      type: "triggered",
      id: `${slug}_trigger`,
      sourceCardInstanceId: null,
      effects: [{
        type: "dealDamage",
        amount: 2,
        to: { targetRequirementId: `${slug}_caster` },
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "spellCast",
        filter: { cmc: { op: "lte", value: 3 } },
        self: false,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    } as SpellAbilityTriggered,
  ];
}

// ---------------------------------------------------------------------------
// 2. Earthshaker Khenra — {1}{R} 2/1 Haste
//    ETB: target creature with power <= Khenra's power can't block this turn.
//    Simplified: ETB uses custom resolve (power comparison needs runtime).
// ---------------------------------------------------------------------------

export function earthshakerKhenraOverride(): SpellAbility[] {
  const slug = "earthshaker_khenra";
  return [
    spellAbility("Earthshaker Khenra"),
    keywordStatic("Earthshaker Khenra", "haste"),
    {
      type: "triggered",
      id: `${slug}_etb`,
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "earthshaker_khenra_cant_block",
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
        id: `${slug}_target`,
        description: "target creature with power less than or equal to Earthshaker Khenra's power",
        count: { exactly: 1 },
        targetTypes: ["creature"],
        filter: null,
        controller: "opponent",
      }],
    } as SpellAbilityTriggered,
  ];
}

export const earthshakerKhenraTargets = [{
  id: "earthshaker_khenra_target",
  description: "target creature with power less than or equal to Earthshaker Khenra's power",
  count: { exactly: 1 } as const,
  targetTypes: ["creature"] as const,
  filter: null,
  controller: "opponent" as const,
}];

// ---------------------------------------------------------------------------
// 3. Thalia, Guardian of Thraben — {1}{W} 2/1 First strike
//    Static: noncreature spells cost {1} more.
// ---------------------------------------------------------------------------

export function thaliaOverride(): SpellAbility[] {
  return [
    spellAbility("Thalia, Guardian of Thraben"),
    keywordStatic("Thalia, Guardian of Thraben", "first strike"),
    {
      type: "static",
      id: "thalia__guardian_of_thraben_tax",
      sourceCardInstanceId: null,
      effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: {
        effectType: "costIncrease",
        affectedFilter: {
          cardTypes: ["Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker"],
        },
        modification: { genericIncrease: 1 },
      },
      condition: null,
      layer: 6,
    } as SpellAbilityStatic,
  ];
}

// ---------------------------------------------------------------------------
// 4. Adanto Vanguard — {1}{W} 1/1
//    Pay 4 life: gains indestructible until end of turn.
// ---------------------------------------------------------------------------

export function adantoVanguardOverride(): SpellAbility[] {
  const slug = "adanto_vanguard";
  return [
    spellAbility("Adanto Vanguard"),
    {
      type: "activated",
      id: `${slug}_indestructible`,
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "adanto_vanguard_indestructible",
      }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: null,
        tapSelf: false,
        untapSelf: false,
        sacrifice: null,
        discard: null,
        payLife: 4,
        exileSelf: false,
        exileFromGraveyard: null,
        removeCounters: null,
        additionalCosts: [],
      },
      timing: "instant",
      targets: [],
      activationRestrictions: [],
    } as SpellAbilityActivated,
  ];
}

// ---------------------------------------------------------------------------
// 5. Benalish Marshal — {W}{W}{W} 3/3
//    Static: other creatures you control get +1/+1 (anthem).
// ---------------------------------------------------------------------------

export function benalishMarshalOverride(): SpellAbility[] {
  return [
    spellAbility("Benalish Marshal"),
    {
      type: "static",
      id: "benalish_marshal_anthem",
      sourceCardInstanceId: null,
      effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: {
        effectType: "modifyPT",
        affectedFilter: {
          cardTypes: ["Creature"],
          controller: "you",
          self: false,
        },
        modification: { power: 1, toughness: 1 },
      },
      condition: null,
      layer: 7,
    } as SpellAbilityStatic,
  ];
}

// ---------------------------------------------------------------------------
// 6. Experiment One — {G} 1/1
//    Evolve: when a creature with greater power or toughness ETBs under
//    your control, put a +1/+1 counter on Experiment One.
//    Uses custom resolve for the power/toughness comparison.
// ---------------------------------------------------------------------------

export function experimentOneOverride(): SpellAbility[] {
  const slug = "experiment_one";
  return [
    spellAbility("Experiment One"),
    {
      type: "triggered",
      id: `${slug}_evolve`,
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "evolve",
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "cardEnteredZone",
        filter: {
          cardTypes: ["Creature"],
        },
        self: false,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    } as SpellAbilityTriggered,
  ];
}

// ---------------------------------------------------------------------------
// 7. Pelt Collector — {G} 1/1
//    When another creature with greater power ETBs under your control,
//    put a +1/+1 counter on Pelt Collector.
//    Uses custom resolve for the power comparison.
// ---------------------------------------------------------------------------

export function peltCollectorOverride(): SpellAbility[] {
  const slug = "pelt_collector";
  return [
    spellAbility("Pelt Collector"),
    {
      type: "triggered",
      id: `${slug}_counter`,
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "pelt_collector_counter",
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "cardEnteredZone",
        filter: {
          cardTypes: ["Creature"],
        },
        self: false,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    } as SpellAbilityTriggered,
  ];
}

// ---------------------------------------------------------------------------
// 8. Steel Leaf Champion — {G}{G}{G} 5/4
//    Can't be blocked by creatures with power 2 or less.
//    Modeled as a static evasion ability.
// ---------------------------------------------------------------------------

export function steelLeafChampionOverride(): SpellAbility[] {
  return [
    spellAbility("Steel Leaf Champion"),
    {
      type: "static",
      id: "steel_leaf_champion_evasion",
      sourceCardInstanceId: null,
      effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: {
        effectType: "cantBeBlockedBy",
        affectedFilter: {},
        modification: {
          blockerFilter: { power: { op: "lte", value: 2 } },
        },
      },
      condition: null,
      layer: 6,
    } as SpellAbilityStatic,
  ];
}

// ---------------------------------------------------------------------------
// 9. Burning-Tree Emissary — {R}{G} 2/2
//    ETB: add {R}{G}.
// ---------------------------------------------------------------------------

export function burningTreeEmissaryOverride(): SpellAbility[] {
  const slug = "burning_tree_emissary";
  return [
    spellAbility("Burning-Tree Emissary"),
    {
      type: "triggered",
      id: `${slug}_etb`,
      sourceCardInstanceId: null,
      effects: [{
        type: "addMana",
        mana: { W: 0, U: 0, B: 0, R: 1, G: 1, C: 0 },
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
    } as SpellAbilityTriggered,
  ];
}

// ---------------------------------------------------------------------------
// 10. Gruul Spellbreaker — {1}{R}{G} 3/3 Haste
// ---------------------------------------------------------------------------

export function gruulSpellbreakerOverride(): SpellAbility[] {
  return [
    spellAbility("Gruul Spellbreaker"),
    keywordStatic("Gruul Spellbreaker", "haste"),
  ];
}
