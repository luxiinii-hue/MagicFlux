/**
 * Healing Salve — {W} Instant
 * Target player gains 3 life.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function healingSalveOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "healing_salve_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "gainLife",
          amount: 3,
          player: { type: "targetPlayer", targetRef: { targetRequirementId: "target_player" } },
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}

/** Target requirements for Healing Salve's spell ability. */
export const healingSalveTargets = [
  {
    id: "target_player",
    description: "target player",
    count: { exactly: 1 } as const,
    targetTypes: ["player"] as const,
    filter: null,
    controller: "any" as const,
  },
];
