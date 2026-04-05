/**
 * Modern Burn archetype cards.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

const anyTarget: TargetRequirement = { id: "t1", description: "any target", count: { exactly: 1 }, targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any" };
const targetPlayer: TargetRequirement = { id: "t1", description: "target player or planeswalker", count: { exactly: 1 }, targetTypes: ["player", "planeswalker"], filter: null, controller: "any" };
const targetCreature: TargetRequirement = { id: "t1", description: "target creature", count: { exactly: 1 }, targetTypes: ["creature"], filter: null, controller: "any" };

function burnSpell(id: string, amount: number, targets: TargetRequirement[]): { override: () => SpellAbility[]; targets: TargetRequirement[] } {
  return {
    override: () => [{ type: "spell", id, sourceCardInstanceId: null, effects: [{ type: "dealDamage", amount, to: { targetRequirementId: "t1" } }], zones: [ZoneType.Hand, ZoneType.Stack] }],
    targets,
  };
}

// Searing Blood — 2 to creature, if it dies 3 to controller
export function searingBloodOverride(): SpellAbility[] { return [{ type: "spell", id: "searing_blood", sourceCardInstanceId: null, effects: [{ type: "dealDamage", amount: 2, to: { targetRequirementId: "t1" } }, { type: "custom", resolveFunction: "searing_blood_controller_damage" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const searingBloodTargets = [targetCreature];

// Bump in the Night — 3 to target player. Flashback {5}{R}
export function bumpInTheNightOverride(): SpellAbility[] { return [{ type: "spell", id: "bump", sourceCardInstanceId: null, effects: [{ type: "loseLife", amount: 3, player: { type: "targetPlayer", targetRef: { targetRequirementId: "t1" } } }], zones: [ZoneType.Hand, ZoneType.Stack, ZoneType.Graveyard] }]; }
export const bumpInTheNightTargets = [targetPlayer];

// Monastery Swiftspear already exists in creatures-keyword.ts

// Goblin Guide already exists

// Shard Volley — 3 damage, sacrifice a land
export function shardVolleyOverride(): SpellAbility[] { return [{ type: "spell", id: "shard_volley", sourceCardInstanceId: null, effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "t1" } }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const shardVolleyTargets = [anyTarget];

// Flames of the Blood Hand — 4 to target player, can't gain life
export function flamesOfTheBloodHandOverride(): SpellAbility[] { return [{ type: "spell", id: "flames_blood", sourceCardInstanceId: null, effects: [{ type: "dealDamage", amount: 4, to: { targetRequirementId: "t1" } }, { type: "custom", resolveFunction: "cant_gain_life_turn" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const flamesOfTheBloodHandTargets = [targetPlayer];

// Light Up the Stage — Spectacle {R}. Exile top 2, play until end of next turn
export function lightUpTheStageOverride(): SpellAbility[] { return [{ type: "spell", id: "light_up", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "light_up_the_stage" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }

// Wayward Guide-Beast — 1/1 haste, return a land on combat damage
export function waywardGuideBeastOverride(): SpellAbility[] { return [{ type: "triggered", id: "wgb_trigger", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "return_land_to_hand" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "damageDealt", filter: null, self: true, optional: false, interveningIf: null }, targets: [] }]; }

// Roiling Vortex — Each player's upkeep: lose 1 life. If spell cast without paying, 5 damage
export function roilingVortexOverride(): SpellAbility[] { return [{ type: "triggered", id: "vortex_upkeep", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "roiling_vortex_upkeep" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "phaseChanged", filter: null, self: false, optional: false, interveningIf: null }, targets: [] }]; }

// Play with Fire — 2 damage to any target, scry 1 if targets player
export function playWithFireOverride(): SpellAbility[] { return [{ type: "spell", id: "pwf", sourceCardInstanceId: null, effects: [{ type: "dealDamage", amount: 2, to: { targetRequirementId: "t1" } }, { type: "custom", resolveFunction: "play_with_fire_scry" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const playWithFireTargets = [anyTarget];

// Fiery Impulse — 2 damage to creature. Spell mastery: 3 instead
export function fieryImpulseOverride(): SpellAbility[] { return [{ type: "spell", id: "fiery_impulse", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "fiery_impulse" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const fieryImpulseTargets = [targetCreature];

// Wild Slash — 2 damage to any target
const wildSlash = burnSpell("wild_slash", 2, [anyTarget]);
export const wildSlashOverride = wildSlash.override;
export const wildSlashTargets = wildSlash.targets;

// Magma Jet — 2 damage to any target, scry 2
export function magmaJetOverride(): SpellAbility[] { return [{ type: "spell", id: "magma_jet", sourceCardInstanceId: null, effects: [{ type: "dealDamage", amount: 2, to: { targetRequirementId: "t1" } }, { type: "custom", resolveFunction: "scry_2" }], zones: [ZoneType.Hand, ZoneType.Stack] }]; }
export const magmaJetTargets = [anyTarget];

// Bonecrusher Giant — Adventure: Stomp deals 2 to any target
export function bonecrushGiantOverride(): SpellAbility[] { return [{ type: "spell", id: "stomp", sourceCardInstanceId: null, effects: [{ type: "dealDamage", amount: 2, to: { targetRequirementId: "t1" } }], zones: [ZoneType.Hand, ZoneType.Stack] }, { type: "static", id: "bg_no_prevent", sourceCardInstanceId: null, effects: [], zones: [ZoneType.Battlefield], continuousEffect: { effectType: "cantPreventDamage", affectedFilter: {}, modification: {} }, condition: null, layer: 6 }]; }
export const bonecrushGiantTargets = [anyTarget];
