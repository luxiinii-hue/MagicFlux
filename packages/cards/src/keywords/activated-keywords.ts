/**
 * Activated keywords — keywords that produce activated abilities.
 *
 * Equip: {N}: Attach to target creature you control. Activate only as a sorcery.
 *
 * Note: Equip's cost varies per card, so the keyword registry produces a
 * default template. Cards with non-standard equip costs use overrides.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { registerKeyword } from "./registry.js";

registerKeyword({
  name: "Equip",
  type: "activated",
  generateAbilities: () => [{
    type: "activated" as const,
    id: "kw_equip",
    sourceCardInstanceId: null,
    effects: [{
      type: "custom" as const,
      resolveFunction: "equip_attach",
    }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null, // Varies per card — populated by oracle parser or override
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
    timing: "sorcery" as const,
    targets: [{
      id: "equip_target",
      description: "target creature you control",
      count: { exactly: 1 },
      targetTypes: ["creature"],
      filter: null,
      controller: "you",
    }],
    activationRestrictions: [],
  }],
});
