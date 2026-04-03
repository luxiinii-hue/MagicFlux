/**
 * Shock — {R} Instant
 * Shock deals 2 damage to any target.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function shockOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "shock_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "dealDamage",
          amount: 2,
          to: { targetRequirementId: "target_any" },
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}

/** Target requirements for Shock's spell ability. */
export const shockTargets = [
  {
    id: "target_any",
    description: "any target (creature, planeswalker, or player)",
    count: { exactly: 1 } as const,
    targetTypes: ["creature", "planeswalker", "player"] as const,
    filter: null,
    controller: "any" as const,
  },
];
