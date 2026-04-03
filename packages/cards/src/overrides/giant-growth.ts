/**
 * Giant Growth — {G} Instant
 * Target creature gets +3/+3 until end of turn.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function giantGrowthOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "giant_growth_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "modifyPT",
          power: 3,
          toughness: 3,
          target: { targetRequirementId: "target_creature" },
          duration: "endOfTurn",
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}

/** Target requirements for Giant Growth's spell ability. */
export const giantGrowthTargets = [
  {
    id: "target_creature",
    description: "target creature",
    count: { exactly: 1 } as const,
    targetTypes: ["creature"] as const,
    filter: null,
    controller: "any" as const,
  },
];
