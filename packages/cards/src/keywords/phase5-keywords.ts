/**
 * Phase 5 keywords — alternative costs, graveyard mechanics, and storm.
 *
 * These keywords produce abilities that modify how spells are cast
 * or create special interactions with zones.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { registerKeyword } from "./registry.js";

// ---------------------------------------------------------------------------
// Kicker — optional additional cost for enhanced effect
// The actual cost varies per card. The keyword ability marks the card
// as having kicker; the specific cost is set by the override or oracle parser.
// ---------------------------------------------------------------------------

registerKeyword({
  name: "Kicker",
  type: "activated",
  generateAbilities: () => [{
    type: "static" as const,
    id: "kw_kicker",
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Hand, ZoneType.Stack],
    continuousEffect: {
      effectType: "kicker",
      affectedFilter: {},
      modification: { hasKicker: true },
    },
    condition: null,
    layer: 6,
  }],
});

// ---------------------------------------------------------------------------
// Flashback — cast from graveyard, exile on resolution
// ---------------------------------------------------------------------------

registerKeyword({
  name: "Flashback",
  type: "activated",
  generateAbilities: () => [{
    type: "activated" as const,
    id: "kw_flashback",
    sourceCardInstanceId: null,
    effects: [{
      type: "custom" as const,
      resolveFunction: "flashback_cast",
    }],
    zones: [ZoneType.Graveyard],
    cost: {
      manaCost: null, // Varies per card
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
    timing: "instant" as const,
    targets: [],
    activationRestrictions: ["Cast this spell only from your graveyard"],
  }],
});

// ---------------------------------------------------------------------------
// Cycling — discard to draw a card
// The cost varies per card. This is a default template.
// ---------------------------------------------------------------------------

registerKeyword({
  name: "Cycling",
  type: "activated",
  generateAbilities: () => [{
    type: "activated" as const,
    id: "kw_cycling",
    sourceCardInstanceId: null,
    effects: [{
      type: "drawCards" as const,
      count: 1,
      player: { type: "controller" as const },
    }],
    zones: [ZoneType.Hand],
    cost: {
      manaCost: null, // Varies per card
      tapSelf: false,
      untapSelf: false,
      sacrifice: null,
      discard: { self: true, description: "Discard this card" },
      payLife: null,
      exileSelf: false,
      exileFromGraveyard: null,
      removeCounters: null,
      additionalCosts: [],
    },
    timing: "instant" as const,
    targets: [],
    activationRestrictions: [],
  }],
});

// ---------------------------------------------------------------------------
// Storm — copy for each spell cast before it this turn
// ---------------------------------------------------------------------------

registerKeyword({
  name: "Storm",
  type: "triggered",
  generateAbilities: () => [{
    type: "triggered" as const,
    id: "kw_storm",
    sourceCardInstanceId: null,
    effects: [{
      type: "custom" as const,
      resolveFunction: "storm_copy",
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
  }],
});

// ---------------------------------------------------------------------------
// Cascade — exile cards from top of library until you exile a nonland with
// lesser CMC, then cast it for free
// ---------------------------------------------------------------------------

registerKeyword({
  name: "Cascade",
  type: "triggered",
  generateAbilities: () => [{
    type: "triggered" as const,
    id: "kw_cascade",
    sourceCardInstanceId: null,
    effects: [{
      type: "custom" as const,
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
  }],
});

// ---------------------------------------------------------------------------
// Convoke — tap creatures to help pay mana costs
// ---------------------------------------------------------------------------

registerKeyword({
  name: "Convoke",
  type: "static",
  generateAbilities: () => [{
    type: "static" as const,
    id: "kw_convoke",
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Hand, ZoneType.Stack],
    continuousEffect: {
      effectType: "convoke",
      affectedFilter: {},
      modification: {},
    },
    condition: null,
    layer: 6,
  }],
});

// ---------------------------------------------------------------------------
// Delve — exile cards from graveyard to pay generic mana
// ---------------------------------------------------------------------------

registerKeyword({
  name: "Delve",
  type: "static",
  generateAbilities: () => [{
    type: "static" as const,
    id: "kw_delve",
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Hand, ZoneType.Stack],
    continuousEffect: {
      effectType: "delve",
      affectedFilter: {},
      modification: {},
    },
    condition: null,
    layer: 6,
  }],
});

// ---------------------------------------------------------------------------
// Regenerate — an older mechanic, prevent destruction
// ---------------------------------------------------------------------------

registerKeyword({
  name: "Regenerate",
  type: "activated",
  generateAbilities: () => [{
    type: "activated" as const,
    id: "kw_regenerate",
    sourceCardInstanceId: null,
    effects: [{
      type: "custom" as const,
      resolveFunction: "regenerate",
    }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null,
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
    timing: "instant" as const,
    targets: [],
    activationRestrictions: [],
  }],
});

// ---------------------------------------------------------------------------
// Lifelink is already registered in static-keywords.ts
// Additional evergreen keywords that were missing
// ---------------------------------------------------------------------------

registerKeyword({
  name: "Morph",
  type: "activated",
  generateAbilities: () => [{
    type: "activated" as const,
    id: "kw_morph",
    sourceCardInstanceId: null,
    effects: [{ type: "custom" as const, resolveFunction: "morph_turn_face_up" }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null, tapSelf: false, untapSelf: false,
      sacrifice: null, discard: null, payLife: null,
      exileSelf: false, exileFromGraveyard: null,
      removeCounters: null, additionalCosts: [],
    },
    timing: "instant" as const,
    targets: [],
    activationRestrictions: [],
  }],
});

registerKeyword({
  name: "Unearth",
  type: "activated",
  generateAbilities: () => [{
    type: "activated" as const,
    id: "kw_unearth",
    sourceCardInstanceId: null,
    effects: [{ type: "custom" as const, resolveFunction: "unearth" }],
    zones: [ZoneType.Graveyard],
    cost: {
      manaCost: null, tapSelf: false, untapSelf: false,
      sacrifice: null, discard: null, payLife: null,
      exileSelf: false, exileFromGraveyard: null,
      removeCounters: null, additionalCosts: [],
    },
    timing: "sorcery" as const,
    targets: [],
    activationRestrictions: [],
  }],
});
