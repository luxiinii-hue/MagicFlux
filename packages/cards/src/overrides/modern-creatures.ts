/**
 * Modern-legal creatures across archetypes.
 * Creatures with only keywords don't need overrides (keyword registry handles them).
 * This covers creatures with ETB, dies, attack triggers, activated abilities, or static effects.
 */

import type { SpellAbility, TargetRequirement } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// --- Death's Shadow: 13/13, gets -X/-X where X is your life total ---
export function deathsShadowOverride(): SpellAbility[] { return [{ type: "static", id: "ds_pt", sourceCardInstanceId: null, effects: [], zones: [ZoneType.Battlefield], continuousEffect: { effectType: "deathsShadow", affectedFilter: { self: true }, modification: {} }, condition: null, layer: 7 }]; }

// --- Gurmag Angler: 5/5 delve (already in creatures-phase3.ts, skip) ---

// --- Stoneforge Mystic: ETB search for Equipment, {1}{W}{T}: put equipment from hand onto battlefield ---
export function stoneforgeOverride(): SpellAbility[] { return [
  { type: "triggered", id: "sfm_etb", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "sfm_search_equipment" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: true, interveningIf: null }, targets: [] },
  { type: "activated", id: "sfm_activate", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "sfm_put_equipment" }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }, { type: "colored", color: "W" }], totalCMC: 2 }, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [], activationRestrictions: [] },
]; }

// --- Primeval Titan: Trample. ETB + attacks: search for 2 lands, put onto battlefield tapped ---
export function primevalTitanOverride(): SpellAbility[] { return [
  { type: "triggered", id: "prime_etb", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "prime_titan_lands" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null }, targets: [] },
  { type: "triggered", id: "prime_attack", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "prime_titan_lands" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "attackersDeclared", filter: null, self: true, optional: false, interveningIf: null }, targets: [] },
]; }

// --- Wurmcoil Engine: 6/6 deathtouch lifelink. Dies: create 3/3 deathtouch + 3/3 lifelink tokens ---
export function wurmcoilEngineOverride(): SpellAbility[] { return [{ type: "triggered", id: "wurmcoil_dies", sourceCardInstanceId: null, effects: [{ type: "createToken", token: { name: "Phyrexian Wurm", colors: [], cardTypes: ["Creature"], subtypes: ["Phyrexian", "Wurm"], power: 3, toughness: 3, abilities: [], keywords: ["Deathtouch"] }, count: 1, controller: { type: "controller" } }, { type: "createToken", token: { name: "Phyrexian Wurm", colors: [], cardTypes: ["Creature"], subtypes: ["Phyrexian", "Wurm"], power: 3, toughness: 3, abilities: [], keywords: ["Lifelink"] }, count: 1, controller: { type: "controller" } }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardDestroyed", filter: null, self: true, optional: false, interveningIf: null }, targets: [] }]; }

// --- Thought-Knot Seer: ETB exile a nonland card from opponent's hand. LTB opponent draws ---
// (already in final-sprint.ts, skip)

// --- Noble Hierarch: Exalted + tap for G/W/U ---
export function nobleHierarchOverride(): SpellAbility[] { return [
  { type: "mana", id: "nh_g", sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } },
  { type: "mana", id: "nh_w", sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } },
  { type: "mana", id: "nh_u", sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } },
  { type: "triggered", id: "nh_exalted", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "exalted" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "attackersDeclared", filter: null, self: false, optional: false, interveningIf: null }, targets: [] },
]; }

// --- Birds of Paradise: 0/1 flying, tap for any color ---
export function birdsOfParadiseOverride(): SpellAbility[] { return [{ type: "mana", id: "bop_mana", sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } }]; }

// --- Emrakul, the Aeons Torn: 15/15 flying protection annihilator 6, extra turn on cast ---
export function emrakulAeonsTornOverride(): SpellAbility[] { return [{ type: "triggered", id: "emrakul_cast", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "extra_turn" }], zones: [ZoneType.Stack], triggerCondition: { eventType: "spellCast", filter: null, self: true, optional: false, interveningIf: null }, targets: [] }]; }

// --- Ulamog, the Ceaseless Hunger: On cast exile 2 permanents. Attacks: exile top 20 of library ---
export function ulamogCeaselessOverride(): SpellAbility[] { return [
  { type: "triggered", id: "ulamog_cast", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "ulamog_exile_two" }], zones: [ZoneType.Stack], triggerCondition: { eventType: "spellCast", filter: null, self: true, optional: false, interveningIf: null }, targets: [{ id: "u_t1", description: "target permanent", count: { exactly: 1 }, targetTypes: ["permanent"], filter: null, controller: "opponent" }, { id: "u_t2", description: "target permanent", count: { exactly: 1 }, targetTypes: ["permanent"], filter: null, controller: "opponent" }] },
  { type: "triggered", id: "ulamog_attack", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "ulamog_exile_library" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "attackersDeclared", filter: null, self: true, optional: false, interveningIf: null }, targets: [] },
]; }

// --- Karn Liberated: Planeswalker with +4 exile from hand, -3 exile permanent, -14 restart game ---
export function karnLiberatedOverride(): SpellAbility[] { return [
  { type: "activated", id: "karn_plus4", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "karn_exile_hand" }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: -4 }, additionalCosts: [] }, timing: "sorcery", targets: [{ id: "karn_t1", description: "target player", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "any" }], activationRestrictions: ["Activate only as a sorcery"] },
  { type: "activated", id: "karn_minus3", sourceCardInstanceId: null, effects: [{ type: "exile", target: { targetRequirementId: "karn_t2" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: 3 }, additionalCosts: [] }, timing: "sorcery", targets: [{ id: "karn_t2", description: "target permanent", count: { exactly: 1 }, targetTypes: ["permanent"], filter: null, controller: "any" }], activationRestrictions: ["Activate only as a sorcery"] },
  { type: "activated", id: "karn_minus14", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "karn_restart" }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: 14 }, additionalCosts: [] }, timing: "sorcery", targets: [], activationRestrictions: ["Activate only as a sorcery"] },
]; }

