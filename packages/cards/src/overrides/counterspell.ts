/**
 * Counterspell — {U}{U} Instant
 * Counter target spell.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function counterspellOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "counterspell_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "counter",
          target: { targetRequirementId: "target_spell" },
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}

/** Target requirements for Counterspell's spell ability. */
export const counterspellTargets = [
  {
    id: "target_spell",
    description: "target spell",
    count: { exactly: 1 } as const,
    targetTypes: ["spell"] as const,
    filter: null,
    controller: "any" as const,
  },
];
