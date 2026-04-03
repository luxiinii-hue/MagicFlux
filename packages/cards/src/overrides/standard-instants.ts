/**
 * Standard-legal instant and sorcery overrides for Phase 5.
 * Cards with effects the oracle parser can handle don't need overrides —
 * this file covers cards with complex or multi-part effects.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// --- Swords to Plowshares: Exile target creature. Its controller gains life = power ---
export function swordsToPlowsharesOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "stp_spell", sourceCardInstanceId: null,
    effects: [
      { type: "exile", target: { targetRequirementId: "stp_t1" } },
      { type: "custom", resolveFunction: "stp_gain_life" },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const swordsToPlowsharesTargets: TargetRequirement[] = [{
  id: "stp_t1", description: "target creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];

// --- Path to Exile: Exile target creature. Its controller may search for a basic land ---
export function pathToExileOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "pte_spell", sourceCardInstanceId: null,
    effects: [
      { type: "exile", target: { targetRequirementId: "pte_t1" } },
      { type: "custom", resolveFunction: "pte_search_land" },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const pathToExileTargets: TargetRequirement[] = [{
  id: "pte_t1", description: "target creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];

// --- Mana Leak: Counter target spell unless its controller pays {3} ---
export function manaLeakOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "mana_leak_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "mana_leak_counter" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const manaLeakTargets: TargetRequirement[] = [{
  id: "ml_t1", description: "target spell", count: { exactly: 1 },
  targetTypes: ["spell"], filter: null, controller: "any",
}];

// --- Negate: Counter target noncreature spell ---
export function negateOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "negate_spell", sourceCardInstanceId: null,
    effects: [{ type: "counter", target: { targetRequirementId: "negate_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const negateTargets: TargetRequirement[] = [{
  id: "negate_t1", description: "target noncreature spell", count: { exactly: 1 },
  targetTypes: ["spell"], filter: { cardTypes: ["Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker"] }, controller: "any",
}];

// --- Spell Pierce: Counter target noncreature spell unless controller pays {2} ---
export function spellPierceOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "sp_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "spell_pierce_counter" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const spellPierceTargets: TargetRequirement[] = [{
  id: "sp_t1", description: "target noncreature spell", count: { exactly: 1 },
  targetTypes: ["spell"], filter: null, controller: "any",
}];

// --- Incinerate: Deal 3 damage to any target. That permanent can't regenerate ---
export function incinerateOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "incinerate_spell", sourceCardInstanceId: null,
    effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "inc_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const incinerateTargets: TargetRequirement[] = [{
  id: "inc_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// --- Terminate: Destroy target creature. It can't be regenerated ---
export function terminateOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "terminate_spell", sourceCardInstanceId: null,
    effects: [{ type: "destroy", target: { targetRequirementId: "term_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const terminateTargets: TargetRequirement[] = [{
  id: "term_t1", description: "target creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];

// --- Abrupt Decay: Destroy target nonland permanent with CMC 3 or less ---
export function abruptDecayOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "ad_spell", sourceCardInstanceId: null,
    effects: [{ type: "destroy", target: { targetRequirementId: "ad_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const abruptDecayTargets: TargetRequirement[] = [{
  id: "ad_t1", description: "target nonland permanent with mana value 3 or less", count: { exactly: 1 },
  targetTypes: ["permanent"], filter: { cmc: { op: "lte", value: 3 } }, controller: "any",
}];

// --- Thoughtseize: Target player reveals hand, you choose a nonland card, they discard it ---
export function thoughtseizeOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "ts_spell", sourceCardInstanceId: null,
    effects: [
      { type: "custom", resolveFunction: "thoughtseize_discard" },
      { type: "loseLife", amount: 2, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const thoughtseizeTargets: TargetRequirement[] = [{
  id: "ts_t1", description: "target player", count: { exactly: 1 },
  targetTypes: ["player"], filter: null, controller: "any",
}];

// --- Duress: Target opponent reveals hand, you choose a noncreature nonland card ---
export function duressOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "duress_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "duress_discard" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const duressTargets: TargetRequirement[] = [{
  id: "duress_t1", description: "target opponent", count: { exactly: 1 },
  targetTypes: ["player"], filter: null, controller: "opponent",
}];

// --- Preordain: Scry 2, then draw a card ---
export function preordainOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "preordain_spell", sourceCardInstanceId: null,
    effects: [
      { type: "custom", resolveFunction: "scry_2" },
      { type: "drawCards", count: 1, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Ponder: Look at top 3, may shuffle, draw a card ---
export function ponderOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "ponder_spell", sourceCardInstanceId: null,
    effects: [
      { type: "custom", resolveFunction: "ponder_look" },
      { type: "drawCards", count: 1, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Brainstorm: Draw 3 cards, then put 2 cards from hand on top of library ---
export function brainstormOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "brainstorm_spell", sourceCardInstanceId: null,
    effects: [
      { type: "drawCards", count: 3, player: { type: "controller" } },
      { type: "custom", resolveFunction: "brainstorm_put_back" },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Opt: Scry 1, draw a card ---
export function optOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "opt_spell", sourceCardInstanceId: null,
    effects: [
      { type: "custom", resolveFunction: "scry_1" },
      { type: "drawCards", count: 1, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Consider: Look at top card, may put in graveyard, draw a card ---
export function considerOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "consider_spell", sourceCardInstanceId: null,
    effects: [
      { type: "custom", resolveFunction: "consider_surveil" },
      { type: "drawCards", count: 1, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Murder: Destroy target creature ---
export function murderOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "murder_spell", sourceCardInstanceId: null,
    effects: [{ type: "destroy", target: { targetRequirementId: "murder_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const murderTargets: TargetRequirement[] = [{
  id: "murder_t1", description: "target creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];

// --- Flame Slash: Deal 4 damage to target creature (sorcery) ---
export function flameSlashOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "flame_slash_spell", sourceCardInstanceId: null,
    effects: [{ type: "dealDamage", amount: 4, to: { targetRequirementId: "fs_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const flameSlashTargets: TargetRequirement[] = [{
  id: "fs_t1", description: "target creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];

// --- Hymn to Tourach: Target player discards 2 cards at random ---
export function hymnToTourachOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "hymn_spell", sourceCardInstanceId: null,
    effects: [{ type: "discardCards", count: 2, player: { type: "targetPlayer", targetRef: { targetRequirementId: "hymn_t1" } } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const hymnToTourachTargets: TargetRequirement[] = [{
  id: "hymn_t1", description: "target player", count: { exactly: 1 },
  targetTypes: ["player"], filter: null, controller: "any",
}];

// --- Vindicate: Destroy target permanent ---
export function vindicateOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "vindicate_spell", sourceCardInstanceId: null,
    effects: [{ type: "destroy", target: { targetRequirementId: "vind_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const vindicateTargets: TargetRequirement[] = [{
  id: "vind_t1", description: "target permanent", count: { exactly: 1 },
  targetTypes: ["permanent"], filter: null, controller: "any",
}];

// --- Maelstrom Pulse: Destroy target nonland permanent and all others with same name ---
export function maelstromPulseOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "mp_spell", sourceCardInstanceId: null,
    effects: [
      { type: "destroy", target: { targetRequirementId: "mp_t1" } },
      { type: "custom", resolveFunction: "maelstrom_pulse_all" },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const maelstromPulseTargets: TargetRequirement[] = [{
  id: "mp_t1", description: "target nonland permanent", count: { exactly: 1 },
  targetTypes: ["permanent"], filter: null, controller: "any",
}];

// --- Collected Company: Look at top 6 cards, put up to 2 creatures with CMC 3 or less onto battlefield ---
export function collectedCompanyOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "coco_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "collected_company" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Boros Charm: Choose one — deal 4 damage to target player/planeswalker; or permanents you control gain indestructible until EOT; or target creature gains double strike until EOT ---
export function borosCharmOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "boros_charm_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "boros_charm_modal" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Lightning Helix: Deal 3 damage to any target, you gain 3 life ---
export function lightningHelixOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "lh_spell", sourceCardInstanceId: null,
    effects: [
      { type: "dealDamage", amount: 3, to: { targetRequirementId: "lh_t1" } },
      { type: "gainLife", amount: 3, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const lightningHelixTargets: TargetRequirement[] = [{
  id: "lh_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];
