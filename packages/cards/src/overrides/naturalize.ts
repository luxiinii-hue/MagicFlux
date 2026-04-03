/**
 * Naturalize — {1}{G} Instant
 * Destroy target artifact or enchantment.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function naturalizeOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "naturalize_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "destroy",
          target: { targetRequirementId: "target_artifact_or_enchantment" },
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}

/** Target requirements for Naturalize's spell ability. */
export const naturalizeTargets = [
  {
    id: "target_artifact_or_enchantment",
    description: "target artifact or enchantment",
    count: { exactly: 1 } as const,
    targetTypes: ["artifact", "enchantment"] as const,
    filter: null,
    controller: "any" as const,
  },
];
