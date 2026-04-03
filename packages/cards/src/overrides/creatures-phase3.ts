/**
 * Phase 3 creature overrides — 20+ additional creatures across all five colors
 * plus multicolor.
 *
 * Each override produces:
 * - A "spell" ability for casting
 * - Static abilities for each keyword
 * - Triggered/activated abilities where applicable
 * - Mana abilities where applicable
 */

import type {
  SpellAbility,
  SpellAbilityStatic,
  SpellAbilityMana,
  SpellAbilityTriggered,
  TargetRequirement,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Helpers (same pattern as creatures-keyword.ts)
// ---------------------------------------------------------------------------

function spellAbility(cardName: string): SpellAbility {
  const slug = cardName.toLowerCase().replace(/['\s-]+/g, "_");
  return {
    type: "spell",
    id: `${slug}_spell`,
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Hand, ZoneType.Stack],
  };
}

function flashSpellAbility(cardName: string): SpellAbility {
  const slug = cardName.toLowerCase().replace(/['\s-]+/g, "_");
  return {
    type: "spell",
    id: `${slug}_spell`,
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Hand, ZoneType.Stack],
  };
}

function keywordStatic(cardName: string, keyword: string): SpellAbilityStatic {
  const slug = cardName.toLowerCase().replace(/['\s-]+/g, "_");
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

function etbDrawCards(cardName: string, count: number): SpellAbilityTriggered {
  const slug = cardName.toLowerCase().replace(/['\s-]+/g, "_");
  return {
    type: "triggered",
    id: `${slug}_etb`,
    sourceCardInstanceId: null,
    effects: [{
      type: "drawCards",
      count,
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
  };
}

function etbBounceCreature(cardName: string): SpellAbilityTriggered {
  const slug = cardName.toLowerCase().replace(/['\s-]+/g, "_");
  return {
    type: "triggered",
    id: `${slug}_etb`,
    sourceCardInstanceId: null,
    effects: [{
      type: "bounce",
      target: { targetRequirementId: `${slug}_target` },
      to: ZoneType.Hand,
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
      description: "target creature",
      count: { exactly: 1 },
      targetTypes: ["creature"],
      filter: null,
      controller: "any",
    }],
  };
}

function tapCost(): {
  readonly manaCost: null;
  readonly tapSelf: true;
  readonly untapSelf: false;
  readonly sacrifice: null;
  readonly discard: null;
  readonly payLife: null;
  readonly exileSelf: false;
  readonly exileFromGraveyard: null;
  readonly removeCounters: null;
  readonly additionalCosts: readonly [];
} {
  return {
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
  };
}

// =========================================================================
// WHITE CREATURES
// =========================================================================

// ---------------------------------------------------------------------------
// Wall of Omens — {1}{W} 0/4, Defender, ETB: draw a card
// ---------------------------------------------------------------------------

export function wallOfOmensOverride(): SpellAbility[] {
  return [
    spellAbility("Wall of Omens"),
    keywordStatic("Wall of Omens", "defender"),
    etbDrawCards("Wall of Omens", 1),
  ];
}

// ---------------------------------------------------------------------------
// Mother of Runes — {W} 1/1, {T}: Target creature you control gains
// protection from the color of your choice until end of turn.
// ---------------------------------------------------------------------------

export function motherOfRunesOverride(): SpellAbility[] {
  const slug = "mother_of_runes";
  return [
    spellAbility("Mother of Runes"),
    {
      type: "activated",
      id: `${slug}_protect`,
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "mother_of_runes_protection",
      }],
      zones: [ZoneType.Battlefield],
      cost: tapCost(),
      timing: "instant",
      targets: [{
        id: `${slug}_target`,
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

export const motherOfRunesTargets: TargetRequirement[] = [{
  id: "mother_of_runes_target",
  description: "target creature you control",
  count: { exactly: 1 },
  targetTypes: ["creature"],
  filter: null,
  controller: "you",
}];

// ---------------------------------------------------------------------------
// Baneslayer Angel — {3}{W}{W} 5/5, Flying, First Strike, Lifelink
// Also has protection from Demons and Dragons, but we skip those subtypes
// for simplicity in Phase 3.
// ---------------------------------------------------------------------------

export function baneslayerAngelOverride(): SpellAbility[] {
  return [
    spellAbility("Baneslayer Angel"),
    keywordStatic("Baneslayer Angel", "flying"),
    keywordStatic("Baneslayer Angel", "first strike"),
    keywordStatic("Baneslayer Angel", "lifelink"),
  ];
}

// =========================================================================
// BLUE CREATURES
// =========================================================================

// ---------------------------------------------------------------------------
// Snapcaster Mage — {1}{U} 2/1, Flash, ETB: target instant or sorcery in
// your graveyard gains flashback until end of turn.
// The flashback mechanic is complex; we use a custom resolve function.
// ---------------------------------------------------------------------------

export function snapcasterMageOverride(): SpellAbility[] {
  const slug = "snapcaster_mage";
  return [
    flashSpellAbility("Snapcaster Mage"),
    keywordStatic("Snapcaster Mage", "flash"),
    {
      type: "triggered",
      id: `${slug}_etb`,
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "snapcaster_mage_flashback",
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
        description: "target instant or sorcery card in your graveyard",
        count: { exactly: 1 },
        targetTypes: ["card-in-graveyard"],
        filter: {
          cardTypes: ["Instant", "Sorcery"],
        },
        controller: "you",
      }],
    },
  ];
}

export const snapcasterMageTargets: TargetRequirement[] = [{
  id: "snapcaster_mage_target",
  description: "target instant or sorcery card in your graveyard",
  count: { exactly: 1 },
  targetTypes: ["card-in-graveyard"],
  filter: {
    cardTypes: ["Instant", "Sorcery"],
  },
  controller: "you",
}];

// ---------------------------------------------------------------------------
// Delver of Secrets — {U} 1/1. Simple version (no transform).
// ---------------------------------------------------------------------------

export function delverOfSecretsOverride(): SpellAbility[] {
  return [
    spellAbility("Delver of Secrets"),
  ];
}

// ---------------------------------------------------------------------------
// Man-o'-War — {2}{U} 2/2, ETB: return target creature to its owner's hand
// ---------------------------------------------------------------------------

export function manOWarOverride(): SpellAbility[] {
  return [
    spellAbility("Man-o'-War"),
    etbBounceCreature("Man-o'-War"),
  ];
}

export const manOWarTargets: TargetRequirement[] = [{
  id: "man_o__war_target",
  description: "target creature",
  count: { exactly: 1 },
  targetTypes: ["creature"],
  filter: null,
  controller: "any",
}];

// =========================================================================
// BLACK CREATURES
// =========================================================================

// ---------------------------------------------------------------------------
// Nether Spirit — {1}{B}{B} 2/2. No abilities in simplified version.
// (Full version has graveyard recursion — too complex for Phase 3.)
// ---------------------------------------------------------------------------

export function netherSpiritOverride(): SpellAbility[] {
  return [
    spellAbility("Nether Spirit"),
  ];
}

// ---------------------------------------------------------------------------
// Dark Confidant — {1}{B} 2/1.
// At the beginning of your upkeep, reveal the top card of your library
// and put it into your hand. You lose life equal to its CMC.
// Complex trigger — use custom resolve function.
// ---------------------------------------------------------------------------

export function darkConfidantOverride(): SpellAbility[] {
  const slug = "dark_confidant";
  return [
    spellAbility("Dark Confidant"),
    {
      type: "triggered",
      id: `${slug}_upkeep`,
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "dark_confidant_reveal",
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "stepBegin",
        filter: {
          custom: "upkeep_step",
        },
        self: false,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Dread Shade — {B}{B}{B} 3/3. {B}: +1/+1 until end of turn.
// ---------------------------------------------------------------------------

export function dreadShadeOverride(): SpellAbility[] {
  const slug = "dread_shade";
  return [
    spellAbility("Dread Shade"),
    {
      type: "activated",
      id: `${slug}_pump`,
      sourceCardInstanceId: null,
      effects: [{
        type: "modifyPT",
        power: 1,
        toughness: 1,
        target: { targetRequirementId: "self" },
        duration: "endOfTurn",
      }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: { symbols: [{ type: "colored", color: "B" }], totalCMC: 1 },
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
      timing: "instant",
      targets: [],
      activationRestrictions: [],
    },
  ];
}

// =========================================================================
// RED CREATURES
// =========================================================================

// ---------------------------------------------------------------------------
// Lightning Mauler — {1}{R} 2/1, Haste.
// (Full card has soulbond — skipped for Phase 3.)
// ---------------------------------------------------------------------------

export function lightningMaulerOverride(): SpellAbility[] {
  return [
    spellAbility("Lightning Mauler"),
    keywordStatic("Lightning Mauler", "haste"),
  ];
}

// ---------------------------------------------------------------------------
// Ball Lightning — {R}{R}{R} 6/1, Trample, Haste.
// "At the beginning of the end step, sacrifice Ball Lightning."
// ---------------------------------------------------------------------------

export function ballLightningOverride(): SpellAbility[] {
  const slug = "ball_lightning";
  return [
    spellAbility("Ball Lightning"),
    keywordStatic("Ball Lightning", "trample"),
    keywordStatic("Ball Lightning", "haste"),
    {
      type: "triggered",
      id: `${slug}_sacrifice`,
      sourceCardInstanceId: null,
      effects: [{
        type: "sacrifice",
        filter: { self: true },
        player: { type: "controller" },
        count: 1,
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "stepBegin",
        filter: {
          custom: "end_step",
        },
        self: false,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Ember Hauler — {R}{R} 2/2.
// {1}, Sacrifice Ember Hauler: It deals 2 damage to any target.
// ---------------------------------------------------------------------------

export function emberHaulerOverride(): SpellAbility[] {
  const slug = "ember_hauler";
  return [
    spellAbility("Ember Hauler"),
    {
      type: "activated",
      id: `${slug}_fling`,
      sourceCardInstanceId: null,
      effects: [{
        type: "dealDamage",
        amount: 2,
        to: { targetRequirementId: `${slug}_target` },
      }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: { symbols: [{ type: "generic", amount: 1 }], totalCMC: 1 },
        tapSelf: false,
        untapSelf: false,
        sacrifice: { self: true, description: "Sacrifice Ember Hauler" },
        discard: null,
        payLife: null,
        exileSelf: false,
        exileFromGraveyard: null,
        removeCounters: null,
        additionalCosts: [],
      },
      timing: "instant",
      targets: [{
        id: `${slug}_target`,
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

export const emberHaulerTargets: TargetRequirement[] = [{
  id: "ember_hauler_target",
  description: "any target",
  count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"],
  filter: null,
  controller: "any",
}];

// =========================================================================
// GREEN CREATURES
// =========================================================================

// ---------------------------------------------------------------------------
// Tarmogoyf — {1}{G} */*+1. Simplified to 4/5 for Phase 3.
// ---------------------------------------------------------------------------

export function tarmogoyfOverride(): SpellAbility[] {
  return [
    spellAbility("Tarmogoyf"),
  ];
}

// ---------------------------------------------------------------------------
// Sylvan Caryatid — {1}{G} 0/3, Defender, Hexproof.
// {T}: Add one mana of any color.
// For Phase 3 we add {C} (any-color mana representation).
// ---------------------------------------------------------------------------

export function sylvanCaryatidOverride(): SpellAbility[] {
  const slug = "sylvan_caryatid";
  return [
    spellAbility("Sylvan Caryatid"),
    keywordStatic("Sylvan Caryatid", "defender"),
    keywordStatic("Sylvan Caryatid", "hexproof"),
    {
      type: "mana",
      id: `${slug}_mana`,
      sourceCardInstanceId: null,
      effects: [{
        type: "addMana",
        mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 },
        player: { type: "controller" },
      }],
      zones: [ZoneType.Battlefield],
      cost: tapCost(),
    } as SpellAbilityMana,
  ];
}

// ---------------------------------------------------------------------------
// Leatherback Baloth — {G}{G}{G} 4/5. Vanilla.
// ---------------------------------------------------------------------------

export function leatherbackBalothOverride(): SpellAbility[] {
  return [
    spellAbility("Leatherback Baloth"),
  ];
}

// ---------------------------------------------------------------------------
// Kalonian Tusker — {G}{G} 3/3. Vanilla.
// ---------------------------------------------------------------------------

export function kalonianTuskerOverride(): SpellAbility[] {
  return [
    spellAbility("Kalonian Tusker"),
  ];
}

// ---------------------------------------------------------------------------
// Courser of Kruphix — {1}{G}{G} 2/4.
// Play with top card of library revealed. You may play lands from the
// top of your library. Gain 1 life whenever a land enters under your control.
// Complex — use custom for the static reveal, simplify to the life trigger.
// ---------------------------------------------------------------------------

export function courserOfKruphixOverride(): SpellAbility[] {
  const slug = "courser_of_kruphix";
  return [
    spellAbility("Courser of Kruphix"),
    {
      type: "triggered",
      id: `${slug}_life`,
      sourceCardInstanceId: null,
      effects: [{
        type: "gainLife",
        amount: 1,
        player: { type: "controller" },
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "cardEnteredZone",
        filter: {
          cardTypes: ["Land"],
        },
        self: false,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    },
  ];
}

// =========================================================================
// MULTICOLOR CREATURES
// =========================================================================

// ---------------------------------------------------------------------------
// Geist of Saint Traft — {1}{W}{U} 2/2, Hexproof.
// Whenever Geist attacks, create a 4/4 Angel token with flying that is
// tapped and attacking. Exile it at end of combat.
// Complex — use custom resolve.
// ---------------------------------------------------------------------------

export function geistOfSaintTraftOverride(): SpellAbility[] {
  const slug = "geist_of_saint_traft";
  return [
    spellAbility("Geist of Saint Traft"),
    keywordStatic("Geist of Saint Traft", "hexproof"),
    {
      type: "triggered",
      id: `${slug}_attack`,
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "geist_of_saint_traft_angel",
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
    },
  ];
}

// ---------------------------------------------------------------------------
// Kitchen Finks — {1}{W}{G} 3/2, Lifelink (technically it's "When Kitchen
// Finks enters the battlefield, you gain 2 life" + Persist, but we simplify
// to lifelink + ETB life gain for Phase 3).
// ---------------------------------------------------------------------------

export function kitchenFinksOverride(): SpellAbility[] {
  return [
    spellAbility("Kitchen Finks"),
    {
      type: "triggered",
      id: "kitchen_finks_etb",
      sourceCardInstanceId: null,
      effects: [{
        type: "gainLife",
        amount: 2,
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
    },
  ];
}

// ---------------------------------------------------------------------------
// Bloodbraid Elf — {2}{R}{G} 3/2, Haste.
// Cascade (complex mechanic) — simplified to custom resolve for Phase 3.
// ---------------------------------------------------------------------------

export function bloodbraidElfOverride(): SpellAbility[] {
  const slug = "bloodbraid_elf";
  return [
    spellAbility("Bloodbraid Elf"),
    keywordStatic("Bloodbraid Elf", "haste"),
    {
      type: "triggered",
      id: `${slug}_cascade`,
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "cascade",
      }],
      zones: [ZoneType.Stack],
      triggerCondition: {
        eventType: "spellCast",
        filter: null,
        self: true,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    },
  ];
}
