/**
 * Override sprint Group B — Control staples.
 *
 * Card draw, removal, counterspells, board wipes, planeswalkers, discard.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// --- Wrath of God: Destroy all creatures. They can't be regenerated ---
export function wrathOfGodOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "wog_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "destroy_all_creatures" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Day of Judgment: Destroy all creatures ---
export function dayOfJudgmentOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "doj_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "destroy_all_creatures" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Supreme Verdict: Destroy all creatures. Can't be countered ---
export function supremeVerdictOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "sv_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "destroy_all_creatures" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Damnation: Destroy all creatures. They can't be regenerated ---
export function damnationOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "damnation_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "destroy_all_creatures" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Cryptic Command: Choose two — counter, bounce, draw, tap all ---
export function crypticCommandOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "cc_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "cryptic_command_modal" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Force of Will: Counter target spell. Alt cost: pay 1 life + exile blue card from hand ---
export function forceOfWillOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "fow_spell", sourceCardInstanceId: null,
    effects: [{ type: "counter", target: { targetRequirementId: "fow_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const forceOfWillTargets: TargetRequirement[] = [{
  id: "fow_t1", description: "target spell", count: { exactly: 1 },
  targetTypes: ["spell"], filter: null, controller: "any",
}];

// --- Remand: Counter target spell, return it to owner's hand. Draw a card ---
export function remandOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "remand_spell", sourceCardInstanceId: null,
    effects: [
      { type: "custom", resolveFunction: "remand_bounce_spell" },
      { type: "drawCards", count: 1, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const remandTargets: TargetRequirement[] = [{
  id: "remand_t1", description: "target spell", count: { exactly: 1 },
  targetTypes: ["spell"], filter: null, controller: "any",
}];

// --- Snapcaster Mage already implemented in creatures-phase3.ts ---

// --- Jace, the Mind Sculptor: 4 loyalty abilities ---
export function jaceTMSOverride(): SpellAbility[] {
  return [
    { type: "activated", id: "jace_plus2", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "jace_fateseal" }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: -2 }, additionalCosts: [] },
      timing: "sorcery", targets: [], activationRestrictions: ["Activate only as a sorcery"] },
    { type: "activated", id: "jace_zero", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "jace_brainstorm" }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
      timing: "sorcery", targets: [], activationRestrictions: ["Activate only as a sorcery"] },
    { type: "activated", id: "jace_minus1", sourceCardInstanceId: null,
      effects: [{ type: "bounce", target: { targetRequirementId: "jace_bounce_t1" }, to: ZoneType.Library }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: 1 }, additionalCosts: [] },
      timing: "sorcery", targets: [{ id: "jace_bounce_t1", description: "target creature", count: { exactly: 1 }, targetTypes: ["creature"], filter: null, controller: "any" }], activationRestrictions: ["Activate only as a sorcery"] },
    { type: "activated", id: "jace_minus12", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "jace_ultimate" }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: 12 }, additionalCosts: [] },
      timing: "sorcery", targets: [{ id: "jace_ult_t1", description: "target player", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "opponent" }], activationRestrictions: ["Activate only as a sorcery"] },
  ];
}

// --- Liliana of the Veil: +1 each player discards, -2 sacrifice creature, -6 split permanents ---
export function lilianaOfTheVeilOverride(): SpellAbility[] {
  return [
    { type: "activated", id: "liliana_plus1", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "liliana_each_discard" }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: -1 }, additionalCosts: [] },
      timing: "sorcery", targets: [], activationRestrictions: ["Activate only as a sorcery"] },
    { type: "activated", id: "liliana_minus2", sourceCardInstanceId: null,
      effects: [{ type: "sacrifice", filter: { cardTypes: ["Creature"] }, player: { type: "targetPlayer", targetRef: { targetRequirementId: "lil_sac_t1" } }, count: 1 }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: 2 }, additionalCosts: [] },
      timing: "sorcery", targets: [{ id: "lil_sac_t1", description: "target player", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "opponent" }], activationRestrictions: ["Activate only as a sorcery"] },
    { type: "activated", id: "liliana_minus6", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "liliana_ultimate" }],
      zones: [ZoneType.Battlefield],
      cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: 6 }, additionalCosts: [] },
      timing: "sorcery", targets: [{ id: "lil_ult_t1", description: "target player", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "opponent" }], activationRestrictions: ["Activate only as a sorcery"] },
  ];
}

// --- Fact or Fiction: Reveal top 5, opponent splits into 2 piles, you choose one ---
export function factOrFictionOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "fof_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "fact_or_fiction" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Dig Through Time: Delve. Look at top 7, put 2 in hand ---
export function digThroughTimeOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "dtt_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "dig_through_time" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Treasure Cruise: Delve. Draw 3 cards ---
export function treasureCruiseOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "tc_spell", sourceCardInstanceId: null,
    effects: [{ type: "drawCards", count: 3, player: { type: "controller" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Lingering Souls: Create two 1/1 white Spirit tokens with flying. Flashback {1}{B} ---
export function lingeringSoulsOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "ls_spell", sourceCardInstanceId: null,
    effects: [{
      type: "createToken",
      token: { name: "Spirit", colors: ["W"], cardTypes: ["Creature"], subtypes: ["Spirit"], power: 1, toughness: 1, abilities: [], keywords: ["Flying"] },
      count: 2, controller: { type: "controller" },
    }],
    zones: [ZoneType.Hand, ZoneType.Stack, ZoneType.Graveyard],
  }];
}

// --- Inquisition of Kozilek: Target player reveals hand, choose a nonland with CMC ≤3 ---
export function inquisitionOfKozilekOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "iok_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "inquisition_discard" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const inquisitionOfKozilekTargets: TargetRequirement[] = [{
  id: "iok_t1", description: "target player", count: { exactly: 1 },
  targetTypes: ["player"], filter: null, controller: "any",
}];

// --- Collective Brutality: Choose one or more (escalate—discard). Drain 2, -2/-2, duress ---
export function collectiveBrutalityOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "cb_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "collective_brutality_modal" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Fatal Push: Destroy target creature with CMC ≤2. Revolt: CMC ≤4 instead ---
export function fatalPushOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "fp_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "fatal_push" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const fatalPushTargets: TargetRequirement[] = [{
  id: "fp_t1", description: "target creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];

// --- Hero's Downfall: Destroy target creature or planeswalker ---
export function herosDownfallOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "hd_spell", sourceCardInstanceId: null,
    effects: [{ type: "destroy", target: { targetRequirementId: "hd_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const herosDownfallTargets: TargetRequirement[] = [{
  id: "hd_t1", description: "target creature or planeswalker", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker"], filter: null, controller: "any",
}];

// --- Detention Sphere: ETB exile target nonland permanent and all others with same name ---
export function detentionSphereOverride(): SpellAbility[] {
  return [
    { type: "triggered", id: "dsphere_etb", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "detention_sphere_exile" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [{ id: "dsphere_t1", description: "target nonland permanent", count: { exactly: 1 }, targetTypes: ["permanent"], filter: { cardTypes: ["Creature", "Artifact", "Enchantment", "Planeswalker"] }, controller: "any" }] },
    { type: "triggered", id: "dsphere_ltb", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "detention_sphere_return" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardLeftZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [] },
  ];
}
export const detentionSphereTargets: TargetRequirement[] = [{
  id: "dsphere_t1", description: "target nonland permanent", count: { exactly: 1 },
  targetTypes: ["permanent"], filter: { cardTypes: ["Creature", "Artifact", "Enchantment", "Planeswalker"] }, controller: "any",
}];

// --- Think Twice: Draw a card. Flashback {2}{U} ---
export function thinkTwiceOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "tt_spell", sourceCardInstanceId: null,
    effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
    zones: [ZoneType.Hand, ZoneType.Stack, ZoneType.Graveyard],
  }];
}

// --- Sphinx's Revelation: Draw X cards and gain X life ---
export function sphinxsRevelationOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "sr_spell", sourceCardInstanceId: null,
    effects: [
      { type: "gainLife", amount: { variable: "X" }, player: { type: "controller" } },
      { type: "drawCards", count: { variable: "X" }, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
