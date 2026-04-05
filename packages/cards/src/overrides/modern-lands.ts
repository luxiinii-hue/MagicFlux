/**
 * Modern-legal nonbasic lands.
 * Most produce mana with conditions (ETB tapped, pay life, etc.)
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

function tapForTwo(id: string, colorA: string, colorB: string): () => SpellAbility[] {
  return () => [
    { type: "mana", id: `${id}_a`, sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: colorA === "W" ? 1 : 0, U: colorA === "U" ? 1 : 0, B: colorA === "B" ? 1 : 0, R: colorA === "R" ? 1 : 0, G: colorA === "G" ? 1 : 0, C: 0 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } },
    { type: "mana", id: `${id}_b`, sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: colorB === "W" ? 1 : 0, U: colorB === "U" ? 1 : 0, B: colorB === "B" ? 1 : 0, R: colorB === "R" ? 1 : 0, G: colorB === "G" ? 1 : 0, C: 0 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } },
  ];
}

// Shock lands (ETB: pay 2 life or tapped)
export const sacredFoundryOverride = tapForTwo("sacred_foundry", "R", "W");
export const steamVentsOverride = tapForTwo("steam_vents", "U", "R");
export const overgrowlThombOverride = tapForTwo("overgrown_tomb", "B", "G");
export const templeGardenOverride = tapForTwo("temple_garden", "G", "W");
export const hallowedFountainOverride = tapForTwo("hallowed_fountain", "W", "U");
export const waternGraveOverride = tapForTwo("watery_grave", "U", "B");
export const bloodCryptOverride = tapForTwo("blood_crypt", "B", "R");
export const stompingGroundOverride = tapForTwo("stomping_ground", "R", "G");
export const godlessShriineOverride = tapForTwo("godless_shrine", "W", "B");
export const breedingPoolOverride = tapForTwo("breeding_pool", "G", "U");

// Fetch lands (pay 1 life, sacrifice: search for a land with basic land type)
function fetchLand(id: string): () => SpellAbility[] {
  return () => [{
    type: "activated", id, sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: `fetch_${id}` }],
    zones: [ZoneType.Battlefield],
    cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: { self: true, description: "Sacrifice this land" }, discard: null, payLife: 1, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
    timing: "instant", targets: [], activationRestrictions: [],
  }];
}

export const flooodedStrandOverride = fetchLand("flooded_strand");
export const pollutedDeltaOverride = fetchLand("polluted_delta");
export const bloodstainedMireOverride = fetchLand("bloodstained_mire");
export const woodedFoothillsOverride = fetchLand("wooded_foothills");
export const windsweptHeathOverride = fetchLand("windswept_heath");
export const scaldingTarnOverride = fetchLand("scalding_tarn");
export const verdantCatacombsOverride = fetchLand("verdant_catacombs");
export const aridMesaOverride = fetchLand("arid_mesa");
export const mistyRainforestOverride = fetchLand("misty_rainforest");
export const marshFlatsOverride = fetchLand("marsh_flats");

// Command Tower — tap for any color in commander's identity
export function commandTowerOverride(): SpellAbility[] {
  return [{
    type: "mana", id: "command_tower_mana", sourceCardInstanceId: null,
    effects: [{ type: "addMana", mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 }, player: { type: "controller" } }],
    zones: [ZoneType.Battlefield],
    cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] },
  }];
}

// Mutavault — tap for {C}, or pay {1}: becomes a 2/2 all-creature-types until EOT
export function mutavaultOverride(): SpellAbility[] {
  return [
    { type: "mana", id: "mutavault_mana", sourceCardInstanceId: null, effects: [{ type: "addMana", mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 }, player: { type: "controller" } }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } },
    { type: "activated", id: "mutavault_animate", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "mutavault_animate" }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }], totalCMC: 1 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [], activationRestrictions: [] },
  ];
}

// Celestial Colonnade — ETB tapped, tap for W or U, animate for {3}{W}{U}: 4/4 flying vigilance
export function celestialColonnadeOverride(): SpellAbility[] {
  return [
    ...tapForTwo("colonnade", "W", "U")(),
    { type: "activated", id: "colonnade_animate", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "colonnade_animate" }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 3 }, { type: "colored", color: "W" }, { type: "colored", color: "U" }], totalCMC: 5 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [], activationRestrictions: [] },
  ];
}

// Creeping Tar Pit — ETB tapped, tap for U or B, animate for {1}{U}{B}: 3/2 unblockable
export function creepingTarPitOverride(): SpellAbility[] {
  return [
    ...tapForTwo("tar_pit", "U", "B")(),
    { type: "activated", id: "tar_pit_animate", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "tar_pit_animate" }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 1 }, { type: "colored", color: "U" }, { type: "colored", color: "B" }], totalCMC: 3 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [], activationRestrictions: [] },
  ];
}

// Raging Ravine — ETB tapped, tap for R or G, animate for {2}{R}{G}: 3/3 +1/+1 counter on attack
export function ragingRavineOverride(): SpellAbility[] {
  return [
    ...tapForTwo("ravine", "R", "G")(),
    { type: "activated", id: "ravine_animate", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "ravine_animate" }], zones: [ZoneType.Battlefield], cost: { manaCost: { symbols: [{ type: "generic", amount: 2 }, { type: "colored", color: "R" }, { type: "colored", color: "G" }], totalCMC: 4 }, tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] }, timing: "instant", targets: [], activationRestrictions: [] },
  ];
}

// Urza's Tower/Mine/Power Plant — Tron lands (tap for {C}, or {C}{C}{C}/{C}{C} with Tron assembled)
export function urzasTowerOverride(): SpellAbility[] { return [{ type: "mana", id: "tron_tower", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "tron_mana_tower" }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } }]; }
export function urzasMineOverride(): SpellAbility[] { return [{ type: "mana", id: "tron_mine", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "tron_mana_mine" }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } }]; }
export function urzasPowerPlantOverride(): SpellAbility[] { return [{ type: "mana", id: "tron_plant", sourceCardInstanceId: null, effects: [{ type: "custom", resolveFunction: "tron_mana_plant" }], zones: [ZoneType.Battlefield], cost: { manaCost: null, tapSelf: true, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [] } }]; }