// --- Snapcaster Mage already in creatures-phase3.ts ---

// --- Teferi, Hero of Dominaria: +1 draw, untap 2 lands. -3 put nonland into library. -8 exile ---
export function teferiHeroOverride(): SpellAbility[] { return [
  { type: "activated", id: "teferi_plus1", sourceCardInstanceId: null, effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }, { type: "custom", resolveFunction: "teferi_untap_lands" }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: -1 }, additionalCosts: [] }, timing: "sorcery", targets: [], activationRestrictions: ["Activate only as a sorcery"] },
  { type: "activated", id: "teferi_minus3", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "teferi_tuck" }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: 3 }, additionalCosts: [] }, timing: "sorcery", targets: [{ id: "teferi_t1", description: "target nonland permanent", count: { exactly: 1 }, targetTypes: ["permanent"], filter: { cardTypes: ["Creature", "Artifact", "Enchantment", "Planeswalker"] }, controller: "any" }], activationRestrictions: ["Activate only as a sorcery"] },
  { type: "activated", id: "teferi_minus8", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "teferi_ultimate" }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: { counterType: "loyalty", count: 8 }, additionalCosts: [] }, timing: "sorcery", targets: [], activationRestrictions: ["Activate only as a sorcery"] },
]; }

// --- Huntmaster of the Fells: ETB create 2/2 Wolf, gain 2 life. Transforms ---
export function huntmasterOverride(): SpellAbility[] { return [{ type: "triggered", id: "huntmaster_etb", sourceCardInstanceId: null, effects: [{ type: "createToken", token: { name: "Wolf", colors: ["G"], cardTypes: ["Creature"], subtypes: ["Wolf"], power: 2, toughness: 2, abilities: [], keywords: [] }, count: 1, controller: { type: "controller" } }, { type: "gainLife", amount: 2, player: { type: "controller" } }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null }, targets: [] }]; }

// --- Collected Company already in standard-instants.ts ---

// --- Arcbound Ravager: Sacrifice artifact: +1/+1 counter. Dies: put counters on target ---
export function arcboundRavagerOverride(): SpellAbility[] { return [
  { type: "activated", id: "ravager_sac", sourceCardInstanceId: null, effects: [{ type: "addCounters", counterType: "+1/+1", count: 1, target: { targetRequirementId: "self" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: false, untapSelf: false, sacrifice: { cardTypes: ["Artifact"], description: "Sacrifice an artifact" }, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [], activationRestrictions: [] },
  { type: "triggered", id: "ravager_dies", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "arcbound_modular" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardDestroyed", filter: null, self: true, optional: false, interveningIf: null }, targets: [{ id: "ravager_t1", description: "target artifact creature", count: { exactly: 1 }, targetTypes: ["creature"], filter: { cardTypes: ["Artifact"] }, controller: "any" }] },
]; }

// --- Goblin Dark-Dwellers: 4/4 menace, ETB cast instant/sorcery from graveyard for free ---
export function goblinDarkDwellersOverride(): SpellAbility[] { return [{ type: "triggered", id: "gdd_etb", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "gdd_cast_from_graveyard" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: true, interveningIf: null }, targets: [] }]; }

// --- Inferno Titan: ETB + attacks: deal 3 damage divided ---
export function infernoTitanOverride(): SpellAbility[] { return [
  { type: "triggered", id: "inferno_etb", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "inferno_titan_damage" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null }, targets: [] },
  { type: "triggered", id: "inferno_attack", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "inferno_titan_damage" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "attackersDeclared", filter: null, self: true, optional: false, interveningIf: null }, targets: [] },
]; }

// --- Sun Titan: ETB + attacks: return permanent CMC ≤3 from graveyard to battlefield ---
export function sunTitanOverride(): SpellAbility[] { return [
  { type: "triggered", id: "sun_etb", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "sun_titan_return" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: true, interveningIf: null }, targets: [{ id: "sun_t1", description: "target permanent card with CMC 3 or less in your graveyard", count: { exactly: 1 }, targetTypes: ["card-in-graveyard"], filter: { cmc: { op: "lte", value: 3 } }, controller: "you" }] },
  { type: "triggered", id: "sun_attack", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "sun_titan_return" }], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "attackersDeclared", filter: null, self: true, optional: true, interveningIf: null }, targets: [{ id: "sun_t1", description: "target permanent card with CMC 3 or less in your graveyard", count: { exactly: 1 }, targetTypes: ["card-in-graveyard"], filter: { cmc: { op: "lte", value: 3 } }, controller: "you" }] },
]; }

// --- Grave Titan: ETB + attacks: create two 2/2 black Zombie tokens ---
export function graveTitanOverride(): SpellAbility[] { const tokenEffect: any = { type: "createToken", token: { name: "Zombie", colors: ["B"], cardTypes: ["Creature"], subtypes: ["Zombie"], power: 2, toughness: 2, abilities: [], keywords: [] }, count: 2, controller: { type: "controller" } }; return [
  { type: "triggered", id: "grave_etb", sourceCardInstanceId: null, effects: [tokenEffect], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null }, targets: [] },
  { type: "triggered", id: "grave_attack", sourceCardInstanceId: null, effects: [tokenEffect], zones: [ZoneType.Battlefield], triggerCondition: { eventType: "attackersDeclared", filter: null, self: true, optional: false, interveningIf: null }, targets: [] },
]; }
