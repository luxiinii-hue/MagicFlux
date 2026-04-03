/**
 * Triggered keywords — keywords that produce triggered abilities.
 *
 * Prowess: Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.
 * Ward: Whenever this creature becomes the target of a spell or ability an opponent controls,
 *       counter that spell unless its controller pays the ward cost.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { registerKeyword } from "./registry.js";

registerKeyword({
  name: "Prowess",
  type: "triggered",
  generateAbilities: () => [{
    type: "triggered" as const,
    id: "kw_prowess",
    sourceCardInstanceId: null,
    effects: [{
      type: "modifyPT" as const,
      power: 1,
      toughness: 1,
      target: { targetRequirementId: "self" },
      duration: "endOfTurn" as const,
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: {
      eventType: "spellCast",
      filter: {
        cardTypes: ["Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker"],
      },
      self: false,
      optional: false,
      interveningIf: null,
    },
    targets: [],
  }],
});

registerKeyword({
  name: "Ward",
  type: "triggered",
  generateAbilities: () => [{
    type: "triggered" as const,
    id: "kw_ward",
    sourceCardInstanceId: null,
    effects: [{
      type: "counter" as const,
      target: { targetRequirementId: "triggering_spell" },
    }],
    zones: [ZoneType.Battlefield],
    triggerCondition: {
      eventType: "abilityActivated",
      filter: null,
      self: true, // triggers when THIS creature is targeted
      optional: false,
      interveningIf: null,
    },
    targets: [],
  }],
});
