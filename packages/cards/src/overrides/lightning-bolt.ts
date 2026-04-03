/**
 * Lightning Bolt — {R} Instant
 * Lightning Bolt deals 3 damage to any target.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function lightningBoltOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "lightning_bolt_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "dealDamage",
          amount: 3,
          to: { targetRequirementId: "target_any" },
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}

/** Target requirements for Lightning Bolt's spell ability. */
export const lightningBoltTargets = [
  {
    id: "target_any",
    description: "any target (creature, planeswalker, or player)",
    count: { exactly: 1 } as const,
    targetTypes: ["creature", "planeswalker", "player"] as const,
    filter: null,
    controller: "any" as const,
  },
];
