/**
 * Static/flag keywords — abilities that are always "on" while the creature
 * is on the battlefield. The engine checks these by name during relevant
 * game phases (combat, targeting, etc.).
 *
 * These produce static SpellAbility objects with a continuousEffect that
 * the engine's layer system applies.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { registerKeyword } from "./registry.js";

/**
 * Helper to create a static keyword ability.
 * Most static keywords are engine-checked flags — the ability just marks
 * that the keyword is present on the card.
 */
function staticKeyword(name: string, id: string): SpellAbility {
  return {
    type: "static",
    id,
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Battlefield],
    continuousEffect: {
      effectType: name.toLowerCase(),
      affectedFilter: {},
      modification: {},
    },
    condition: null,
    layer: 6, // Layer 6: ability-adding effects
  };
}

// ---- Evasion keywords ----

registerKeyword({
  name: "Flying",
  type: "evasion",
  generateAbilities: () => [staticKeyword("Flying", "kw_flying")],
});

registerKeyword({
  name: "Reach",
  type: "static",
  generateAbilities: () => [staticKeyword("Reach", "kw_reach")],
});

registerKeyword({
  name: "Menace",
  type: "evasion",
  generateAbilities: () => [staticKeyword("Menace", "kw_menace")],
});

registerKeyword({
  name: "Intimidate",
  type: "evasion",
  generateAbilities: () => [staticKeyword("Intimidate", "kw_intimidate")],
});

// ---- Combat-modifying keywords ----

registerKeyword({
  name: "First Strike",
  type: "combat",
  generateAbilities: () => [staticKeyword("First Strike", "kw_first_strike")],
});

registerKeyword({
  name: "Double Strike",
  type: "combat",
  generateAbilities: () => [staticKeyword("Double Strike", "kw_double_strike")],
});

registerKeyword({
  name: "Trample",
  type: "combat",
  generateAbilities: () => [staticKeyword("Trample", "kw_trample")],
});

registerKeyword({
  name: "Deathtouch",
  type: "combat",
  generateAbilities: () => [staticKeyword("Deathtouch", "kw_deathtouch")],
});

registerKeyword({
  name: "Lifelink",
  type: "combat",
  generateAbilities: () => [staticKeyword("Lifelink", "kw_lifelink")],
});

// ---- Flag keywords (modify game rules) ----

registerKeyword({
  name: "Vigilance",
  type: "flag",
  generateAbilities: () => [staticKeyword("Vigilance", "kw_vigilance")],
});

registerKeyword({
  name: "Haste",
  type: "flag",
  generateAbilities: () => [staticKeyword("Haste", "kw_haste")],
});

registerKeyword({
  name: "Defender",
  type: "flag",
  generateAbilities: () => [staticKeyword("Defender", "kw_defender")],
});

registerKeyword({
  name: "Flash",
  type: "flag",
  generateAbilities: () => [staticKeyword("Flash", "kw_flash")],
});

registerKeyword({
  name: "Hexproof",
  type: "static",
  generateAbilities: () => [staticKeyword("Hexproof", "kw_hexproof")],
});

registerKeyword({
  name: "Shroud",
  type: "static",
  generateAbilities: () => [staticKeyword("Shroud", "kw_shroud")],
});

registerKeyword({
  name: "Indestructible",
  type: "static",
  generateAbilities: () => [staticKeyword("Indestructible", "kw_indestructible")],
});

registerKeyword({
  name: "Protection",
  type: "static",
  generateAbilities: () => [staticKeyword("Protection", "kw_protection")],
});
